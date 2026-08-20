import { NextResponse, type NextRequest } from "next/server";
import { callStructured, AiRefusalError, AiParseError } from "@/lib/ai/client";
import { BudgetExceededError } from "@/lib/ai/budget";
import {
  BRIEFING_SCHEMA,
  BRIEFING_SYSTEM,
  buildBriefingPrompt,
  resolveSources,
  type BriefingPayload,
} from "@/lib/ai/prompts/briefing";
import { listRecentNewsForJob } from "@/lib/repos/news";
import { completeBriefing, failBriefing, startBriefing } from "@/lib/repos/briefings";
import { recordJobRun } from "@/lib/repos/job-runs";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";
import { sendPush } from "@/lib/integrations/push/send";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 브리핑에 넣을 기사 수. 섹터×언어 15조합에 대해 조합당 5건 정도가 된다. */
const NEWS_LIMIT = 75;

/**
 * 하루치 브리핑 생성 (SPEC.md 5.5).
 *
 * AI 호출은 정확히 1회다. 5개 섹터를 섹터당 1회씩 부르면 반려 사유가 된다.
 */
export async function POST(request: NextRequest) {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date();
  const briefingDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(startedAt);

  let briefingId: string | null = null;

  try {
    const news = await listRecentNewsForJob(NEWS_LIMIT);
    if (news.length === 0) {
      throw new Error("수집된 뉴스가 없습니다. fetch-news를 먼저 실행하세요.");
    }

    briefingId = await startBriefing(briefingDate);

    // URL은 프롬프트에 넣지 않고 기사 번호로 보낸다. 응답의 번호를 여기서 URL로 되돌린다.
    const { prompt, urls } = buildBriefingPrompt(news, startedAt);

    const result = await callStructured<BriefingPayload>({
      purpose: "briefing",
      system: BRIEFING_SYSTEM,
      userMessage: prompt,
      schema: BRIEFING_SCHEMA,
      effort: "low",
      retries: 1, // 파싱 실패 시 1회만 (SPEC.md 5.5)
    });

    const sections = (result.data.sections ?? []).map((section) => resolveSources(section, urls));
    if (sections.length === 0) throw new AiParseError("섹션이 비어 있습니다", "");

    await completeBriefing(briefingId, sections, {
      inputToken: result.inputToken,
      outputToken: result.outputToken,
      costUsd: result.costUsd,
    });

    const push = await sendPush(
      {
        title: "오늘의 브리핑",
        body: `섹션 ${sections.length}개가 준비됐습니다.`,
        url: "/briefing",
      },
      "briefing",
    );

    await recordJobRun({
      jobName: "generate-briefing",
      startedAt,
      status: "ok",
      meta: {
        date: briefingDate,
        sections: sections.length,
        newsItems: news.length,
        costUsd: result.costUsd,
        attempts: result.attempts,
        push,
      },
    });

    return NextResponse.json({
      date: briefingDate,
      sections: sections.length,
      newsItems: news.length,
      model: result.model,
      inputToken: result.inputToken,
      outputToken: result.outputToken,
      costUsd: result.costUsd,
      attempts: result.attempts,
    });
  } catch (e) {
    if (briefingId) await failBriefing(briefingId);

    const message = e instanceof Error ? e.message : String(e);
    await recordJobRun({
      jobName: "generate-briefing",
      startedAt,
      status: "failed",
      error: message,
      meta: { date: briefingDate, kind: e instanceof Error ? e.name : "Unknown" },
    });

    // 예산 초과는 장애가 아니라 정상적인 차단이다. 크론을 빨갛게 만들지 않는다.
    const status = e instanceof BudgetExceededError ? 402 : 500;
    return NextResponse.json(
      { error: message, kind: e instanceof AiRefusalError ? "refusal" : e instanceof Error ? e.name : "Unknown" },
      { status },
    );
  }
}
