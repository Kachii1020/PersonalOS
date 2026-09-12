import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { callStructured } from "@/lib/ai/client";
import { buildWorkPrompt, WORK_SCHEMA, WORK_SYSTEM } from "@/lib/ai/prompts/work-context";
import { groundWorkIntent, parseDeterministicWorkRequest, usesAutomaticAttention } from "@/lib/jarvis/work-context";
import type { WorkChatInput, WorkChatReply } from "@/lib/jarvis/work-types";
import type { DialogueDraft } from "@/lib/jarvis/dialogue-types";
import { answerDialogue, DialogueRequestError, projectWorkBoundEventSources, validateChatMessages } from "./jarvis-dialogue";
import { getWorkSnapshot, linkWorkDraftsForOwner, listWorkContexts, mutateWorkContext, requireWorkOwner } from "./work-contexts";
import { decideApproval } from "./jarvis-approvals";
import { requestDialogueApproval } from "./jarvis-dialogue";
import { executeApprovedActionById } from "@/lib/jarvis/executor";

export function workEnabled() { return process.env.JARVIS_CONTEXT_ENABLED === "true"; }
export function requireWorkEnabled() { if (!workEnabled()) throw new DialogueRequestError("업무 이어하기 기능이 아직 활성화되지 않았습니다.", 404); }
export async function bindWorkPreview(contextId: string, requestId: string) {
  const owner = await requireWorkOwner();
  const bound = await createAdminClient().rpc("bind_work_preview", { p_owner_id: owner.ownerId, p_context_id: contextId, p_request_id: requestId });
  if (bound.error) throw new Error("업무는 저장했지만 미리보기 정리를 확인하지 못했습니다. 같은 요청으로 다시 확인하세요.");
}
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
function subRequest(id: string, kind: string) {
  const h = hash(id + ":" + kind); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}
