import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/server";
import type { DialogueDraft } from "@/lib/jarvis/dialogue-types";
import type { JsonValue } from "@/lib/jarvis/types";
import type { AttentionItem, WorkAction, WorkContext, WorkInput, WorkSnapshot, WorkStatus } from "@/lib/jarvis/work-types";
import { usesAutomaticAttention, validateWorkInput } from "@/lib/jarvis/work-context";

export class WorkRequestError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 403 | 404 | 409 = 400) { super(message); this.name = "WorkRequestError"; }
}
type Client = SupabaseClient<Database>;
type WorkRpcName = "list_work_contexts" | "get_work_snapshot" | "mutate_work_context" | "link_work_drafts";
async function rpc<N extends WorkRpcName>(client: Client, name: N, args?: Database["public"]["Functions"][N]["Args"]): Promise<unknown> {
  const result = await client.rpc(name, args);
  if (result.error) {
    const status = result.error.code === "42501" ? 403 : /revision|changed|request id reused/i.test(result.error.message) ? 409 : /not available|not found/i.test(result.error.message) ? 404 : 400;
    throw new WorkRequestError(`업무 요청을 처리하지 못했습니다: ${result.error.message}`, status);
  }
  return result.data;
}
function uuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new WorkRequestError("업무 또는 요청 ID를 확인해 주세요.");
  return value;
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  return value;
}
const requestHash = (value: unknown) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

type WorkRow = {
  id: string; owner_id: string; goal: string; progress: string; next_step: string; status: WorkStatus;
  revision: number; deadline_at: string | null; reminder_at: string | null; deadline_reminder: boolean; resume_reminder: boolean;
  missing_fields: string[]; source_refs: JsonValue[]; last_progress_at: string; created_at: string; updated_at: string; expires_at: string | null; forgotten_at: string | null;
};
type AttentionRow = { id: string; context_id: string; kind: AttentionItem["kind"]; due_at: string; status: string; reason: string; acknowledged_at: string | null; deliveries?: { accepted: number; received: number; opened: number; failed: number; uncertain: number } };
function mapContext(row: WorkRow): WorkContext {
  return { id: row.id, ownerId: row.owner_id, goal: row.goal, progress: row.progress, nextStep: row.next_step,
    status: row.status, revision: row.revision, deadlineAt: row.deadline_at, reminderAt: row.reminder_at,
    deadlineReminder: row.deadline_reminder, resumeReminder: row.resume_reminder, missingFields: row.missing_fields,
    sourceRefs: row.source_refs, lastProgressAt: row.last_progress_at, createdAt: row.created_at, updatedAt: row.updated_at,
    expiresAt: row.expires_at, forgottenAt: row.forgotten_at };
}
const mapAttention = (row: AttentionRow): AttentionItem => ({ id: row.id, contextId: row.context_id, kind: row.kind, dueAt: row.due_at, status: row.status, reason: row.reason, acknowledgedAt: row.acknowledged_at, deliveries: row.deliveries });

export async function requireWorkOwner() {
  const client = await createClient(); const user = await client.auth.getUser();
  if (user.error || !user.data.user) throw new WorkRequestError("로그인이 필요합니다.", 401);
  const allowed = await client.rpc("is_allowed_user");
  if (allowed.error || !allowed.data) throw new WorkRequestError("허용된 계정만 업무를 사용할 수 있습니다.", 403);
  return { client, ownerId: user.data.user.id };
}

