import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseCalendarActionPayload, type CalendarActionPayload, type CalendarActionType } from "@/lib/jarvis/calendar-action-payload";
import type { ApprovalRequest } from "@/lib/jarvis/db-types";
import type { Database } from "@/lib/types/database";
import { createApprovedCalendarTransport, executeApprovedCalendar, readApprovedCalendarTarget, type ApprovedCalendarResult, type ApprovedCalendarTransport } from "@/lib/integrations/caldav/approved-actions";

export type CalendarExecutionOutcome =
  | { kind: "verified"; eventId: string; uid: string; href: string }
  | { kind: "conflict" | "uncertain"; message: string };

type Receipt = {
  approval_id: string; owner_id: string; action_type: CalendarActionType; payload: CalendarActionPayload;
  calendar_id: string; calendar_source_url: string; uid: string; href: string;
  state: "prepared" | "attempted" | "uncertain" | "conflict" | "verified";
  write_attempts: number; claim_token: string | null; claim_mode: "execute" | "reconcile" | null;
  mirror_event_id: string | null;
};
type RpcName = "begin_calendar_execution" | "before_calendar_write" | "finish_calendar_execution" | "fail_calendar_execution" | "claim_calendar_reconciliation";
async function rpc<N extends RpcName>(name: N, args: Database["public"]["Functions"][N]["Args"]): Promise<unknown> {
  const result = await createAdminClient().rpc(name, args);
  if (result.error) throw new Error(`캘린더 실행 기록 실패: ${result.error.message}`);
  return result.data;
}
function receiptOf(value: unknown): Receipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("캘린더 실행 영수증을 확인하지 못했습니다.");
  const receipt = value as Receipt;
  if (!receipt.approval_id || !receipt.calendar_source_url || !receipt.href || !receipt.uid) throw new Error("캘린더 실행 대상 정보가 없습니다.");
  receipt.payload = parseCalendarActionPayload(receipt.action_type, receipt.payload);
  return receipt;
}
const messageOf = (error: unknown) => error instanceof Error ? error.message : "캘린더 실행 결과를 확인하지 못했습니다.";
function claimToken(receipt: Receipt): string {
  if (!receipt.claim_token) throw new Error("캘린더 실행 claim이 없습니다.");
  return receipt.claim_token;
}

export function isCalendarExecutorEnabled(): boolean {
  return process.env.JARVIS_CALENDAR_ACTIONS_ENABLED === "true";
}

export async function readCalendarTargetForDraft(calendarSourceUrl: string, eventHref: string) {
  return readApprovedCalendarTarget(calendarSourceUrl, eventHref);
}

function verifiedOutcome(receipt: Receipt): CalendarExecutionOutcome {
  if (receipt.state !== "verified" || !receipt.mirror_event_id) throw new Error("검증된 캘린더 완료 기록이 없습니다.");
  return { kind: "verified", eventId: receipt.mirror_event_id, uid: receipt.uid, href: receipt.href };
}

async function verifyConfiguredTarget(receipt: Receipt): Promise<void> {
  const result = await createAdminClient().from("calendars").select("id,source_url,display_name,kind,is_writable").eq("is_writable", true);
  if (result.error) throw new Error(`앱 캘린더 확인 실패: ${result.error.message}`);
  const candidates = (result.data ?? []).filter((calendar) => calendar.kind === "caldav" && calendar.display_name === (process.env.APP_CALENDAR_NAME ?? "Personal OS"));
  if (candidates.length !== 1 || candidates[0].id !== receipt.calendar_id || candidates[0].source_url !== receipt.calendar_source_url) throw new Error("현재 설정된 앱 전용 캘린더와 승인 대상이 다릅니다.");
}

function assertRemoteProof(receipt: Receipt, proof: Extract<ApprovedCalendarResult, { kind: "verified" }>): void {
  const payload = receipt.payload; const event = proof.parsedEvent;
  if (proof.uid !== receipt.uid || proof.href !== receipt.href || event.uid !== receipt.uid
    || event.summary !== payload.summary || event.description !== payload.description || event.location !== payload.location
    || Date.parse(event.startsAt) !== Date.parse(payload.startsAt) || Date.parse(event.endsAt) !== Date.parse(payload.endsAt)
    || event.isAllDay || event.rrule !== null || event.exdates.length > 0 || !/^"[\x21\x23-\x7e]+"$/.test(proof.etag)) throw new Error("조회된 원격 일정이 승인한 내용·대상과 일치하지 않습니다.");
}

async function saveFailure(receipt: Receipt, workerId: string, state: "uncertain" | "conflict", message: string): Promise<void> {
  try {
    await rpc("fail_calendar_execution", { p_approval_id: receipt.approval_id, p_worker_id: workerId, p_claim_token: claimToken(receipt), p_state: state, p_error: message });
  } catch (error) {
    // Do not erase a consumed receipt or grant another write if persistence is
    // down. Its durable attempted state forces read-only recovery after restart.
    console.error("[jarvis-calendar] 실패 상태 저장 불가; 재조회 필요", { approvalId: receipt.approval_id, error: messageOf(error) });
  }
}

