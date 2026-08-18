import { NextResponse, type NextRequest } from "next/server";
import { callStructured, AiParseError, AiRefusalError } from "@/lib/ai/client";
import { BudgetExceededError } from "@/lib/ai/budget";
import {
  WEEKLY_REVIEW_SCHEMA,
  WEEKLY_REVIEW_SYSTEM,
  buildWeeklyReviewPrompt,
  type WeeklyReviewPayload,
} from "@/lib/ai/prompts/weekly-review";
import {
  collectWeeklyStatsForJob,
  getWeeklyReviewForJob,
  saveWeeklyReviewForJob,
} from "@/lib/repos/weekly-reviews";
import { recordJobRun } from "@/lib/repos/job-runs";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";
import { weekStartMonday, ymd } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * 주간 리뷰 (SPEC.md 5.5). 집계는 SQL, AI는 서술 1회.
 */
export async function POST(request: NextRequest) {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date();
  const weekStart = ymd(weekStartMonday(startedAt));

  try {
    const existing = await getWeeklyReviewForJob(weekStart);
    if (existing?.status === "ready") {
      await recordJobRun({
        jobName: "generate-weekly-review",
        startedAt,
        status: "ok",
        meta: { weekStart, skipped: true },
      });
      return NextResponse.json({ weekStart, skipped: true });
    }

    const { stats, upcoming } = await collectWeeklyStatsForJob(startedAt);
    const result = await callStructured<WeeklyReviewPayload>({
      purpose: "weekly_review",
      system: WEEKLY_REVIEW_SYSTEM,
      userMessage: buildWeeklyReviewPrompt(stats, upcoming),
      schema: WEEKLY_REVIEW_SCHEMA,
      effort: "low",
      retries: 1,
    });

    const narrative = result.data;
    if (!narrative.headline || !Array.isArray(narrative.paragraphs)) {
      throw new AiParseError("주간 리뷰 서술이 비어 있습니다", "");
    }

    await saveWeeklyReviewForJob(weekStart, "ready", {
      stats,
      narrative: {
        headline: narrative.headline,
        paragraphs: narrative.paragraphs,
        next_week_focus: narrative.next_week_focus,
      },
      upcoming,
    });

    await recordJobRun({
      jobName: "generate-weekly-review",
      startedAt,
      status: "ok",
      meta: {
        weekStart,
        quizAccuracy: stats.quiz.accuracyPct,
        tasksCompleted: stats.tasks.completed,
        commits: stats.commits.total,
        costUsd: result.costUsd,
      },
    });

    return NextResponse.json({
      weekStart,
      skipped: false,
      stats,
      model: result.model,
      costUsd: result.costUsd,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!(e instanceof BudgetExceededError)) {
      try {
        await saveWeeklyReviewForJob(weekStart, "failed", null);
      } catch (saveError) {
        console.error("[weekly-review] 실패 기록 저장 실패:", saveError);
      }
    }
    await recordJobRun({
      jobName: "generate-weekly-review",
      startedAt,
      status: "failed",
      error: message,
      meta: { weekStart, kind: e instanceof Error ? e.name : "Unknown" },
    });

    const status = e instanceof BudgetExceededError ? 402 : 500;
    return NextResponse.json(
      { error: message, kind: e instanceof AiRefusalError ? "refusal" : e instanceof Error ? e.name : "Unknown" },
      { status },
    );
  }
}