export async function listWorkContexts(): Promise<WorkContext[]> {
  const { client } = await requireWorkOwner();
  return ((await rpc(client, "list_work_contexts")) as WorkRow[]).map(mapContext);
}
type SnapshotRow = {
  context: WorkRow; attention: AttentionRow[];
  actions: { action: { id: string; context_id: string; context_revision: number }; draft: {
    id: string; action_type: DialogueDraft["type"]; title: string; explanation: string; payload: JsonValue; expires_at: string; executable: boolean; approval_request_id: string | null;
  }; approval: { id: string; status: string; result: JsonValue | null; error: string | null; executed_at: string | null; expires_at: string | null } | null }[];
};
/** Read-only client injection also exercises the real owner-RLS projection in gates. */
export async function getWorkSnapshotForClient(client: Client, id: string): Promise<WorkSnapshot | null> {
  const row = await rpc(client, "get_work_snapshot", { p_context_id: uuid(id) }) as SnapshotRow | null;
  if (!row) return null;
  const context = mapContext(row.context);
  const actions: WorkAction[] = row.actions.map(({ action, draft, approval }) => {
    const current = action.context_revision === context.revision && context.status === "active";
    const approvalStatus = approval && ["pending", "approved"].includes(approval.status) && approval.expires_at !== null && Date.parse(approval.expires_at) <= Date.now() ? "expired" : approval?.status;
    return { id: action.id, contextId: action.context_id, approvalId: approval?.id ?? null,
      status: approvalStatus ?? (!current ? "stale" : Date.parse(draft.expires_at) <= Date.now() ? "expired" : "proposed"),
      result: approval?.result ?? null, error: approval?.error ?? null,
      draft: { id: draft.id, type: draft.action_type, title: draft.title, explanation: draft.explanation, payload: draft.payload,
        expiresAt: draft.expires_at, canRequestApproval: current && draft.executable && !approval && Date.parse(draft.expires_at) > Date.now() } };
  });
  // Link only actual verified execution IDs; re-read originals with owner RLS.
  // This projection never increments the work revision or marks the work done.
  const refs = row.actions.flatMap(({ approval }): { kind: "task" | "event"; id: string; approvalId: string; verifiedAt: string | null }[] => {
    if (approval?.status !== "executed" || !approval.result || typeof approval.result !== "object" || Array.isArray(approval.result)) return [];
    if (typeof approval.result.taskId === "string") return [{ kind: "task", id: approval.result.taskId, approvalId: approval.id, verifiedAt: approval.executed_at }];
    if (approval.result.calendarState === "verified" && typeof approval.result.eventId === "string") return [{ kind: "event", id: approval.result.eventId, approvalId: approval.id, verifiedAt: approval.executed_at }];
    return [];
  });
  if (refs.length) {
    const taskIds = refs.filter((ref) => ref.kind === "task").map((ref) => ref.id);
    const eventIds = refs.filter((ref) => ref.kind === "event").map((ref) => ref.id);
    const [tasks, events] = await Promise.all([
      taskIds.length ? client.from("tasks").select("id,title,status").in("id", taskIds) : Promise.resolve({ data: [], error: null }),
      eventIds.length ? client.from("events").select("id,summary,starts_at,ends_at,updated_at").in("id", eventIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (tasks.error || events.error) throw new WorkRequestError("연결된 원본 기록을 확인하지 못했습니다.");
    context.sourceRefs = [...context.sourceRefs, ...refs.map((ref) => {
      const original = ref.kind === "task" ? tasks.data?.find((task) => task.id === ref.id) : events.data?.find((event) => event.id === ref.id);
      return { ...ref, available: !!original, observedAt: new Date().toISOString(), current: original ?? null } as JsonValue;
    })];
  }
  return { context, actions, attention: row.attention.map(mapAttention) };
}
export async function getWorkSnapshot(id: string): Promise<WorkSnapshot | null> {
  const { client } = await requireWorkOwner(); return getWorkSnapshotForClient(client, id);
}
export async function mutateWorkContext(request: {
  operation: "create" | "update" | "status" | "forget"; contextId?: string; expectedRevision?: number; requestId: string;
  input?: WorkInput | { status: WorkStatus } | Record<string, never>;
}): Promise<WorkSnapshot | null> {
  const { client } = await requireWorkOwner();
  let input = request.input ?? {};
  if (request.operation === "create" || request.operation === "update") {
    try { input = validateWorkInput(input); } catch (error) { throw new WorkRequestError(error instanceof Error ? error.message : "업무 입력을 확인해 주세요."); }
    if (usesAutomaticAttention(input as WorkInput) && process.env.JARVIS_AUTOMATIC_ATTENTION_ENABLED !== "true") {
      throw new WorkRequestError("마감·재개 자동 알림은 후속 검증 전까지 사용할 수 없습니다. 직접 알림 시각만 지정해 주세요.", 409);
    }
  }
  const canonical = { operation: request.operation, contextId: request.contextId ?? null, expectedRevision: request.expectedRevision ?? null, input };
  // The generated schema omits nullable required SQL arguments. Create's
  // explicitly validated contract requires both context/revision to be null.
  const args = { p_operation: request.operation, p_context_id: request.contextId ? uuid(request.contextId) : null,
    p_expected_revision: request.expectedRevision ?? null, p_request_id: uuid(request.requestId), p_request_hash: requestHash(canonical), p_input: canonical.input };
  const id = await rpc(client, "mutate_work_context", args as Database["public"]["Functions"]["mutate_work_context"]["Args"]);
  return typeof id === "string" ? getWorkSnapshotForClient(client, id) : null;
}
export async function linkWorkDraftsForOwner(contextId: string, revision: number, requestId: string, drafts: DialogueDraft[]): Promise<WorkSnapshot | null> {
  const { client } = await requireWorkOwner();
  if (drafts.length < 1 || drafts.length > 3) throw new WorkRequestError("한 번에 1~3개 실행안만 연결할 수 있습니다.");
  const draftIds = drafts.map((draft) => uuid(draft.id));
  const id = await rpc(client, "link_work_drafts", { p_context_id: uuid(contextId), p_revision: revision, p_request_id: uuid(requestId),
    p_request_hash: requestHash({ contextId, revision, draftIds }), p_draft_ids: draftIds });
  return typeof id === "string" ? getWorkSnapshotForClient(client, id) : null;
}
