import "server-only";
import type { AgentRun } from "@/lib/jarvis/db-types";
import type { JsonValue, ProposedAction } from "@/lib/jarvis/types";
import type { JarvisStepResult } from "@/lib/jarvis/orchestrator";
import { advanceAgentRunForJob } from "@/lib/repos/jarvis-queue";
import { commitCareerStepForJob, getCareerCaseForJob, getCareerWorkForJob, recordCareerFailureForJob } from "@/lib/repos/career";
import { fetchOfficialCareerSourceForJob, extractCareerRequirementsForJob } from "@/lib/repos/career-sources";
import { isOfficialCareerUrl } from "./url";
import { isRecord } from "./profile";

export const isCareerEvent = (event: unknown) => typeof event === "string" && (event.startsWith("career.") || event === "opportunity.source_changed");

/** Injectable external boundaries are used by isolated gates, never HTTP input. */
export async function processCareerRun(run: AgentRun, workerId: string, services = {
  fetch: fetchOfficialCareerSourceForJob,
  extract: extractCareerRequirementsForJob,
}): Promise<JarvisStepResult> {
  if (!isRecord(run.state) || typeof run.state.sourceId !== "string") throw new Error("커리어 trigger가 없습니다.");
  const state = run.state;
  const sourceId = state.sourceId as string;
  const eventType = state.eventType;
  if (eventType === "career.application_started") {
    const application = await getCareerCaseForJob(sourceId);
    const { opportunity } = await getCareerWorkForJob(application.opportunity_id);
    if (opportunity.assessment.status !== "act_now" || opportunity.decision !== "none" || application.stage !== "preparing") throw new Error("현재 자격·지원 상태를 다시 확인해야 합니다.");
    const proposal: ProposedAction = {
      type: "CREATE_TASK", title: application.next_action,
      explanation: `${opportunity.organization} · ${opportunity.title} 지원 준비입니다. 제출·전송·일정 등록은 실행하지 않습니다.`,
      payload: { title: application.next_action, notes: `${opportunity.canonicalUrl}\n지원 케이스: ${application.id}`, dueAt: application.due_at,
        category: "career", priority: 70, estimatedMinutes: 30 },
      riskLevel: "low", idempotencyKey: `career:application:${application.id}:prepare:v1`,
    };
    await advanceAgentRunForJob({ runId: run.id, workerId, expectedStep: "classify", status: "planning", nextStep: "prepare_approval",
      state: { ...state, classification: { status: "act_now", summary: opportunity.title, reason: proposal.explanation, proposedAction: proposal } } as JsonValue });
    return { kind: "classified", runId: run.id };
  }
  const { opportunity, row, company } = await getCareerWorkForJob(sourceId);
  try {
    if (eventType === "career.refresh") {
      let result = isOfficialCareerUrl(row.canonical_url, company.officialPrefixes)
        ? await services.fetch(row.canonical_url, { etag: row.etag, lastModified: row.last_modified })
        : { kind: "unavailable" as const, error: "등록된 공식 주소 범위가 아닙니다.", url: row.canonical_url };
      if (!isOfficialCareerUrl(result.url, company.officialPrefixes)) result = { kind: "unavailable", error: "공식 주소 밖으로 이동한 공고입니다. 주소를 다시 확인하세요.", url: result.url };
      const cadence = company.tier === 1 ? 7 : company.tier === 2 ? 30 : 1;
      const nextCheckAt = new Date(Date.now() + (result.kind === "unavailable" ? 1 : cadence * 24) * 3_600_000).toISOString();
      const committed = await commitCareerStepForJob({ runId: run.id, workerId, opportunityId: row.id, revision: row.revision, kind: "source", data: {
        ...result, nextCheckAt, ...(result.url !== row.canonical_url ? { etag: null, lastModified: null } : {}),
      } });
      if (!committed) return { kind: "career_step", runId: run.id, message: "더 최신인 공고 검토를 유지했습니다." };
      return { kind: result.kind === "unavailable" ? "failed" : "career_step", runId: run.id, ...(result.kind === "unavailable" ? { message: result.error } : {}) };
    }
    if (eventType === "opportunity.source_changed") {
      if (row.source_reviewed || (row.extracted_source_id === row.current_source_id && !row.last_error)) {
        await advanceAgentRunForJob({ runId: run.id, workerId, expectedStep: "classify", status: "completed", nextStep: "done", finished: true, output: { skipped: "already_extracted_or_reviewed" } });
        return { kind: "completed", runId: run.id };
      }
      if (!opportunity.source?.available || !opportunity.source.official) throw new Error("추출할 최신 공식 원문이 없습니다.");
      const extracted = await services.extract(opportunity.source.text, opportunity.source.id, opportunity.canonicalUrl);
      await commitCareerStepForJob({ runId: run.id, workerId, opportunityId: row.id, revision: row.revision, kind: "extraction", data: extracted });
      return { kind: "career_step", runId: run.id };
    }
    throw new Error("지원하지 않는 커리어 이벤트입니다.");
  } catch (error) {
    await recordCareerFailureForJob(row.id, row.revision, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
