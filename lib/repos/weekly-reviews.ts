import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { addDays, weekStartMonday, ymd } from "@/lib/time";
import { buildWeeklyStats, type WeeklyStats } from "@/lib/weekly-stats";
import type { Json } from "@/lib/types/database";

export type WeeklyNarrative = {
  headline: string;
  paragraphs: string[];
  next_week_focus: string;
};

export type WeeklyReviewContent = {
  stats: WeeklyStats;
  narrative: WeeklyNarrative;
  upcoming: { tasks: string[]; events: string[] };
};

export type WeeklyReviewRow = {
  weekStart: string;
  status: "pending" | "ready" | "failed";
  content: WeeklyReviewContent | null;
};

/** 잡 전용. 이번 주(월~일, JST) 숫자를 SQL에서 모은다. */
export async function collectWeeklyStatsForJob(now: Date = new Date()): Promise<{
  stats: WeeklyStats;
  upcoming: { tasks: string[]; events: string[] };
}> {
  const start = weekStartMonday(now);
  const end = addDays(start, 7);
  const nextEnd = addDays(end, 7);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const startDate = ymd(start);
  const endDate = ymd(end);
  const supabase = createAdminClient();

  const [attempts, created, completed, commits, upcomingTasks, upcomingEvents] = await Promise.all([
    supabase
      .from("quiz_attempts")
      .select("is_correct, quiz_questions!inner(domain)")
      .gte("attempted_at", startIso)
      .lt("attempted_at", endIso),
    supabase.from("tasks").select("id", { count: "exact", head: true }).gte("created_at", startIso).lt("created_at", endIso),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "done")
      .gte("completed_at", startIso)
      .lt("completed_at", endIso),
    supabase
      .from("github_daily_commits")
      .select("commit_count")
      .gte("as_of", startDate)
      .lt("as_of", endDate),
    supabase
      .from("tasks")
      .select("title")
      .eq("status", "open")
      .not("due_at", "is", null)
      .gte("due_at", endIso)
      .lt("due_at", nextEnd.toISOString())
      .order("due_at", { ascending: true })
      .limit(8),
    supabase
      .from("events")
      .select("summary")
      .gte("starts_at", endIso)
      .lt("starts_at", nextEnd.toISOString())
      .order("starts_at", { ascending: true })
      .limit(8),
  ]);

  if (attempts.error) throw new Error(`퀴즈 집계 실패: ${attempts.error.message}`);
  if (created.error) throw new Error(`태스크 생성 집계 실패: ${created.error.message}`);
  if (completed.error) throw new Error(`태스크 완료 집계 실패: ${completed.error.message}`);
  if (commits.error) throw new Error(`커밋 집계 실패: ${commits.error.message}`);
  if (upcomingTasks.error) throw new Error(`다음 주 태스크 조회 실패: ${upcomingTasks.error.message}`);
  if (upcomingEvents.error) throw new Error(`다음 주 일정 조회 실패: ${upcomingEvents.error.message}`);

  const attemptRows = (attempts.data ?? []).map((row) => {
    const question = row.quiz_questions as unknown as { domain: string };
    return { domain: question.domain, isCorrect: row.is_correct };
  });

  return {
    stats: buildWeeklyStats({
      weekStart: startDate,
      weekEnd: endDate,
      attempts: attemptRows,
      tasksCreated: created.count ?? 0,
      tasksCompleted: completed.count ?? 0,
      commitDays: (commits.data ?? []).map((d) => ({ commitCount: d.commit_count })),
    }),
    upcoming: {
      tasks: (upcomingTasks.data ?? []).map((t) => t.title),
      events: (upcomingEvents.data ?? []).map((e) => e.summary),
    },
  };
}

export async function getWeeklyReviewForJob(weekStart: string): Promise<WeeklyReviewRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("week_start, status, content")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw new Error(`주간 리뷰 조회 실패: ${error.message}`);
  if (!data) return null;
  return {
    weekStart: data.week_start,
    status: data.status as WeeklyReviewRow["status"],
    content: (data.content as WeeklyReviewContent | null) ?? null,
  };
}

export async function saveWeeklyReviewForJob(
  weekStart: string,
  status: "ready" | "failed",
  content: WeeklyReviewContent | null,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("weekly_reviews").upsert(
    { week_start: weekStart, status, content: content as Json | null },
    { onConflict: "week_start" },
  );
  if (error) throw new Error(`주간 리뷰 저장 실패: ${error.message}`);
}

/** UI용. 최신 ready 1건. */
export async function latestWeeklyReview(): Promise<WeeklyReviewRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("week_start, status, content")
    .eq("status", "ready")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`주간 리뷰 조회 실패: ${error.message}`);
  if (!data) return null;
  return {
    weekStart: data.week_start,
    status: "ready",
    content: (data.content as WeeklyReviewContent | null) ?? null,
  };
}
