import { parseCreateTaskPayload } from "./action-payload";
import { parseCalendarActionPayload } from "./calendar-action-payload";
import type { JsonValue } from "./types";

/** Phase 6 foundation only. Validating a proposal never authorizes execution. */
export type DialogueSource = { id: string; text: string };
export type DialogueProposal =
  | { type: "CREATE_TASK"; payload: ReturnType<typeof parseCreateTaskPayload>; requiresApproval: true }
  | { type: "CREATE_CALENDAR_EVENT" | "UPDATE_CALENDAR_EVENT"; payload: ReturnType<typeof parseCalendarActionPayload>; requiresApproval: true };
export type DialogueReply = {
  mode: "answer" | "clarify" | "propose";
  answer: string;
  citations: { sourceId: string; quote: string }[];
  proposals: DialogueProposal[];
};

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.keys(value).some((key) => !keys.includes(key))) throw new Error("대화 응답 형식을 확인할 수 없습니다.");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("대화 응답의 텍스트 길이가 올바르지 않습니다.");
  return value.trim();
}
const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();

export function validateDialogueReply(input: unknown, available: readonly DialogueSource[]): DialogueReply {
  if (available.length > 60 || available.reduce((sum, source) => sum + source.text.length, 0) > 60_000) throw new Error("대화 근거 범위를 초과했습니다.");
  const sources = new Map<string, string>();
  for (const source of available) {
    const id = text(source.id, 200);
    if (sources.has(id)) throw new Error("중복된 대화 근거 ID입니다.");
    sources.set(id, normalize(text(source.text, 8_000)));
  }
  const raw = object(input, ["mode", "answer", "citations", "proposals"]);
  if (raw.mode !== "answer" && raw.mode !== "clarify" && raw.mode !== "propose") throw new Error("지원하지 않는 대화 응답 종류입니다.");
  const answer = text(raw.answer, 4_000);
  if (!Array.isArray(raw.citations) || raw.citations.length > 8 || !Array.isArray(raw.proposals) || raw.proposals.length > 3) throw new Error("대화 근거·제안 개수를 확인하세요.");
  const citations = raw.citations.map((item) => {
    const citation = object(item, ["sourceId", "quote"]);
    const sourceId = text(citation.sourceId, 200);
    const quote = text(citation.quote, 1_000);
    if (!sources.get(sourceId)?.includes(normalize(quote))) throw new Error("제공하지 않은 근거 또는 확인되지 않은 인용입니다.");
    return { sourceId, quote };
  });
  if (raw.mode !== "clarify" && citations.length === 0) throw new Error("답변과 행동 제안에는 현재 요청 또는 조회 근거가 필요합니다.");
  if (raw.mode === "clarify" && raw.proposals.length) throw new Error("확인이 필요한 요청은 실행 제안을 만들 수 없습니다.");
  if (raw.mode === "propose" && !raw.proposals.length) throw new Error("행동 제안 내용이 없습니다.");
  const proposals: DialogueProposal[] = raw.proposals.map((item) => {
    const proposal = object(item, ["type", "payload"]);
    if (proposal.type === "CREATE_TASK") return { type: proposal.type, payload: parseCreateTaskPayload(proposal.payload as JsonValue), requiresApproval: true };
    if (proposal.type === "CREATE_CALENDAR_EVENT" || proposal.type === "UPDATE_CALENDAR_EVENT") {
      return { type: proposal.type, payload: parseCalendarActionPayload(proposal.type, proposal.payload), requiresApproval: true };
    }
    throw new Error("이 단계에서 지원하지 않는 행동 제안입니다.");
  });
  return { mode: raw.mode, answer, citations, proposals };
}
