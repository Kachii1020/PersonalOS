import type { AttentionKind, WorkContext, WorkInput, WorkStatus } from "./work-types";
import type { ChatMessage, DialogueIntent, InputQuote } from "./dialogue-types";
import { validateDialogueIntent } from "./dialogue-grounding";

const INPUT_KEYS = ["goal", "progress", "nextStep", "deadlineAt", "reminderAt", "deadlineReminder", "resumeReminder"];
const STATUSES: WorkStatus[] = ["active", "paused", "completed", "cancelled"];
const JST = 9 * 3600_000;
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function keys(value: Record<string, unknown>, allowed: string[]): boolean { return Reflect.ownKeys(value).length === allowed.length && Reflect.ownKeys(value).every((key) => typeof key === "string" && allowed.includes(key)); }
function bounded(value: unknown, field: string, max: number, required = false): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim()) || value.includes("\0")) throw new Error(`${field}: ${max}자 이내의 ${required ? "비어 있지 않은 " : ""}문자열이 필요합니다.`);
  return value.trim();
}
function instant(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.0{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || value.endsWith("-00:00")) throw new Error("시간대가 명시된 초 단위 날짜·시각이 필요합니다.");
  const parsed = Date.parse(value); const day = Date.parse(value.slice(0, 10));
  if (!Number.isFinite(parsed) || !Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== value.slice(0, 10) || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) throw new Error("실제 달력 날짜·시각이 올바르지 않습니다.");
  return new Date(parsed).toISOString();
}

export function validateWorkInput(raw: unknown): WorkInput {
  if (!record(raw) || !keys(raw, INPUT_KEYS)) throw new Error("업무 입력 필드가 올바르지 않습니다. 소유자나 실행 결과는 입력할 수 없습니다.");
  if (typeof raw.deadlineReminder !== "boolean" || typeof raw.resumeReminder !== "boolean") throw new Error("알림 동의는 boolean이어야 합니다.");
  const deadlineAt = raw.deadlineAt === null ? null : instant(raw.deadlineAt);
  const reminderAt = raw.reminderAt === null ? null : instant(raw.reminderAt);
  if (raw.deadlineReminder && !deadlineAt) throw new Error("마감 알림에는 명시한 마감이 필요합니다.");
  return { goal: bounded(raw.goal, "goal", 200, true), progress: bounded(raw.progress, "progress", 2000), nextStep: bounded(raw.nextStep, "nextStep", 2000), deadlineAt, reminderAt, deadlineReminder: raw.deadlineReminder, resumeReminder: raw.resumeReminder };
}

export function usesAutomaticAttention(input: WorkInput): boolean {
  return input.deadlineReminder || input.resumeReminder;
}

export type WorkOperation = { type: "update"; expectedRevision: number; now: Date; input: WorkInput } | { type: "status"; expectedRevision: number; now: Date; status: WorkStatus } | { type: "forget"; expectedRevision: number; now: Date };
export function reduceWorkContext(current: WorkContext, operation: WorkOperation): WorkContext {
  if (!Number.isInteger(operation.expectedRevision) || operation.expectedRevision !== current.revision) throw new Error("업무가 다른 곳에서 변경되었습니다. 최신 상태를 다시 확인해 주세요.");
  if (!Number.isFinite(operation.now.getTime()) || current.forgottenAt) throw new Error("잊은 업무 또는 잘못된 시각은 변경할 수 없습니다.");
  const updatedAt = operation.now.toISOString();
  const base = { ...structuredClone(current), revision: current.revision + 1, updatedAt };
  if (operation.type === "forget") return { ...base, goal: "", progress: "", nextStep: "", deadlineAt: null, reminderAt: null, deadlineReminder: false, resumeReminder: false, status: "cancelled", sourceRefs: [], missingFields: [], forgottenAt: updatedAt, expiresAt: updatedAt };
  if (operation.type === "update") {
    if (current.status === "completed" || current.status === "cancelled") throw new Error("종료한 업무는 자동으로 재개하지 않습니다. 새 업무로 시작해 주세요.");
    const input = validateWorkInput(operation.input);
    return { ...base, ...input, lastProgressAt: input.progress !== current.progress ? updatedAt : current.lastProgressAt, missingFields: input.nextStep ? [] : ["nextStep"] };
  }
  if (operation.type !== "status" || !STATUSES.includes(operation.status)) throw new Error("지원하지 않는 업무 상태 변경입니다.");
  if ((current.status === "completed" || current.status === "cancelled") && operation.status !== current.status) throw new Error("종료한 업무는 새 업무로 다시 시작해 주세요.");
  const terminal = operation.status === "completed" || operation.status === "cancelled";
  return { ...base, status: operation.status, ...(terminal ? { reminderAt: null, deadlineReminder: false, resumeReminder: false, expiresAt: new Date(operation.now.getTime() + 30 * 86400_000).toISOString() } : {}) };
}

