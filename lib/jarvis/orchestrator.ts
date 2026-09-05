import "server-only";
import { classifyCapture } from "./capture";
import { sendPush } from "@/lib/integrations/push/send";
import type { CaptureClassification, JsonValue } from "./types";
import { createApprovalForJob } from "@/lib/repos/jarvis-approvals";
import { getInboxItemForJob, saveInboxClassificationForJob } from "@/lib/repos/jarvis-inbox";
import {
  advanceAgentRunForJob,
  claimNextAgentRunForJob,
  claimNextSystemEventForJob,
  createAgentRunForEventForJob,
  failAgentRunForJob,
  failSystemEventForJob,
  markSystemEventProcessedForJob,
} from "@/lib/repos/jarvis-queue";

export type JarvisStepResult = {
  kind: "idle" | "run_started" | "classified" | "approval_prepared" | "completed" | "failed";
  runId?: string;
  eventId?: string;
  approvalId?: string;
  message?: string;
};

type RunState = {
  sourceId?: string | null;
  eventType?: string;
  inboxItemId?: string;
  classification?: CaptureClassification;
};

function asRunState(value: JsonValue): RunState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as RunState;
}

export async function processJarvisStep(workerId: string): Promise<JarvisStepResult> {
  const run = await claimNextAgentRunForJob(workerId);
  if (!run) {
    const event = await claimNextSystemEventForJob(workerId);
    if (!event) return { kind: "idle" };
    try {
      const created = await createAgentRunForEventForJob(event);
      await markSystemEventProcessedForJob(event.id, workerId);
      return { kind: "run_started", runId: created.id, eventId: event.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failSystemEventForJob(event.id, workerId, message);
      return { kind: "failed", eventId: event.id, message };
    }
  }

  try {
    if (run.currentStep === "classify") {
      const state = asRunState(run.state);
      if (state.eventType !== "inbox.created" || !state.sourceId) {
        throw new Error(`지원하지 않는 trigger: ${state.eventType ?? "unknown"}`);
      }
      const inbox = await getInboxItemForJob(state.sourceId);
      if (!inbox) throw new Error("trigger가 가리키는 인박스 항목이 없습니다.");

      const classification = classifyCapture({
        id: inbox.id,
        kind: inbox.kind,
        rawText: inbox.rawText,
        sourceUrl: inbox.sourceUrl,
      });
      await saveInboxClassificationForJob(inbox.id, classification);

      const nextState: RunState = {
        ...state,
        inboxItemId: inbox.id,
        classification,
      };

      if (!classification.proposedAction) {
        await advanceAgentRunForJob({
          runId: run.id,
          workerId,
          expectedStep: "classify",
          status: "completed",
          nextStep: "done",
          state: nextState as JsonValue,
          output: classification as unknown as JsonValue,
          finished: true,
        });
        return { kind: "completed", runId: run.id };
      }

      await advanceAgentRunForJob({
        runId: run.id,
        workerId,
        expectedStep: "classify",
        status: "planning",
        nextStep: "prepare_approval",
        state: nextState as JsonValue,
      });
      return { kind: "classified", runId: run.id };
    }

    if (run.currentStep === "prepare_approval") {
      const state = asRunState(run.state);
      const proposal = state.classification?.proposedAction;
      if (!proposal) throw new Error("승인 요청으로 바꿀 proposed action이 없습니다.");

      const approval = await createApprovalForJob(run.id, proposal, workerId);
      await sendPush({
        title: "JARVIS 승인 필요",
        body: proposal.title,
        url: "/approvals",
      });
      return { kind: "approval_prepared", runId: run.id, approvalId: approval.id };
    }

    throw new Error(`처리할 수 없는 run step: ${run.currentStep}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failAgentRunForJob(run.id, workerId, message);
    return { kind: "failed", runId: run.id, message };
  }
}

export async function processJarvisSteps(input: {
  workerId: string;
  maxSteps?: number;
}): Promise<JarvisStepResult[]> {
  const maxSteps = Math.max(1, Math.min(input.maxSteps ?? 3, 10));
  const results: JarvisStepResult[] = [];
  for (let index = 0; index < maxSteps; index++) {
    const result = await processJarvisStep(input.workerId);
    results.push(result);
    if (result.kind === "idle" || result.kind === "failed" || result.kind === "approval_prepared") break;
  }
  return results;
}
