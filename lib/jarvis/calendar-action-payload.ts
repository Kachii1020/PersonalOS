export type CalendarActionType = "CREATE_CALENDAR_EVENT" | "UPDATE_CALENDAR_EVENT";

export type CreateCalendarActionPayload = {
  version: 1;
  calendarId: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  timezone: "Asia/Tokyo";
  description: string | null;
  location: string | null;
};

export type UpdateCalendarActionPayload = CreateCalendarActionPayload & {
  eventId: string;
  expectedUid: string;
  expectedEtag: string;
  beforeSnapshotHash: string;
};

export type CalendarActionPayload = CreateCalendarActionPayload | UpdateCalendarActionPayload;
const COMMON_KEYS = ["version", "calendarId", "summary", "startsAt", "endsAt", "timezone", "description", "location"];
const UPDATE_KEYS = ["eventId", "expectedUid", "expectedEtag", "beforeSnapshotHash"];
const MAX_DURATION = 7 * 24 * 60 * 60 * 1000;

function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error(`${field}: 유효한 UUID가 필요합니다.`);
  return value.toLowerCase();
}

function text(value: unknown, field: string, max: number, optional = false): string | null {
  if (optional && (value === null || value === undefined)) return null;
  if (typeof value !== "string" || value.length > max || (!optional && !value.trim())) throw new Error(`${field}: ${max}자 이내의 문자열이 필요합니다.`);
  if (Array.from(value).some((character) => character.charCodeAt(0) === 0 || (character.charCodeAt(0) < 32 && (field !== "description" || ![9, 10, 13].includes(character.charCodeAt(0)))))) throw new Error(`${field}: 제어 문자는 사용할 수 없습니다.`);
  return value.trim() || null;
}

function instant(value: unknown, field: string): { value: string; milliseconds: number } {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || value.endsWith("-00:00")) throw new Error(`${field}: 시간대가 명시된 ISO 날짜·시각이 필요합니다.`);
  const day = value.slice(0, 10);
  const dateOnly = Date.parse(day);
  const parsed = Date.parse(value);
  if (!Number.isFinite(dateOnly) || new Date(dateOnly).toISOString().slice(0, 10) !== day || !Number.isFinite(parsed) || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) throw new Error(`${field}: 실제 달력 날짜·시각이 올바르지 않습니다.`);
  const fraction = /\.(\d+)/.exec(value)?.[1] ?? "";
  // iCalendar serializes whole seconds; do not approve precision it will drop.
  if (/[1-9]/.test(fraction)) throw new Error(`${field}: 캘린더 일정은 초 단위 시각만 지원합니다.`);
  return { value: value.replace(/\.0+(?=Z|[+-])/, ""), milliseconds: parsed };
}

export function parseCalendarActionPayload(type: "CREATE_CALENDAR_EVENT", input: unknown): CreateCalendarActionPayload;
export function parseCalendarActionPayload(type: "UPDATE_CALENDAR_EVENT", input: unknown): UpdateCalendarActionPayload;
export function parseCalendarActionPayload(type: CalendarActionType, input: unknown): CalendarActionPayload;
export function parseCalendarActionPayload(type: CalendarActionType, input: unknown): CalendarActionPayload {
  if (type !== "CREATE_CALENDAR_EVENT" && type !== "UPDATE_CALENDAR_EVENT") throw new Error("지원하지 않는 캘린더 작업입니다.");
  if (input === null || typeof input !== "object" || Array.isArray(input) || (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)) throw new Error("캘린더 payload는 JSON 객체여야 합니다.");
  const record = input as Record<string, unknown>;
  const allowed = type === "UPDATE_CALENDAR_EVENT" ? [...COMMON_KEYS, ...UPDATE_KEYS] : COMMON_KEYS;
  if (Reflect.ownKeys(record).some((key) => typeof key !== "string" || !allowed.includes(key))) throw new Error("캘린더 payload에 허용하지 않은 필드가 있습니다.");
  if (record.version !== 1 || record.timezone !== "Asia/Tokyo") throw new Error("캘린더 payload 버전 1과 Asia/Tokyo 시간대가 필요합니다.");
  const start = instant(record.startsAt, "startsAt");
  const end = instant(record.endsAt, "endsAt");
  if (end.milliseconds <= start.milliseconds || end.milliseconds - start.milliseconds > MAX_DURATION) throw new Error("종료는 시작 이후여야 하며 일정 길이는 7일 이하여야 합니다.");
  const common: CreateCalendarActionPayload = {
    version: 1, calendarId: uuid(record.calendarId, "calendarId"),
    summary: text(record.summary, "summary", 300)!, startsAt: start.value, endsAt: end.value,
    timezone: "Asia/Tokyo", description: text(record.description, "description", 4000, true), location: text(record.location, "location", 300, true),
  };
  if (type === "CREATE_CALENDAR_EVENT") return common;
  text(record.expectedUid, "expectedUid", 255);
  const uid = record.expectedUid as string;
  const etag = record.expectedEtag;
  // If-Match needs a single strong entity-tag. A wildcard would bypass the
  // reviewed version; a weak tag cannot establish representation identity.
  if (typeof etag !== "string" || etag.length > 512 || !/^"[\x21\x23-\x7e]+"$/.test(etag)) throw new Error("expectedEtag: 강한 따옴표 ETag가 필요합니다.");
  if (typeof record.beforeSnapshotHash !== "string" || !/^[0-9a-f]{64}$/i.test(record.beforeSnapshotHash)) throw new Error("beforeSnapshotHash: SHA-256 해시가 필요합니다.");
  return { ...common, eventId: uuid(record.eventId, "eventId"), expectedUid: uid, expectedEtag: etag, beforeSnapshotHash: record.beforeSnapshotHash.toLowerCase() };
}

export function calendarUidForApproval(approvalId: string): string {
  return `jarvis-${uuid(approvalId, "approvalId")}@personal-os`;
}

export function calendarFilenameForApproval(approvalId: string): string {
  return `${calendarUidForApproval(approvalId)}.ics`;
}