export function effectiveAttentionDue(kind: AttentionKind, dueAt: string): string {
  if (!["explicit", "deadline", "resume"].includes(kind)) throw new Error("지원하지 않는 알림 종류입니다.");
  const due = new Date(instant(dueAt));
  if (kind === "explicit") return due.toISOString();
  const jst = new Date(due.getTime() + JST); const hour = jst.getUTCHours();
  if (hour >= 22) jst.setUTCDate(jst.getUTCDate() + 1);
  if (hour >= 22 || hour < 8) jst.setUTCHours(8, 0, 0, 0);
  return new Date(jst.getTime() - JST).toISOString();
}

export function canSendWorkAttention(input: { context: WorkContext; kind: AttentionKind; dueAt: string; now: Date; automaticSentToday: number; explicitNightAllowed?: boolean; sourceRevision?: number }): boolean {
  const { context, kind, now } = input;
  if (!Number.isFinite(now.getTime()) || context.status !== "active" || context.forgottenAt || (context.expiresAt !== null && (!Number.isFinite(Date.parse(context.expiresAt)) || Date.parse(context.expiresAt) <= now.getTime())) || (input.sourceRevision !== undefined && input.sourceRevision !== context.revision)) return false;
  const hour = new Date(now.getTime() + JST).getUTCHours(); const quiet = hour >= 22 || hour < 8;
  if (kind === "explicit") return context.reminderAt !== null && instant(context.reminderAt) === instant(input.dueAt) && Date.parse(input.dueAt) <= now.getTime() && (!quiet || input.explicitNightAllowed !== false);
  if (kind !== "deadline" && kind !== "resume") return false;
  if (quiet || !Number.isInteger(input.automaticSentToday) || input.automaticSentToday < 0 || input.automaticSentToday >= 3 || (kind === "deadline" ? !context.deadlineReminder || !context.deadlineAt : !context.resumeReminder)) return false;
  return Date.parse(effectiveAttentionDue(kind, input.dueAt)) <= now.getTime();
}

export type WorkIntent = {
  operation: "preview" | "update" | "status" | "actions" | "clarify";
  goal: InputQuote | null; progress: InputQuote | null; nextStep: InputQuote | null;
  deadline: InputQuote | null; reminder: InputQuote | null;
  deadlineReminder: boolean | null; resumeReminder: boolean | null;
  status: WorkStatus | null; actions: { request: InputQuote; intent: DialogueIntent }[];
};
export type GroundedWorkIntent = { operation: WorkIntent["operation"]; input?: WorkInput; status?: WorkStatus; actions?: { text: string; intent: DialogueIntent }[]; message: string };

export function validateWorkIntent(raw: unknown): WorkIntent {
  if (!record(raw) || !keys(raw, ["operation", "goal", "progress", "nextStep", "deadline", "reminder", "deadlineReminder", "resumeReminder", "status", "actions"]) || !["preview", "update", "status", "actions", "clarify"].includes(raw.operation as string)) throw new Error("업무 의도 형식이 올바르지 않습니다.");
  for (const field of ["goal", "progress", "nextStep", "deadline", "reminder"]) {
    const quote = raw[field];
    if (quote !== null && (!record(quote) || !keys(quote, ["text", "messageIndex"]) || !Number.isInteger(quote.messageIndex) || (quote.messageIndex as number) < 0 || (quote.messageIndex as number) > 39 || typeof quote.text !== "string" || !quote.text.trim() || quote.text.length > 2000)) throw new Error(`${field}: 사용자 인용이 올바르지 않습니다.`);
  }
  for (const field of ["deadlineReminder", "resumeReminder"]) if (raw[field] !== null && typeof raw[field] !== "boolean") throw new Error("알림 의도는 boolean 또는 null이어야 합니다.");
  if (raw.status !== null && !STATUSES.includes(raw.status as WorkStatus)) throw new Error("업무 상태가 올바르지 않습니다.");
  if (!Array.isArray(raw.actions) || raw.actions.length > 3) throw new Error("독립 실행안은 최대 3개입니다.");
  const actions = raw.actions.map((action) => {
    if (!record(action) || !keys(action, ["request", "intent"]) || !record(action.request) || !keys(action.request, ["text", "messageIndex"]) || typeof action.request.text !== "string" || !action.request.text.trim() || action.request.text.length > 4000 || !Number.isInteger(action.request.messageIndex) || (action.request.messageIndex as number) < 0 || (action.request.messageIndex as number) > 39) throw new Error("독립 실행안의 사용자 구절이 올바르지 않습니다.");
    return { request: action.request as InputQuote, intent: validateDialogueIntent(action.intent) };
  });
  return { ...raw, actions } as WorkIntent;
}

