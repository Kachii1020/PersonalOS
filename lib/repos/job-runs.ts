import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createUserClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

/**
 * 잡 실행 로그. sync_state가 "지금 상태"라면 job_runs는 "실행 이력"이다.
 * 부분 실패(소스 5개 중 1개 실패)는 여기 meta에 남는다.
 */
export async function recordJobRun(input: {
  jobName: string;
  startedAt: Date;
  status: "ok" | "failed";
  error?: string | null;
  meta?: Json;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("job_runs").insert({
    job_name: input.jobName,
    started_at: input.startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    status: input.status,
    error: input.error ?? null,
    meta: input.meta ?? null,
  });
  if (error) console.error(`[job-runs] ${input.jobName} 기록 실패:`, error.message);
}

export type JobRun = {
  id: number;
  jobName: string;
  startedAt: string;
  finishedAt: string | null;
  status: "ok" | "failed" | null;
  error: string | null;
};

/** UI용 조회. 최근 실행 이력. */
export async function listRecentJobRuns(limit = 20): Promise<JobRun[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("job_runs")
    .select("id, job_name, started_at, finished_at, status, error")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`잡 실행 이력 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    jobName: r.job_name,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status as JobRun["status"],
    error: r.error,
  }));
}
