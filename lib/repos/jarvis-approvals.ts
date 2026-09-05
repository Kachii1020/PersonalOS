import "server-only";
import { createAdminClient as createJarvisAdminClient } from "@/lib/supabase/admin";
import { createClient as createJarvisUserClient } from "@/lib/supabase/server";
import type { ApprovalRequest } from "@/lib/jarvis/db-types";
import type { BriefApproval, JsonValue, ProposedAction } from "@/lib/jarvis/types";

type ApprovalRow = {
  id: string;
  agent_run_id: string | null;
  action_type: string;
  title: string;
  explanation: string;
  payload: JsonValue;
  risk_level: ApprovalRequest["riskLevel"];
  status: ApprovalRequest["status"];
  idempotency_key: string;
  requested_at: string;
  expires_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
  executed_at: string | null;
  result: JsonValue | null;
  error: string | null;
};

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null;
  return (data as T | null) ?? null;
}

function mapApproval(row: ApprovalRow): ApprovalRequest {
  const expired =
    (row.status === "pending" || row.status === "approved") &&
    row.expires_at !== null &&
    new Date(row.expires_at).getTime() <= Date.now();
  return {
    id: row.id,
    agentRunId: row.agent_run_id,
    actionType: row.action_type,
    title: row.title,
    explanation: row.explanation,
    payload: row.payload,
    riskLevel: row.risk_level,
    status: expired ? "expired" : row.status,
    idempotencyKey: row.idempotency_key,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    executedAt: row.executed_at,
    result: row.result,
    error: row.error,
  };
}

export async function createApprovalForJob(
  runId: string,
  proposal: ProposedAction,
  workerId: string,
): Promise<ApprovalRequest> {
  const supabase = createJarvisAdminClient();
  const { data, error } = await supabase.rpc("prepare_jarvis_approval", {
    p_run_id: runId,
    p_worker_id: workerId,
    p_proposal: proposal,
  });
  if (error) throw new Error(`승인 요청 생성 실패: ${error.message}`);
  const row = firstRow<ApprovalRow>(data);
  if (!row) throw new Error("승인 요청 생성 결과가 없습니다.");
  return mapApproval(row);
}

export async function listApprovalRequests(limit = 50): Promise<ApprovalRequest[]> {
  const supabase = await createJarvisUserClient();
  const { data, error } = await supabase
    .from("approval_requests")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`승인 요청 조회 실패: ${error.message}`);
  return ((data ?? []) as ApprovalRow[]).map(mapApproval);
}

export async function listPendingApprovalsForJob(limit = 20): Promise<BriefApproval[]> {
  const supabase = createJarvisAdminClient();
  const { data, error } = await supabase
    .from("approval_requests")
    .select("id, title, action_type, requested_at")
    .eq("status", "pending")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("requested_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`대기 승인 조회 실패: ${error.message}`);
  return ((data ?? []) as { id: string; title: string; action_type: string; requested_at: string }[]).map(
    (row) => ({ id: row.id, title: row.title, actionType: row.action_type, requestedAt: row.requested_at }),
  );
}

export async function decideApproval(
  approvalId: string,
  decision: "approved" | "rejected",
  note: string | null,
): Promise<ApprovalRequest> {
  const supabase = await createJarvisUserClient();
  const { data, error } = await supabase.rpc("decide_approval", {
    p_approval_id: approvalId,
    p_decision: decision,
    p_note: note ?? undefined,
  });
  if (error) throw new Error(`승인 결정 실패: ${error.message}`);
  const row = firstRow<ApprovalRow>(data);
  if (!row) throw new Error("승인 결정 결과가 없습니다.");
  return mapApproval(row);
}

export async function claimNextApprovedActionForJob(workerId: string): Promise<ApprovalRequest | null> {
  const supabase = createJarvisAdminClient();
  const { data, error } = await supabase.rpc("claim_next_approved_action", {
    p_worker_id: workerId,
    p_lease_seconds: 90,
  });
  if (error) throw new Error(`승인 작업 claim 실패: ${error.message}`);
  const row = firstRow<ApprovalRow>(data);
  return row ? mapApproval(row) : null;
}

export async function claimApprovedActionByIdForJob(
  approvalId: string,
  workerId: string,
): Promise<ApprovalRequest | null> {
  const supabase = createJarvisAdminClient();
  const { data, error } = await supabase.rpc("claim_approved_action_by_id", {
    p_approval_id: approvalId,
    p_worker_id: workerId,
    p_lease_seconds: 90,
  });
  if (error) throw new Error(`지정 승인 작업 claim 실패: ${error.message}`);
  const row = firstRow<ApprovalRow>(data);
  return row ? mapApproval(row) : null;
}

export async function createTaskForApprovalForJob(
  approvalId: string,
  workerId: string,
): Promise<{ id: string; title: string }> {
  const supabase = createJarvisAdminClient();
  const { data, error } = await supabase.rpc("execute_approved_task", {
    p_approval_id: approvalId,
    p_worker_id: workerId,
  });
  if (error) throw new Error(`승인 할 일 실행 실패: ${error.message}`);
  const task = firstRow<{ id: string; title: string }>(data);
  if (!task) throw new Error("생성된 할 일이 없습니다.");
  return task;
}

export async function completeApprovalForJob(approvalId: string, workerId: string, result: JsonValue): Promise<void> {
  const supabase = createJarvisAdminClient();
  const { error } = await supabase.rpc("complete_approval_execution", {
    p_approval_id: approvalId,
    p_worker_id: workerId,
    p_result: result,
  });
  if (error) throw new Error(`승인 실행 완료 기록 실패: ${error.message}`);
}

export async function failApprovalForJob(approvalId: string, workerId: string, message: string): Promise<void> {
  const supabase = createJarvisAdminClient();
  const { error } = await supabase.rpc("fail_approval_execution", {
    p_approval_id: approvalId,
    p_worker_id: workerId,
    p_error: message,
  });
  if (error) console.error("[jarvis] 승인 실행 실패 기록 실패:", error.message);
}

export async function appendAuditForJob(
  approvalId: string,
  event: "requested" | "approved" | "rejected" | "executing" | "executed" | "verified" | "failed",
  actor: "jarvis" | "user" | "worker" | "system",
  detail: JsonValue,
): Promise<void> {
  const supabase = createJarvisAdminClient();
  const { error } = await supabase.from("action_audit_logs").insert({
    approval_request_id: approvalId,
    event,
    actor,
    detail,
  });
  if (error) throw new Error(`행동 감사 로그 저장 실패: ${error.message}`);
}