async function runReceipt(receipt: Receipt, workerId: string, transport?: ApprovedCalendarTransport, ownerReadOnly = false): Promise<CalendarExecutionOutcome> {
  if (receipt.state === "verified") return verifiedOutcome(receipt);
  try {
    await verifyConfiguredTarget(receipt);
    const delegate = transport ?? await createApprovedCalendarTransport();
    const readOnly = ownerReadOnly || receipt.claim_mode !== "execute" || receipt.write_attempts !== 0;
    let consumedHere = false;
    async function beforeWrite() {
      if (readOnly || consumedHere) throw new Error("이 영수증은 원격 읽기 재확인만 허용합니다.");
      if (!isCalendarExecutorEnabled()) throw new Error("캘린더 실행 연결이 비활성화되었습니다.");
      await rpc("before_calendar_write", { p_approval_id: receipt.approval_id, p_worker_id: workerId, p_claim_token: claimToken(receipt) });
      consumedHere = true;
    }
    const guarded: ApprovedCalendarTransport = {
      configuredCalendarName: delegate.configuredCalendarName,
      listCalendars: () => delegate.listCalendars(),
      read: (calendarUrl, href) => {
        if (calendarUrl !== receipt.calendar_source_url || href !== receipt.href) throw new Error("조회 대상이 승인된 원격 리소스와 다릅니다.");
        return delegate.read(calendarUrl, href);
      },
      async create(calendarUrl, filename, data) {
        if (receipt.action_type !== "CREATE_CALENDAR_EVENT" || calendarUrl !== receipt.calendar_source_url || new URL(filename, calendarUrl).href !== receipt.href) throw new Error("생성 대상이 승인 내용과 다릅니다.");
        await beforeWrite();
        return delegate.create(calendarUrl, filename, data);
      },
      async update(href, data, etag) {
        if (receipt.action_type !== "UPDATE_CALENDAR_EVENT" || href !== receipt.href || !("expectedEtag" in receipt.payload) || etag !== receipt.payload.expectedEtag) throw new Error("수정 대상 또는 버전이 승인 내용과 다릅니다.");
        await beforeWrite();
        return delegate.update(href, data, etag);
      },
    };
    const proof = await executeApprovedCalendar({ approvalId: receipt.approval_id, type: receipt.action_type, payload: receipt.payload, calendarSourceUrl: receipt.calendar_source_url, eventHref: receipt.href }, guarded);
    if (proof.kind !== "verified") {
      await saveFailure(receipt, workerId, proof.kind, proof.message);
      return { kind: proof.kind, message: proof.message };
    }
    assertRemoteProof(receipt, proof);
    const finished = receiptOf(await rpc("finish_calendar_execution", {
      p_approval_id: receipt.approval_id, p_worker_id: workerId, p_claim_token: claimToken(receipt),
      p_proof: { uid: proof.uid, href: proof.href, etag: proof.etag, event: proof.parsedEvent },
    }));
    return verifiedOutcome(finished);
  } catch (error) {
    const message = messageOf(error);
    await saveFailure(receipt, workerId, "uncertain", message);
    return { kind: "uncertain", message };
  }
}

export async function executeCalendarForApprovalForJob(approval: ApprovalRequest, workerId: string, transport?: ApprovedCalendarTransport): Promise<CalendarExecutionOutcome> {
  if (!isCalendarExecutorEnabled()) return { kind: "conflict", message: "캘린더 실행 연결이 비활성화되어 있습니다." };
  if (approval.actionType !== "CREATE_CALENDAR_EVENT" && approval.actionType !== "UPDATE_CALENDAR_EVENT") return { kind: "conflict", message: "지원하지 않는 캘린더 행동입니다." };
  let receipt: Receipt;
  try {
    parseCalendarActionPayload(approval.actionType, approval.payload);
    receipt = receiptOf(await rpc("begin_calendar_execution", { p_approval_id: approval.id, p_worker_id: workerId }));
  } catch (error) {
    const message = messageOf(error);
    const result = await createAdminClient().rpc("fail_approval_execution", { p_approval_id: approval.id, p_worker_id: workerId, p_error: message });
    if (result.error) console.error("[jarvis-calendar] 실행 시작 실패 기록 불가", result.error.message);
    return { kind: "conflict", message };
  }
  return runReceipt(receipt, workerId, transport);
}

async function requireReceiptOwner() {
  const client = await createClient();
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) throw new Error("로그인이 필요합니다.");
  const allowed = await client.rpc("is_allowed_user");
  if (allowed.error || !allowed.data) throw new Error("허용된 계정만 재확인할 수 있습니다.");
  return { client, ownerId: user.data.user.id };
}

/** Receipt evidence also survives a crash before approval.result was persisted. */
export async function listCalendarReconciliationIdsForOwner(approvalIds: string[]): Promise<string[]> {
  const ids = [...new Set(approvalIds)];
  if (!ids.length) return [];
  if (ids.length > 200 || ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) throw new Error("재확인할 승인 목록을 확인해 주세요.");
  const { client, ownerId } = await requireReceiptOwner();
  const result = await client.from("calendar_execution_receipts").select("approval_id").in("approval_id", ids)
    .eq("owner_id", ownerId).in("state", ["attempted", "uncertain"])
    .or(`locked_until.is.null,locked_until.lte.${new Date().toISOString()}`);
  if (result.error) throw new Error(`캘린더 재확인 목록 조회 실패: ${result.error.message}`);
  return (result.data ?? []).map((row) => row.approval_id);
}

/** Explicit owner read-back only: no route here can restore a write allowance. */
export async function reconcileCalendarApprovalForOwner(approvalId: string): Promise<CalendarExecutionOutcome> {
  const { client, ownerId } = await requireReceiptOwner();
  const draft = await client.from("dialogue_action_drafts").select("id,owner_id").eq("approval_request_id", approvalId).maybeSingle();
  if (draft.error || !draft.data || draft.data.owner_id !== ownerId) throw new Error("이 승인 요청을 재확인할 권한이 없습니다.");
  const workerId = `calendar-reconcile-${crypto.randomUUID()}`;
  const receipt = receiptOf(await rpc("claim_calendar_reconciliation", { p_approval_id: approvalId, p_owner_id: ownerId, p_worker_id: workerId }));
  return runReceipt(receipt, workerId, undefined, true);
}
