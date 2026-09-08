import type { ChatMessage, DialogueGrounding, DialogueIntent, DialogueKind } from "./dialogue-types";
import { deriveDialogueReadFilters } from "./dialogue-read-filters";

const KINDS: DialogueKind[] = ["read_tasks", "read_calendar", "read_career", "create_task", "create_calendar", "update_calendar", "clarify"];
const QUOTE_KEYS = ["title", "date", "time", "duration"] as const;
const JST = 9 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Reflect.ownKeys(value).length === keys.length && Reflect.ownKeys(value).every((key) => typeof key === "string" && keys.includes(key));
}

export function validateDialogueIntent(raw: unknown): DialogueIntent {
  if (!record(raw) || !exactKeys(raw, ["kind", "sourceId", ...QUOTE_KEYS]) || !KINDS.includes(raw.kind as DialogueKind)) throw new Error("대화 의도 형식이 올바르지 않습니다.");
  if (raw.sourceId !== null && (typeof raw.sourceId !== "string" || !raw.sourceId.trim() || raw.sourceId.length > 200)) throw new Error("대상 출처 ID가 올바르지 않습니다.");
  const quotes = Object.fromEntries(QUOTE_KEYS.map((key) => {
    const quote = raw[key];
    if (quote === null) return [key, null];
    if (!record(quote) || !exactKeys(quote, ["messageIndex", "text"]) || !Number.isInteger(quote.messageIndex) || (quote.messageIndex as number) < 0 || (quote.messageIndex as number) > 39 || typeof quote.text !== "string" || !quote.text.trim() || quote.text.length > 1000) throw new Error(`${key}: 사용자 입력 인용 형식이 올바르지 않습니다.`);
    return [key, { messageIndex: quote.messageIndex, text: quote.text }];
  }));
  return { kind: raw.kind, sourceId: raw.sourceId, ...quotes } as DialogueIntent;
}

function parseDate(value: string, referenceTime: Date): string | null {
  const relative = ["오늘", "내일", "모레"].indexOf(value.trim());
  if (relative >= 0) return new Date(referenceTime.getTime() + JST + relative * DAY).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = Date.parse(value);
  return Number.isFinite(date) && new Date(date).toISOString().slice(0, 10) === value ? value : null;
}