export async function answerWorkChat(input: WorkChatInput, options: { mutationPolicy?: "commit" | "confirm" } = {}): Promise<WorkChatReply> {
  requireWorkEnabled();
  const owner = await requireWorkOwner();
  if (!/^[0-9a-f-]{36}$/i.test(input.requestId)) throw new DialogueRequestError("요청 ID가 필요합니다.");
  const messages = validateChatMessages(input.messages);
  let snapshot = input.contextId ? await getWorkSnapshot(input.contextId) : null;
  if (input.contextId && !snapshot) throw new DialogueRequestError("선택한 업무가 없거나 이미 잊은 상태입니다. 다른 업무로 자동 전환하지 않습니다.",404);
  const latest = messages.at(-1)!.content;
  if (!snapshot && /^(?:이어하자|이어하기|업무 이어하기)[.!?\s]*$/.test(latest)) {
    const candidates = (await listWorkContexts()).filter(context => context.status === "active" || context.status === "paused");
    if (candidates.length === 1) snapshot = await getWorkSnapshot(candidates[0].id);
    return { mode: snapshot ? "answer" : "clarify", message: snapshot ? "저장한 업무를 불러왔습니다. 현재 상태와 다음 행동을 확인해 주세요." : "이어갈 업무를 목록에서 선택해 주세요. 여러 업무 중 하나를 추측하지 않습니다.", work: snapshot, preview: null, proposals: [], requestId: input.requestId };
  }
  const admin = createAdminClient();
  const mutationPolicy=options.mutationPolicy??"commit";
  const fingerprint = hash(JSON.stringify({ messages, contextId: input.contextId ?? null, expectedRevision: input.expectedRevision ?? null, ...(mutationPolicy==="confirm"?{mutationPolicy}: {}) }));
  const reserved = await admin.rpc("reserve_work_chat", { p_owner_id: owner.ownerId, ...(input.contextId ? {p_context_id:input.contextId}:{}), p_request_id: input.requestId, p_hash: fingerprint });
  if (reserved.error) throw new DialogueRequestError("같은 요청이 처리 중이거나 변경되었습니다. 잠시 후 같은 요청을 확인해 주세요.", 409);
  const claim = reserved.data as unknown as { token?: string; cached?: WorkChatReply };
  if (claim.cached) return { ...claim.cached, work: input.contextId ? await getWorkSnapshot(input.contextId) : claim.cached.work };
  if (!claim.token) throw new Error("업무 대화 요청을 확보하지 못했습니다.");
  const token = claim.token;
  const reply = (message: string, mode: WorkChatReply["mode"] = "answer"): WorkChatReply => ({ mode, message, work: snapshot, preview: null, proposals: [], requestId: input.requestId });
  async function finish(result: WorkChatReply) {
    const saved = await admin.rpc("finish_work_chat", { p_owner_id: owner.ownerId, p_request_id: input.requestId, p_token: token, p_response: JSON.parse(JSON.stringify(result)) });
    if (saved.error) throw new Error("업무 응답 기록에 실패했습니다. 같은 요청 ID로 다시 확인해 주세요.");
    return result;
  }
  try {
    if (snapshot) {
      const prior = await admin.from("work_context_requests").select("operation,result_ids")
        .eq("owner_id", owner.ownerId).eq("context_id", snapshot.context.id)
        .in("request_id", [subRequest(input.requestId,"update"), subRequest(input.requestId,"status"), subRequest(input.requestId,"link")]);
      if (prior.error) throw prior.error;
      if (prior.data.length) return await finish(reply("이미 반영한 요청의 현재 결과를 다시 불러왔습니다."));
      if (input.expectedRevision !== snapshot.context.revision) throw new DialogueRequestError("다른 기기에서 업무가 변경됐습니다. 최신 상태를 확인하고 다시 요청하세요.", 409);
    }
    const now = new Date();
    const boundEvents = snapshot ? projectWorkBoundEventSources(snapshot) : [];
    const deterministic=parseDeterministicWorkRequest(messages,snapshot?.context??null);
    const response = deterministic?null:await callStructured<unknown>({ purpose: "dialogue", system: WORK_SYSTEM, userMessage: buildWorkPrompt(messages, snapshot?.context ?? null, now, boundEvents), schema: WORK_SCHEMA, maxTokens: 3000, effort: "low", retries: 0, timeoutMs: 45_000 });
    const grounded = deterministic??groundWorkIntent(response!.data, messages, snapshot?.context ?? null, now);
    if (grounded.operation === "clarify") return await finish(reply(grounded.message, "clarify"));
    if (grounded.input && usesAutomaticAttention(grounded.input) && process.env.JARVIS_AUTOMATIC_ATTENTION_ENABLED !== "true") {
      return await finish(reply("마감 24시간 전·48시간 중단 자동 알림은 후속 검증 전까지 제공하지 않습니다. 마감은 저장할 수 있고, 직접 알림 시각을 지정하면 별도로 예약할 수 있습니다.", "clarify"));
    }
    if (grounded.operation === "preview") return await finish({ ...reply("저장할 업무와 알림을 확인하고 ‘업무 저장’을 눌러 주세요.", "preview"), preview: grounded.input! });
    if (!snapshot) return await finish(reply("먼저 진행 업무를 저장하거나 선택해 주세요.", "clarify"));
    if (grounded.operation === "update" || grounded.operation === "status") {
      if(mutationPolicy==="confirm")return await finish({...reply("음성으로 인식한 업무 변경을 화면에서 확인해 주세요."),confirmation:{operation:grounded.operation,contextId:snapshot.context.id,expectedRevision:snapshot.context.revision,requestId:subRequest(input.requestId,grounded.operation),input:grounded.operation==="update"?grounded.input!:{status:grounded.status!}}});
      snapshot = await mutateWorkContext({ operation: grounded.operation, contextId: snapshot.context.id, expectedRevision: snapshot.context.revision,
        requestId: subRequest(input.requestId, grounded.operation), input: grounded.operation === "update" ? grounded.input! : { status: grounded.status! } });
      return await finish(reply("명시한 업무 상태를 저장했습니다. 연결된 할 일·일정은 자동으로 변경하지 않았습니다."));
    }
    const drafts: DialogueDraft[] = [];
    for (const action of grounded.actions ?? []) {
      if (action.intent.kind === "update_calendar" && !boundEvents.some(source => source.id === action.intent.sourceId)) return await finish(reply("이 업무에 연결된 일정 중 현재 확인할 수 있는 대상의 정확한 이름을 알려주세요.", "clarify"));
      const answer = await answerDialogue({ messages: [{ role: "user", content: action.text }] }, {
        owner, interpret: async () => action.intent, workContext: { id: snapshot.context.id, revision: snapshot.context.revision },
      });
      if (answer.mode !== "propose" || !answer.draft) return await finish(reply(answer.message, "clarify"));
      drafts.push(answer.draft);
    }
    if (!drafts.length) return await finish(reply("구체적인 실행안을 요청해 주세요.", "clarify"));
    await linkWorkDraftsForOwner(snapshot.context.id, snapshot.context.revision, subRequest(input.requestId,"link"), drafts);
    snapshot = await getWorkSnapshot(snapshot.context.id);
    return await finish({ ...reply("각 실행안을 따로 검토하고 승인해 주세요. 업무 전체가 완료됐다는 뜻은 아닙니다.", "propose"), proposals: drafts });
  } catch (error) {
    const released = await admin.rpc("release_work_chat", { p_owner_id: owner.ownerId, p_request_id: input.requestId, p_token: token });
    if (released.error) console.error("[work-chat] 요청 해제 실패", released.error.code);
    throw error;
  }
}

export async function approveWorkAction(contextId: string, actionId: string, decision: "approved" | "rejected") {
  requireWorkEnabled();
  if (process.env.JARVIS_INLINE_APPROVALS_ENABLED !== "true") throw new DialogueRequestError("대화 내 승인이 아직 활성화되지 않았습니다.", 409);
  const snapshot = await getWorkSnapshot(contextId);
  if (!snapshot) throw new DialogueRequestError("업무를 찾을 수 없습니다.", 404);
  const action = snapshot.actions.find(item => item.id === actionId);
  if (!action) throw new DialogueRequestError("이 업무의 실행안이 아닙니다.", 404);
  if (snapshot.context.status !== "active" || snapshot.context.forgottenAt) throw new DialogueRequestError("진행 중인 업무만 새 실행을 승인할 수 있습니다.", 409);
  const approvalId = action.approvalId ?? await requestDialogueApproval(action.draft.id);
  const current = await getWorkSnapshot(contextId);
  if (!current) throw new DialogueRequestError("업무가 종료되거나 잊혔습니다.",404);
  const state = current.actions.find(item => item.id === actionId)?.status;
  if (state === "pending") await decideApproval(approvalId, decision, null);
  else if (decision === "rejected" && state !== "rejected") throw new DialogueRequestError("이미 승인된 실행은 이 버튼으로 되돌리지 않습니다. 결과를 먼저 확인하세요.", 409);
  if (decision === "approved" && !["executed","failed","rejected","expired"].includes(state ?? "")) await executeApprovedActionById(approvalId, `work-ui-${crypto.randomUUID()}`);
  return getWorkSnapshot(contextId);
}
