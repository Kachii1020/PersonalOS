import { NextResponse, type NextRequest } from "next/server";
import { callStructured, AiParseError, AiRefusalError } from "@/lib/ai/client";
import { BudgetExceededError } from "@/lib/ai/budget";
import { QUIZ_SCHEMA, QUIZ_SYSTEM, buildQuizPrompt, shuffleChoices, type QuizPayload } from "@/lib/ai/prompts/quiz";
import {
  dueReviewQuestionIdsForJob,
  insertQuizQuestions,
  recentQuestionTextsForJob,
} from "@/lib/repos/quiz";
import { recordJobRun } from "@/lib/repos/job-runs";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 하루치 퀴즈 문항 수 (SPEC.md 5.5). */
const QUIZ_SIZE = 5;

/**
 * 오늘의 퀴즈 생성 (SPEC.md 5.5).
 *
 * 복습 예정 문항이 오늘 자리를 먼저 차지하고, 모자란 만큼만 새로 만든다.
 * 복습만으로 5문제가 차면 AI를 부르지 않는다 — 예산을 아끼는 지점이다.
 */
export async function POST(request: NextRequest) {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date();

  try {
    const dueIds = await dueReviewQuestionIdsForJob(startedAt);
    const needed = Math.max(0, QUIZ_SIZE - dueIds.length);

    if (needed === 0) {
      await recordJobRun({
        jobName: "generate-quiz",
        startedAt,
        status: "ok",
        meta: { reviewDue: dueIds.length, generated: 0, aiCalled: false },
      });
      return NextResponse.json({ reviewDue: dueIds.length, generated: 0, aiCalled: false });
    }

    const avoid = await recentQuestionTextsForJob();
    const result = await callStructured<QuizPayload>({
      purpose: "quiz",
      system: QUIZ_SYSTEM,
      userMessage: buildQuizPrompt(needed, avoid),
      schema: QUIZ_SCHEMA,
      effort: "low",
      retries: 1,
    });

    const questions = result.data.questions ?? [];

    // 스키마로 잡히지 않는 것들: 개수, 보기 4개, 정답 인덱스 범위.
    const valid = questions.filter(
      (q) =>
        q.choices.length === 4 &&
        Number.isInteger(q.answer_index) &&
        q.answer_index >= 0 &&
        q.answer_index < q.choices.length,
    );
    if (valid.length === 0) throw new AiParseError("쓸 수 있는 문항이 없습니다", "");

    // 모델이 정답을 첫 보기에 두는 경향이 있어 저장 전에 섞는다.
    const shuffled = valid.map((q) => shuffleChoices(q));

    const domains = new Set(shuffled.map((q) => q.domain));
    const inserted = await insertQuizQuestions(shuffled);

    await recordJobRun({
      jobName: "generate-quiz",
      startedAt,
      status: "ok",
      meta: {
        reviewDue: dueIds.length,
        generated: inserted,
        rejected: questions.length - valid.length,
        domains: [...domains],
        costUsd: result.costUsd,
      },
    });

    return NextResponse.json({
      reviewDue: dueIds.length,
      generated: inserted,
      rejected: questions.length - valid.length,
      domains: [...domains],
      aiCalled: true,
      model: result.model,
      costUsd: result.costUsd,
      attempts: result.attempts,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordJobRun({ jobName: "generate-quiz", startedAt, status: "failed", error: message });

    const status = e instanceof BudgetExceededError ? 402 : 500;
    return NextResponse.json(
      { error: message, kind: e instanceof AiRefusalError ? "refusal" : e instanceof Error ? e.name : "Unknown" },
      { status },
    );
  }
}