function unambiguousBareClock(text: string): string | null {
  const match = /^(0|00|1[3-9]|2[0-3])시(?:\s*(\d{1,2})분)?$/.exec(text.trim());
  if (!match || Number(match[2] ?? 0) > 59) return null;
  return `${String(Number(match[1])).padStart(2, "0")}:${String(Number(match[2] ?? 0)).padStart(2, "0")}`;
}

function quotedTime(text: string, now: Date): string | null {
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) { try { return instant(text); } catch { return null; } }
  const combined = /^(\d{4}-\d{2}-\d{2}|오늘|내일|모레)\s*(.+)$/.exec(text.trim());
  if (!combined) return null;
  const normalized = `${combined[1]} ${unambiguousBareClock(combined[2]) ?? combined[2]}`;
  const match = /^(\d{4}-\d{2}-\d{2}|오늘|내일|모레)\s+(?:(\d{2}):(\d{2})|(오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?)$/.exec(normalized);
  if (!match) return null;
  const relative = ["오늘", "내일", "모레"].indexOf(match[1]);
  const date = relative >= 0 ? new Date(now.getTime() + JST + relative * 86400_000).toISOString().slice(0, 10) : match[1];
  let hour = Number(match[2] ?? match[5]); const minute = Number(match[3] ?? match[6] ?? 0);
  if (match[4]) { if (hour < 1 || hour > 12) return null; hour = hour % 12 + (match[4] === "오후" ? 12 : 0); }
  if (hour > 23 || minute > 59) return null;
  try { return instant(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`); } catch { return null; }
}

export function groundWorkIntent(raw: unknown, messages: ChatMessage[], context: WorkContext | null, now: Date): GroundedWorkIntent {
  const intent = validateWorkIntent(raw);
  const clarify = (message: string): GroundedWorkIntent => ({ operation: "clarify", message });
  if (!Number.isFinite(now.getTime())) return clarify("기준 시각을 다시 확인해 주세요.");
  const userIndex = messages.findLastIndex((message) => message.role === "user");
  if (userIndex < 0) return clarify("업무 요청을 직접 입력해 주세요.");
  const latest = messages[userIndex].content;
  for (const field of ["goal", "progress", "nextStep", "deadline", "reminder"] as const) {
    const quote = intent[field];
    if (quote && (quote.messageIndex !== userIndex || messages[quote.messageIndex]?.role !== "user" || !latest.includes(quote.text))) return clarify("업무 변경 값은 현재 사용자 요청에서 직접 확인해야 합니다.");
  }
  if (intent.operation === "clarify") return clarify("저장할 업무, 진행 상태, 다음 행동 또는 필요한 실행안을 구체적으로 알려주세요.");
  if (intent.operation === "status") {
    if (!context || context.forgottenAt || !intent.status) return clarify("상태를 바꿀 업무와 원하는 상태를 명확히 지정해 주세요.");
    const forms: Record<WorkStatus, RegExp> = { active: /(?:업무|작업)(?:를|을|가|이|는|은)?\s*(?:재개|다시\s*시작)/, paused: /(?:업무|작업)(?:를|을|가|이|는|은)?\s*(?:일시\s*중지|중단|잠시\s*멈)/, completed: /(?:업무|작업)(?:를|을|가|이|는|은)?\s*(?:모두\s*)?(?:완료|끝냈|끝났)/, cancelled: /(?:업무|작업)(?:를|을|가|이|는|은)?\s*취소/ };
    if (!forms[intent.status].test(latest) || Object.values(forms).filter((pattern) => pattern.test(latest)).length !== 1 || /(?:아니|않|하지\s*마|말고)/.test(latest)) return clarify("업무 상태 변경인지 알림·실행안 취소인지 명확히 알려주세요.");
    if (intent.actions.length || [intent.goal, intent.progress, intent.nextStep, intent.deadline, intent.reminder].some(Boolean)) return clarify("업무 상태 변경과 다른 변경은 따로 확인해 주세요.");
    return { operation: "status", status: intent.status, message: "업무 상태를 변경합니다. 연결된 할 일·일정의 실행 결과나 실제 업무 성과를 대신 확정하지 않습니다." };
  }
  if (intent.operation === "actions") {
    if (!context || context.status !== "active" || context.forgottenAt) return clarify("진행 중 업무를 선택한 뒤 실행안을 요청해 주세요.");
    if (!intent.actions.length || !/(?:만들|추가|생성|등록|수정|변경|옮겨)/.test(latest) || /(?:취소|하지\s*마|실행하지)/.test(latest)) return clarify("원하는 할 일·일정 실행안을 직접 요청해 주세요.");
    const groundedActions: { text: string; intent: DialogueIntent }[] = [];
    const spans: { start: number; end: number }[] = [];
    const createVerb = /(?:만들어|추가해|생성해|등록해)/;
    const updateVerb = /(?:수정해|변경해|옮겨)/;
    for (const candidate of intent.actions) {
      const { request, intent: action } = candidate;
      if (request.messageIndex !== userIndex || !latest.includes(request.text)) return clarify("각 실행안은 현재 사용자 요청의 정확한 구절이어야 합니다.");
      const start = latest.indexOf(request.text); const end = start + request.text.length;
      if (spans.some((span) => start < span.end && end > span.start)) return clarify("실행안 구절이 서로 겹칩니다. 독립된 요청으로 나누어 주세요.");
      spans.push({ start, end });
      if (!["create_task", "create_calendar", "update_calendar"].includes(action.kind)) return clarify("할 일 생성과 일정 생성·수정만 지원합니다.");
      if (!(action.kind === "create_task" ? /할\s*일|태스크/ : /일정|캘린더/).test(request.text)) return clarify("각 구절에서 할 일인지 일정인지 명시해 주세요.");
      for (const field of ["title", "date", "time", "duration"] as const) {
        const quote = action[field];
        if (quote && (quote.messageIndex !== userIndex || !request.text.includes(quote.text))) return clarify("실행안의 값은 해당 사용자 구절 안에 있어야 합니다.");
      }
      const isUpdate = action.kind === "update_calendar";
      const localVerb = (isUpdate ? updateVerb : createVerb).test(request.text);
      const sharedVerb = (isUpdate ? updateVerb : createVerb).test(latest) && !(isUpdate ? createVerb : updateVerb).test(latest);
      if (!localVerb && !sharedVerb) return clarify("각 실행안의 생성·수정 의도를 따로 명시해 주세요.");
      const remapped = { ...action };
      for (const field of ["title", "date", "time", "duration"] as const) if (action[field]) remapped[field] = { ...action[field]!, messageIndex: 0 };
      let canonicalText = request.text;
      const clock = action.time ? unambiguousBareClock(action.time.text) : null;
      if (action.time && /^\d{1,2}시/.test(action.time.text.trim()) && !clock) return clarify("1~12시에는 오전·오후를 지정하고, 그 외 시각은 유효한 24시간 시각으로 입력해 주세요.");
      if (clock && action.time) {
        const matches = Array.from(request.text.matchAll(/(?<!\d)(?:00|0|1[3-9]|2[0-3])시(?!간)(?:\s*\d{1,2}분)?/g));
        const exact = matches.filter((match) => match[0] === action.time!.text);
        if (exact.length !== 1 || /(?:오전|오후)\s*$/.test(request.text.slice(0, exact[0].index))) return clarify("시각 표현 전체를 명확히 확인해 주세요.");
        canonicalText = request.text.slice(0, exact[0].index) + clock + request.text.slice(exact[0].index! + action.time.text.length);
        remapped.time = { messageIndex: 0, text: clock };
        for (const field of ["title", "date", "duration"] as const) if (remapped[field] && !canonicalText.includes(remapped[field]!.text)) return clarify("시각과 다른 필드의 인용이 겹칩니다. 별도로 입력해 주세요.");
      }
      groundedActions.push({ text: canonicalText + (localVerb ? "" : isUpdate ? " 변경해" : " 추가해"), intent: remapped });
    }
    let residual = latest;
    for (const span of spans.sort((a, b) => b.start - a.start)) residual = residual.slice(0, span.start) + " " + residual.slice(span.end);
    residual = residual.replace(/이어하자|다음으로|그리고|만들어|추가해|생성해|등록해|수정해|변경해|옮겨|주세요|줘|및|하고|와|과|을|를|[\s,.!?]/g, "");
    if (residual) return clarify("구절 밖에 확인하지 못한 조건이 있습니다. 모든 조건을 실행안 안에 명시해 주세요.");
    return { operation: "actions", actions: groundedActions, message: "최대 3개 실행안을 각각 검토합니다. 별도 승인 전에는 실행되지 않습니다." };
  }
  if (intent.actions.length || intent.status !== null) return clarify("업무 저장·수정에 실행 또는 완료 상태를 섞을 수 없습니다.");
  if (/(?:저장하지|변경하지|수정하지|하지\s*마|잊어|삭제|취소)/.test(latest)) return clarify("업무 저장·변경 의도를 다시 확인해 주세요. 잊기와 알림 취소는 별도 동작입니다.");
  if (intent.operation === "preview" && (!intent.goal || !/(?:업무|작업).*(?:저장|시작)|(?:저장|시작).*(?:업무|작업)/.test(latest))) return clarify("목표를 명시하고 진행 업무로 저장하거나 시작한다고 요청해 주세요.");
  if (intent.operation === "update" && (!context || context.forgottenAt || !["active", "paused"].includes(context.status))) return clarify("수정할 진행 중 업무를 선택해 주세요.");
  if (intent.operation === "update" && intent.goal && intent.goal.text.trim() !== context!.goal) return clarify("다른 목표는 기존 업무를 덮어쓰지 않고 새 업무로 저장해 주세요.");
  if (intent.progress && !/(?:했|마쳤|끝냈|완료|까지|진행\s*(?:상황|상태|내용)|현재.*(?:상태|중))/.test(latest)) return clarify("현재까지 진행한 내용을 명시해 주세요.");
  if (intent.nextStep && !/(?:다음|이어서|남은|이어\s*할)/.test(latest)) return clarify("다음에 할 행동을 명시해 주세요.");
  const base: WorkInput = context && intent.operation === "update" ? { goal: context.goal, progress: context.progress, nextStep: context.nextStep, deadlineAt: context.deadlineAt, reminderAt: context.reminderAt, deadlineReminder: context.deadlineReminder, resumeReminder: context.resumeReminder } : { goal: "", progress: "", nextStep: "", deadlineAt: null, reminderAt: null, deadlineReminder: false, resumeReminder: false };
  if (intent.goal) base.goal = intent.goal.text;
  if (intent.progress) base.progress = intent.progress.text;
  if (intent.nextStep) base.nextStep = intent.nextStep.text;
  for (const field of ["deadline", "reminder"] as const) {
    const quote = intent[field];
    if (quote) {
      if (!(field === "deadline" ? /마감|기한/ : /알려|알림|리마인드/).test(latest)) return clarify("마감인지 알림 시각인지 직접 명시해 주세요.");
      const parsed = quotedTime(quote.text, now); if (!parsed) return clarify("날짜와 시각을 함께 입력해 주세요. 예: 내일 19:00 또는 내일 오후 7시."); base[field === "deadline" ? "deadlineAt" : "reminderAt"] = parsed;
    }
  }
  for (const field of ["deadlineReminder", "resumeReminder"] as const) {
    const value = intent[field];
    if (value === null) continue;
    const cue = field === "deadlineReminder" ? /마감\s*알림(?:을|은|이|도)?\s*/g : /재개\s*알림(?:을|은|이|도)?\s*/g;
    const mentions = Array.from(latest.matchAll(cue));
    const tail = mentions.length === 1 ? latest.slice(mentions[0].index! + mentions[0][0].length) : "";
    const choice = value ? /^(?:켜(?:줘|주세요)?|설정해(?:줘|주세요)?|동의해|받을게)(?=$|[\s,.!?])/ : /^(?:꺼(?:줘|주세요)?|해제해(?:줘|주세요)?|중지해(?:줘|주세요)?|받지\s*않을게)(?=$|[\s,.!?])/;
    if (!choice.test(tail)) return clarify("마감·재개 알림 동의를 직접 명확히 지정해 주세요.");
    base[field] = value;
  }
  if (intent.operation === "update" && ![intent.progress, intent.nextStep, intent.deadline, intent.reminder].some(Boolean) && intent.deadlineReminder === null && intent.resumeReminder === null) return clarify("변경할 진행 내용이나 다음 행동을 입력해 주세요.");
  try { return { operation: intent.operation, input: validateWorkInput(base), message: "명시한 업무 상태만 준비했습니다. 저장 확인 전에는 지속 기억이나 알림을 변경하지 않습니다." }; } catch (error) { return clarify(error instanceof Error ? error.message : "업무 입력을 확인해 주세요."); }
}
