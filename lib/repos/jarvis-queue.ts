import "server-only";
import { createAdminClient as createJarvisAdminClient } from "@/lib/supabase/admin";
import type { AgentRun, SystemEvent } from "@/lib/jarvis/db-types";
import type { JsonValue } from "@/lib/jarvis/types";

type EventRow = {
  id: string;
  event_type: string;
  source_type: string;
  source_id: string | null;
  payload: JsonValue;
  dedupe_key: string;
  status: SystemEvent["status"];
  attempts: number;
  locked_by: string | null;
  locked_until: string | null;
  error: string | null;
};

type RunRow = {
  id: string;
  run_type: string;
  trigger_event_id: string;
  status: AgentRun["status"];
  current_step: string;
  state: JsonValue;
  output: JsonValue | null;
  attempts: number;
  locked_by: string | null;
  error: string | null;
};

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null;
  return (data as T | null) ?? null;
}

function mapEvent(row: EventRow): SystemEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    payload: row.payload,
    dedupeKey: row.dedupe_key,
    status: row.status,
    attempts: row.attempts,
    lockedBy: row.locked_by,
    lockedUntil: row.locked_until,
    error: row.error,
  };
}

function mapRun(row: RunRow): AgentRun {
  return {
    id: row.id,
    runType: row.run_type,
    triggerEventId: row.trigger_event_id,
    status: row.status,
    currentStep: row.current_step,
    state: row.state,
    output: row.output,
    attempts: row.attempts,
    lockedBy: row.locked_by,
    error: row.error,
  };
}

export async function claimNextSystemEventForJob(workerId: string): Promise<SystemEvent | null> {
  const supabase = createJarvisAdminClient();
  const { data, error } = await supabase.rpc("claim_next_system_event", {
    p_worker_id: workerId,
    p_lease_seconds: 90,
  });
  if (error) throw new Error(`시스템 이벤트 claim 실패: ${error.message}`);
  const row = firstRow<EventRow>(data);
  return row ? mapEvent(row) : null;
}

export async function claimNextAgentRunForJob(workerId: string): Promise<AgentRun | null> {
  const supabase = createJarvisAdminClient();
  const { data, error } = await supabase.rpc("claim_next_agent_run", {
    p_worker_id: workerId,
    p_lease_seconds: 90,
  });
  if (error) throw new Error(`에이전트 실행 claim 실패: ${error.message}`);
  const row = firstRow<RunRow>(data);
  return row ? mapRun(row) : null;
}

export async function createAgentRunForEventForJob(event: SystemEvent): Promise<AgentRun> {
  const supabase = createJarvisAdminClient();
  const payload = {
    run_type: event.eventType,
    trigger_event_id: event.id,
    status: "queued",
    current_step: "classify",
    state: { sourceId: event.sourceId, eventType: event.eventType },
  };
  const { data, error } = await supabase.from("agent_runs").insert(payload).select("*").maybeSingle();
  if (!error && data) return mapRun(data as RunRow);
  if (error?.code !== "23505") throw new Error(`에이전트 실행 생성 실패: ${error?.message ?? "결과 없음"}`);

  const existing = await supabase
    .from("agent_runs")
    .select("*")
    .eq("trigger_event_id", event.id)
    .single();
  if (existing.error) throw new Error(`기존 에이전트 실행 조회 실패: ${existing.error.message}`);
  return mapRun(existing.data as RunRow);
}

export async function markSystemEventProcessedForJob(id: string, workerId: string): Promise<void> {
  const supabase = createJarvisAdminClient();
  const { error } = await supabase
    .from("system_events")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      locked_by: null,
      locked_until: null,
      error: null,
    })
    .eq("id", id)
    .eq("locked_by", workerId);
  if (error) throw new Error(`시스템 이벤트 완료 처리 실패: ${error.message}`);
}

export async function failSystemEventForJob(id: string, workerId: string, message: string): Promise<void> {
  const supabase = createJarvisAdminClient();
  const { error } = await supabase
    .from("system_events")
    .update({ status: "failed", error: message, locked_by: null, locked_until: null })
    .eq("id", id)
    .eq("locked_by", workerId);
  if (error) console.error("[jarvis] 시스템 이벤트 실패 기록 실패:", error.message);
}

export async function advanceAgentRunForJob(input: {
  runId: string;
  workerId: string;
  expectedStep: string;
  status: AgentRun["status"];
  nextStep: string;
  state?: JsonValue;
  output?: JsonValue | null;
  finished?: boolean;
}): Promise<void> {
  const supabase = createJarvisAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("agent_runs")
    .update({
      status: input.status,
      current_step: input.nextStep,
      ...(input.state === undefined ? {} : { state: input.state }),
      ...(input.output === undefined ? {} : { output: input.output }),
      attempts: 0,
      updated_at: now,
      finished_at: input.finished ? now : null,
      locked_by: null,
      locked_until: null,
      error: null,
    })
    .eq("id", input.runId)
    .eq("current_step", input.expectedStep)
    .eq("locked_by", input.workerId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`에이전트 실행 갱신 실패: ${error.message}`);
  if (!data) throw new Error("에이전트 실행 단계가 이미 변경되었습니다.");
}

export async function failAgentRunForJob(runId: string, workerId: string, message: string): Promise<void> {
  const supabase = createJarvisAdminClient();
  const { error } = await supabase
    .from("agent_runs")
    .update({
      status: "failed",
      error: message,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      locked_by: null,
      locked_until: null,
    })
    .eq("id", runId)
    .eq("locked_by", workerId);
  if (error) console.error("[jarvis] 에이전트 실행 실패 기록 실패:", error.message);
}