function parseTime(value: string): string | null {
  const text = value.trim();
  const clock = /^(\d{2}):(\d{2})$/.exec(text);
  if (clock) return Number(clock[1]) <= 23 && Number(clock[2]) <= 59 ? text : null;
  const korean = /^(오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?$/.exec(text);
  if (!korean || Number(korean[2]) < 1 || Number(korean[2]) > 12 || Number(korean[3] ?? 0) > 59) return null;
  const hour = Number(korean[2]) % 12 + (korean[1] === "오후" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${String(korean[3] ?? "0").padStart(2, "0")}`;
}

function parseDuration(value: string): number | null {
  const match = /^(?:(\d{1,5})시간(?:\s*(\d{1,5})분)?|(\d{1,5})분)$/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1] ?? 0) * 60 + Number(match[2] ?? match[3] ?? 0);
  return minutes > 0 && minutes <= 7 * 24 * 60 ? minutes : null;
}

function temporalTokens(content: string): { date: string[]; time: string[]; duration: string[] } {
  // Dates embedded in identifiers (g6a-2026-09-08-...) are title data.
  const datePattern = /(?<![A-Za-z0-9_-])\d{4}-\d{2}-\d{2}(?![A-Za-z0-9_-])|오늘|내일|모레/g;
  const date = content.match(datePattern) ?? [];
  const withoutDates = content.replace(datePattern, (match) => " ".repeat(match.length));
  // Consume an entire clock first: its minute component is not a duration.
  const clockPattern = /(?<![\d:])\d{1,2}:\d{2}(?![\d:])|(?:(?:오전|오후)\s*)?\d{1,2}시(?!간)(?:\s*\d{1,2}분)?/g;
  const time = withoutDates.match(clockPattern) ?? [];
  const withoutClocks = withoutDates.replace(clockPattern, (match) => " ".repeat(match.length));
  const duration = withoutClocks.match(/\d{1,5}시간(?:\s*\d{1,5}분)?|\d{1,5}분/g) ?? [];
  return { date, time, duration };
}

function unsupportedTimezone(content: string): boolean {
  // Remove only the positively supported, explicitly named timezone forms.
  // All remaining timezone cues are unresolved; country-name lists are unsafe.
  const remaining = content.replace(/(?:\bJST\b|Asia\/Tokyo|일본\s*(?:현지\s*)?시간)(?:\s*(?:시간)?\s*기준)?/gi, " ");
  return /(?:현지\s*시간|표준\s*시간|시간대|시간\s*기준|\b(?:UTC|GMT)(?:[+-]\d{1,2}(?::?\d{2})?)?\b|(?<![A-Za-z0-9_-])[+-]\d{2}:?\d{2}(?![A-Za-z0-9_-])|[A-Za-z_]+\/[A-Za-z_]+|\b[A-Z]{2,5}\b\s*(?:기준|시간|timezone\b|time\b))/i.test(remaining);
}

function slotOnlyAnswer(latest: string): boolean {
  const tokens = temporalTokens(latest);
  if (!tokens.date.length && !tokens.time.length && !tokens.duration.length) return false;
  let residual = latest;
  for (const token of [...tokens.date, ...tokens.time, ...tokens.duration].sort((a, b) => b.length - a.length)) residual = residual.replace(token, " ");
  // Only slot answers inherit the prior request; a new read or another action
  // leaves meaningful text here and cannot be converted into a write.
  return residual.replace(/(?:으로|로|입니다|이야|이에요|예요|그리고|에|은|는|요|[\s,.!?])/g, "").length === 0;
}

function readRequest(content: string): boolean {
  return /(?:보여\s*(?:줘|주세요|줄래|주실)|알려\s*(?:줘|주세요|줄래|주실)|(?:조회|검색|확인)\s*(?:해|하고\s*싶어))/.test(content);
}

function cancellation(content: string): boolean {
  return /(?:하지\s*마|만들지\s*마|추가하지\s*마|취소|실행하지|무시해)/.test(content);
}

function quotedRequestContinuation(content: string): boolean {
  if (slotOnlyAnswer(content)) return true;
  const tokens = temporalTokens(content);
  const noDeadline = /마감\s*없(?:이|는)/.test(content);
  if (!noDeadline && !tokens.date.length && !tokens.time.length && !tokens.duration.length) return false;
  let residual = content;
  for (const token of [...tokens.date, ...tokens.time, ...tokens.duration].sort((a, b) => b.length - a.length)) residual = residual.replace(token, " ");
  residual = residual.replace(/마감\s*없(?:이|는)|마감(?:으로|은|을|에)?|기한(?:으로|은|을|에)?/g, " ");
  residual = residual.replace(/(?:추가|변경|수정|생성|등록)해|만들어|넣어|옮겨/g, " ");
  return residual.replace(/(?:주세요|줘|으로|로|입니다|이야|이에요|예요|그리고|에|은|는|요|[\s,.!?])/g, "").length === 0;
}

function inheritsUserWrite(intent: DialogueIntent, messages: ChatMessage[], userIndex: number): boolean {
  if (!slotOnlyAnswer(messages[userIndex].content)) return false;
  let examined = 0;
  for (let index = userIndex - 1; index >= 0 && examined < 6; index--) {
    const message = messages[index];
    if (message.role !== "user") continue;
    examined++;
    const content = message.content;
    if (cancellation(content) || readRequest(content) || /(?:삭제|이메일|전송)/.test(content)) return false;
    const update = /(?:옮겨|변경|수정)/.test(content);
    const create = /(?:추가|만들|생성|등록|잡아|잡고|넣어)/.test(content);
    if (update || create) {
      if (intent.kind === "update_calendar") return update && /(?:일정|캘린더)/.test(content);
      if (update) return false;
      if (intent.kind === "create_task") return /(?:할\s*일|태스크|task)/i.test(content);
      return intent.kind === "create_calendar" && /(?:일정|캘린더|잡아|잡고)/.test(content);
    }
    const priorTokens = temporalTokens(content);
    let priorResidual = content;
    for (const token of [...priorTokens.date, ...priorTokens.time, ...priorTokens.duration].sort((a, b) => b.length - a.length)) priorResidual = priorResidual.replace(token, " ");
    if (priorResidual.replace(/(?:으로|로|입니다|이야|이에요|예요|그리고|에|은|는|요|[\s,.!?])/g, "")) return false;
  }
  return false;
}

/** Model output chooses an intent only; fields must be traced to user messages. */
export function groundDialogueIntent(intent: DialogueIntent, messages: ChatMessage[], referenceTime: Date, allowedSourceIds: string[], selectedSourceId?: string | null): DialogueGrounding {
  intent = validateDialogueIntent(intent);
  const empty: DialogueGrounding = { kind: intent.kind, message: "", needsClarification: false, title: null, sourceId: null, startsAt: null, endsAt: null, queryDate: null, evidence: [] };
  const clarify = (message: string): DialogueGrounding => ({ ...empty, kind: "clarify", message, needsClarification: true });
  if (!Number.isFinite(referenceTime.getTime())) return clarify("기준 시각을 확인한 뒤 다시 요청해 주세요.");
  const userIndex = messages.findLastIndex((message) => message.role === "user");
  if (userIndex < 0) return clarify("요청 내용을 입력해 주세요.");
  const latest = messages[userIndex].content;
  for (const field of QUOTE_KEYS) {
    const quote = intent[field];
    if (quote && (messages[quote.messageIndex]?.role !== "user" || !messages[quote.messageIndex].content.includes(quote.text))) return clarify("요청에서 확인할 수 없는 값이 있습니다. 원하는 내용을 직접 입력해 주세요.");
  }
  if (intent.sourceId && !allowedSourceIds.includes(intent.sourceId)) return clarify("현재 확인할 수 있는 대상이 아닙니다. 목록에서 대상을 다시 골라 주세요.");
  if (selectedSourceId != null && (!allowedSourceIds.includes(selectedSourceId) || (intent.kind === "update_calendar" && intent.sourceId !== selectedSourceId))) return clarify("직접 선택한 대상과 요청의 대상이 일치하지 않습니다. 목록에서 다시 선택해 주세요.");
  if (intent.kind === "clarify") return clarify("원하는 조회나 할 일·일정 요청을 구체적으로 입력해 주세요. 일정에는 날짜, 오전·오후 시각, 소요 시간이 필요합니다.");
  const isWrite = ["create_task", "create_calendar", "update_calendar"].includes(intent.kind);
  if (isWrite && readRequest(latest)) return clarify("조회 요청으로 확인했습니다. 생성·변경 제안은 준비하지 않았습니다.");
  if (isWrite && cancellation(latest)) return clarify("변경은 준비하지 않았습니다. 필요한 요청을 다시 확인해 주세요.");
  const currentQuote = (field: typeof QUOTE_KEYS[number]) => intent[field]?.messageIndex === userIndex;
  const completeCorrection = intent.kind === "create_task"
    ? currentQuote("title") && ((currentQuote("date") && currentQuote("time") && !intent.duration) || (!intent.date && !intent.time && !intent.duration && /마감\s*없(?:이|는)/.test(latest)))
    : currentQuote("date") && currentQuote("time") && currentQuote("duration") && (intent.kind === "update_calendar" ? intent.title === null || currentQuote("title") : currentQuote("title"));
  if (isWrite && /(?:아니[ ,]|말고|대신|정정)/.test(latest) && !completeCorrection) return clarify("정정하신 최종 제목·날짜·시각·소요 시간을 한 번에 입력해 주세요.");
  const lastCancellation = messages.findLastIndex((message) => message.role === "user" && cancellation(message.content));
  const renewedUpdate = lastCancellation < 0 || messages.slice(lastCancellation + 1, userIndex + 1).some((message) => message.role === "user" && /(?:옮겨|변경|수정)/.test(message.content) && !readRequest(message.content) && !cancellation(message.content));
  const selectedUpdate = intent.kind === "update_calendar" && selectedSourceId != null && selectedSourceId === intent.sourceId && slotOnlyAnswer(latest) && renewedUpdate;
  if (isWrite && !/(?:추가|만들|생성|등록|잡아|잡고|옮겨|변경|수정|넣어)/.test(latest) && !inheritsUserWrite(intent, messages, userIndex) && !selectedUpdate) return clarify("할 일이나 일정을 만들거나 변경하려는 요청인지 확인해 주세요.");
  if (isWrite) {
    for (const field of QUOTE_KEYS) {
      const quote = intent[field];
      if (!quote || quote.messageIndex === userIndex) continue;
      for (let index = quote.messageIndex + 1; index <= userIndex; index++) {
        const message = messages[index];
        if (message.role !== "user") continue;
        if (cancellation(message.content) || readRequest(message.content)) return clarify("이전 요청 이후 의도가 바뀌었습니다. 현재 요청의 내용을 다시 입력해 주세요.");
        const independentWrite = /(?:추가|만들|생성|등록|잡아|넣어|옮겨|변경|수정)/.test(message.content) && /(?:일정|캘린더|할\s*일|태스크)/.test(message.content);
        if (independentWrite && !slotOnlyAnswer(message.content)) return clarify("새 요청에 이전 제목·날짜·시각을 섞을 수 없습니다. 새 요청의 내용을 모두 입력해 주세요.");
        if (!quotedRequestContinuation(message.content)) return clarify("새로운 내용이 포함된 요청에는 이전 값을 재사용하지 않습니다. 현재 요청의 제목·날짜·시각을 확인해 주세요.");
      }
    }
  }
  if (unsupportedTimezone(latest) && (isWrite || intent.kind === "read_calendar")) return clarify("현재 일정 요청은 일본 시간(Asia/Tokyo)만 지원합니다. 일본 날짜와 시각으로 입력해 주세요.");
  const latestTokens = temporalTokens(intent.kind === "read_tasks" || intent.kind === "read_career" ? latest.replace(/제목(?:에|이)?\s*["“'][^"”'\r\n]*["”']/g, " ") : latest);
  if (isWrite && (latestTokens.time.length > 1 || latestTokens.duration.length > 1)) return clarify("시각 또는 소요 시간이 여러 개 있습니다. 원하는 시각과 소요 시간을 하나씩 입력해 주세요.");
  for (const field of ["date", "time", "duration"] as const) {
    const quote = intent[field];
    if (quote) {
      const origin = messages[quote.messageIndex].content;
      const tokens = temporalTokens(origin);
      if (unsupportedTimezone(origin) || (isWrite && field !== "date" && tokens[field].length > 1)) return clarify("인용한 요청의 시간대 또는 시각·소요 시간이 불명확합니다. 일본 시간으로 하나씩 입력해 주세요.");
      if (!tokens[field].includes(quote.text.trim())) return clarify("날짜·시각·소요 시간은 입력한 전체 표현으로 확인해야 합니다.");
    }
  }
  // A newer explicit value cannot be silently replaced by an older quote.
  for (const field of ["date", "time", "duration"] as const) {
    if (isWrite && latestTokens[field].length > 0 && intent[field] && intent[field]!.messageIndex !== userIndex) return clarify("가장 최근에 말씀한 날짜·시각·소요 시간으로 다시 확인해 주세요.");
  }
  const evidence = QUOTE_KEYS.flatMap((field) => intent[field] ? [intent[field]!] : []);
  if (isWrite && !intent.date && (latestTokens.date.length > 0 || /다음\s*주|이번\s*주/.test(latest))) return clarify("말씀한 날짜를 명확히 확인해야 합니다. YYYY-MM-DD 또는 오늘·내일·모레로 입력해 주세요.");
  if (isWrite && !intent.time && /\d{1,2}:\d{2}|\d{1,2}시(?!간)/.test(latest)) return clarify("말씀한 시각과 날짜를 함께 확인해야 합니다.");
  if (new Set(latestTokens.date).size > 1) return clarify("요청에 날짜가 여러 개 있습니다. 원하는 날짜 하나로 다시 입력해 주세요.");
  const dateText = intent.kind.startsWith("read_") ? latestTokens.date[0] ?? null : intent.date?.text ?? null;
  const date = dateText ? parseDate(dateText, referenceTime) : null;
  if (dateText && !date) return clarify("날짜는 YYYY-MM-DD 또는 오늘·내일·모레로 입력해 주세요.");
  if (intent.kind.startsWith("read_")) {
    if (intent.time || intent.duration || latestTokens.time.length || latestTokens.duration.length || intent.sourceId !== null) return clarify("지원하지 않는 조회 조건입니다. 날짜별 일정 또는 할 일·커리어 목록 조건을 확인해 주세요.");
    if (intent.kind === "read_tasks" || intent.kind === "read_career") {
      const readFilters = deriveDialogueReadFilters(intent.kind, latest, dateText);
      if (!readFilters) return clarify("조회 조건이 불명확하거나 지원하지 않습니다. 날짜·상태·정렬·제목 조건을 다시 확인해 주세요.");
      if (intent.title && (intent.title.messageIndex !== userIndex || intent.title.text !== readFilters.keyword)) return clarify("모델이 제안한 제목 조건이 사용자가 직접 지정한 검색어와 일치하지 않습니다.");
      return { ...empty, message: intent.kind === "read_tasks" ? "요청한 조건의 할 일 목록입니다." : "요청한 조건의 커리어 기회입니다.", queryDate: date, readFilters, evidence };
    }
    if (intent.title || deriveDialogueReadFilters("read_calendar", latest, dateText) === null) return clarify("현재 일정 조회는 날짜 하나만 지정할 수 있습니다. 제목·빈 시간·정렬 등 추가 조건은 지원하지 않습니다.");
    return { ...empty, message: "일본 시간 기준 일정입니다.", queryDate: date, evidence };
  }
  if (intent.kind !== "update_calendar" && intent.sourceId !== null) return clarify("새 항목에는 기존 대상 ID를 지정할 수 없습니다.");
  if (intent.kind === "update_calendar" && !intent.sourceId) return clarify("변경할 일정을 목록에서 지정해 주세요.");
  const title = intent.title?.text.trim() ?? null;
  const titleLimit = intent.kind === "create_task" ? 200 : 300;
  if ((!title && intent.kind !== "update_calendar") || (title && (title.length > titleLimit || /[\r\n]/.test(title)))) return clarify(`제목을 ${titleLimit}자 이내의 한 줄로 입력해 주세요.`);
  if (intent.kind === "create_task" && !intent.date && !intent.time && !intent.duration) return { ...empty, message: "마감 없는 할 일 제안을 준비했습니다. 승인 전에는 생성되지 않습니다.", title, evidence };
  if (!date || !intent.time) return clarify("날짜와 시각을 함께 입력해 주세요. 시각은 오전·오후 또는 24시간 HH:MM 형식이 필요합니다.");
  const time = parseTime(intent.time.text);
  if (!time) return clarify("시각을 오전·오후 n시 n분 또는 24시간 HH:MM으로 명확히 입력해 주세요.");
  const startsAt = `${date}T${time}:00+09:00`;
  if (intent.kind === "create_task") {
    if (intent.duration) return clarify("할 일 마감에는 소요 시간을 적용하지 않습니다. 마감 날짜와 시각만 입력해 주세요.");
    return { ...empty, message: "입력한 일본 시간 마감으로 할 일 제안을 준비했습니다. 승인 전에는 생성되지 않습니다.", title, startsAt, queryDate: date, evidence };
  }
  const minutes = intent.duration ? parseDuration(intent.duration.text) : null;
  if (minutes === null) return clarify("일정 소요 시간을 n시간 또는 n분으로 입력해 주세요. 최대 7일까지 지원합니다.");
  const endsAt = new Date(Date.parse(startsAt) + minutes * 60_000 + JST).toISOString().slice(0, 19) + "+09:00";
  return { ...empty, message: "입력한 일본 날짜·시각으로 일정 제안을 준비했습니다. 승인 전에는 실행되지 않습니다.", title, sourceId: intent.sourceId, startsAt, endsAt, queryDate: date, evidence };
}
