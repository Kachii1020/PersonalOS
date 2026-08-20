import "server-only";
import { createClient } from "@/lib/supabase/server";
import { streakFrom } from "@/lib/streaks";
import { addDays, todayStart, ymd } from "@/lib/time";

/** 연속 일수 (1-A). 기존 테이블만 읽는다 — 스트릭 전용 저장소는 없다. */

export type StreakData = {
  quiz: number;
  briefing: number;
  commits: number;
};

const LOOKBACK_DAYS = 90;

export async function getStreaks(now: Date = new Date()): Promise<StreakData> {
  const supabase = await createClient();
  const since = addDays(todayStart(now), -LOOKBACK_DAYS).toISOString();
  const sinceYmd = ymd(new Date(since));

  const [attempts, briefings, commits] = await Promise.all([
    supabase.from("quiz_attempts").select("attempted_at").gte("attempted_at", since),
    supabase
      .from("briefings")
      .select("briefing_date, status")
      .eq("status", "ready")
      .gte("briefing_date", sinceYmd),
    supabase
      .from("github_daily_commits")
      .select("as_of, commit_count")
      .gt("commit_count", 0)
      .gte("as_of", sinceYmd),
  ]);

  if (attempts.error) throw new Error(`퀴즈 기록 조회 실패: ${attempts.error.message}`);
  if (briefings.error) throw new Error(`브리핑 조회 실패: ${briefings.error.message}`);
  if (commits.error) throw new Error(`커밋 조회 실패: ${commits.error.message}`);

  return {
    quiz: streakFrom(new Set((attempts.data ?? []).map((r) => ymd(new Date(r.attempted_at)))), now),
    briefing: streakFrom(new Set((briefings.data ?? []).map((r) => r.briefing_date)), now),
    commits: streakFrom(new Set((commits.data ?? []).map((r) => r.as_of)), now),
  };
}
