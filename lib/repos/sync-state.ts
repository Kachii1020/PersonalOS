import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

export type SyncKey = "caldav" | "rss" | "prices" | "github";

export type SyncState = {
  key: string;
  lastRunAt: string | null;
  lastStatus: "ok" | "failed" | null;
  lastError: string | null;
};

/**
 * 잡 결과 기록 (SPEC.md 5.1 절대 규칙 5).
 * 실패를 조용히 넘기지 않기 위한 곳이라 이 함수 자체는 예외를 던지지 않는다 —
 * 기록에 실패했다고 잡을 다시 실패시키면 원인이 가려진다.
 */
export async function recordSync(
  key: SyncKey,
  result: { status: "ok" | "failed"; error?: string | null; cursor?: Json },
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("sync_state").upsert({
    key,
    last_run_at: new Date().toISOString(),
    last_status: result.status,
    last_error: result.error ?? null,
    cursor: result.cursor ?? null,
  });
  if (error) console.error(`[sync-state] ${key} 기록 실패:`, error.message);
}

/** UI용 조회. 세션 클라이언트를 쓰므로 RLS가 적용된다. */
export async function listSyncStates(): Promise<SyncState[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sync_state")
    .select("key, last_run_at, last_status, last_error");

  if (error) throw new Error(`동기화 상태 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => ({
    key: row.key,
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status === "ok" || row.last_status === "failed" ? row.last_status : null,
    lastError: row.last_error,
  }));
}
