import { createHash } from "node:crypto";
import ICAL from "ical.js";
import ical from "ical-generator";
import { calendarFilenameForApproval, calendarUidForApproval, parseCalendarActionPayload, type CalendarActionPayload, type CalendarActionType, type UpdateCalendarActionPayload } from "@/lib/jarvis/calendar-action-payload";
import { parseEvent, type ParsedEvent } from "./parse";

export type CalendarObjectSnapshot = { data: string; etag: string };
export type ApprovedCalendarTransport = {
  configuredCalendarName?: string;
  listCalendars(): Promise<{ url: string; displayName: string }[]>;
  /** null means a confirmed 404, never an omitted/failed response. */
  read(calendarUrl: string, href: string): Promise<CalendarObjectSnapshot | null>;
  create(calendarUrl: string, filename: string, data: string): Promise<{ status: number }>;
  update(href: string, data: string, etag: string): Promise<{ status: number }>;
};
export type ApprovedCalendarResult =
  | { kind: "verified"; uid: string; href: string; etag: string; parsedEvent: ParsedEvent; reconciled: boolean }
  | { kind: "conflict" | "uncertain"; message: string; uid?: string; href?: string };
export type ApprovedCalendarInput = { approvalId: string; type: CalendarActionType; payload: unknown; calendarSourceUrl: string; eventHref?: string };

class CalendarConflict extends Error {}
function conflict(message: string): never { throw new CalendarConflict(message); }
const strongEtag = (value: string) => value.length <= 512 && /^"[\x21\x23-\x7e]+"$/.test(value);

export function hashCalendarSnapshot(rawIcs: string): string {
  return createHash("sha256").update(rawIcs, "utf8").digest("hex");
}

function calendarUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || !url.pathname.endsWith("/") || /%2f|%5c|%2e/i.test(value)) conflict("허용되지 않은 캘린더 URL입니다.");
  return url;
}

function objectHref(base: string, value: string): string {
  const calendar = calendarUrl(base);
  if (/%25/i.test(value) || Array.from(decodeURIComponent(value)).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) conflict("일정 URL에 중첩 인코딩 또는 제어 문자가 있습니다.");
  const object = new URL(value);
  if (object.protocol !== "https:" || object.username || object.password || object.origin !== calendar.origin || object.search || object.hash || /%2f|%5c|%2e|\\/i.test(value) || !object.pathname.startsWith(calendar.pathname)) conflict("일정 URL이 승인된 캘린더 밖에 있습니다.");
  const child = object.pathname.slice(calendar.pathname.length);
  if (!child || child.includes("/") || !child.endsWith(".ics") || /%(?!40)/i.test(child)) conflict("일정은 승인된 캘린더의 직접 하위 리소스여야 합니다.");
  return object.href;
}

function resourceIdentity(calendar: string, href: string): string {
  const checked = new URL(objectHref(calendar, href));
  return checked.origin + decodeURIComponent(checked.pathname);
}

export function approvedCalendarMultigetBody(calendar: string, href: string): string {
  const path = new URL(objectHref(calendar, href)).pathname;
  const escaped = path.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  return `<?xml version="1.0" encoding="utf-8"?><c:calendar-multiget xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><d:href>${escaped}</d:href></c:calendar-multiget>`;
}

/** Parse lower-level SDK DAV rows; collection/transport failures are not 404s. */
export function parseApprovedCalendarDavRows(rows: unknown, calendar: string, requestedHref: string): CalendarObjectSnapshot | null {
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("정확한 일정 조회 응답이 없습니다.");
  const row = rows[0];
  if (row === null || typeof row !== "object" || typeof row.href !== "string" || resourceIdentity(calendar, new URL(row.href, calendar).href) !== resourceIdentity(calendar, requestedHref)) throw new Error("조회 응답 대상이 요청한 일정과 다릅니다.");
  if (row.raw === null || typeof row.raw !== "object" || !row.raw.multistatus || typeof row.raw.multistatus !== "object") throw new Error("리소스별 DAV 응답이 아닙니다. 캘린더 또는 통신 상태를 확인해야 합니다.");
  if (row.status === 404 && row.ok === false) return null;
  const data = row.props?.calendarData?._cdata ?? row.props?.calendarData;
  const etag = row.props?.getetag;
  if (row.ok !== true || !Number.isInteger(row.status) || row.status < 200 || row.status >= 300 || typeof data !== "string" || typeof etag !== "string" || !strongEtag(etag)) throw new Error("일정 원문·ETag를 읽지 못했습니다.");
  return { data, etag };
}

async function authoritativeCalendar(provided: string, transport: ApprovedCalendarTransport): Promise<string> {
  const candidates = (await transport.listCalendars()).filter((entry) => entry.displayName === (transport.configuredCalendarName ?? process.env.APP_CALENDAR_NAME ?? "Personal OS"));
  if (candidates.length !== 1) conflict("원격 앱 전용 캘린더가 정확히 하나여야 합니다.");
  const trusted = calendarUrl(candidates[0].url).href;
  if (calendarUrl(provided).href !== trusted) conflict("저장된 캘린더 URL이 원격 앱 전용 캘린더와 다릅니다.");
  return trusted;
}

function inspect(snapshot: CalendarObjectSnapshot): { root: ICAL.Component; event: ICAL.Component; parsed: ParsedEvent } {
  if (typeof snapshot.data !== "string" || snapshot.data.length > 512_000 || !strongEtag(snapshot.etag)) conflict("일정 원문 또는 강한 ETag를 확인할 수 없습니다.");
  const root = new ICAL.Component(ICAL.parse(snapshot.data));
  const events = root.getAllSubcomponents("vevent");
  if (root.name !== "vcalendar" || events.length !== 1 || root.hasProperty("method")) conflict("단일 일반 일정만 지원합니다.");
  const event = events[0];
  if (["attendee", "organizer", "rrule", "rdate", "exdate", "recurrence-id"].some((key) => event.hasProperty(key))) conflict("초대 또는 반복 일정은 변경할 수 없습니다.");
  for (const property of ["uid", "dtstart", "dtend", "summary", "description", "location"]) if (event.getAllProperties(property).length > 1) conflict("중복 일정 속성은 지원하지 않습니다.");
  const parsed = parseEvent(snapshot.data);
  if (!parsed || parsed.isAllDay || !event.hasProperty("dtstart") || (!event.hasProperty("dtend") && !event.hasProperty("duration")) || !/^(?:jarvis-)?[0-9a-f-]{36}@personal-os$/i.test(parsed.uid)) conflict("앱에서 만든 시작·종료 시각이 있는 일정만 지원합니다.");
  if (Date.parse(parsed.endsAt) <= Date.parse(parsed.startsAt)) conflict("일정 종료 시각이 올바르지 않습니다.");
  const summary = event.getFirstPropertyValue("summary");
  const description = event.getFirstPropertyValue("description") ?? null;
  const location = event.getFirstPropertyValue("location") ?? null;
  if (typeof summary !== "string" || !summary.trim() || (description !== null && typeof description !== "string") || (location !== null && typeof location !== "string")) conflict("원래 일정의 텍스트 속성을 그대로 확인할 수 없습니다.");
  return { root, event, parsed: { ...parsed, summary, description, location } };
}

function matches(parsed: ParsedEvent, payload: CalendarActionPayload, uid: string, event: ICAL.Component): boolean {
  // Mirror parsing trims text for display; execution verification must compare
  // the actual decoded properties rather than that lossy display projection.
  const field = (name: string) => event.getFirstPropertyValue(name) ?? null;
  return parsed.uid === uid && field("summary") === payload.summary && field("description") === payload.description && field("location") === payload.location && Date.parse(parsed.startsAt) === Date.parse(payload.startsAt) && Date.parse(parsed.endsAt) === Date.parse(payload.endsAt);
}

function updatedIcs(snapshot: CalendarObjectSnapshot, payload: UpdateCalendarActionPayload): string {
  const { root, event } = inspect(snapshot);
  for (const [key, value] of [["summary", payload.summary], ["description", payload.description], ["location", payload.location]] as const) {
    // Time-only updates must retain original text and its property parameters.
    if ((event.getFirstPropertyValue(key) ?? null) === value) continue;
    event.removeAllProperties(key);
    if (value !== null) event.addPropertyWithValue(key, value);
  }
  for (const key of ["dtstart", "dtend", "duration"]) event.removeAllProperties(key);
  event.addPropertyWithValue("dtstart", ICAL.Time.fromJSDate(new Date(payload.startsAt), true));
  event.addPropertyWithValue("dtend", ICAL.Time.fromJSDate(new Date(payload.endsAt), true));
  return root.toString();
}

export async function readApprovedCalendarTarget(calendarSourceUrl: string, eventHref: string, transport?: ApprovedCalendarTransport): Promise<{ uid: string; etag: string; snapshotHash: string; parsedEvent: ParsedEvent }> {
  const adapter = transport ?? await createApprovedCalendarTransport();
  const calendar = await authoritativeCalendar(calendarSourceUrl, adapter);
  const href = objectHref(calendar, eventHref);
  const snapshot = await adapter.read(calendar, href);
  if (!snapshot) conflict("일정이 원격 캘린더에 없습니다.");
  const { parsed } = inspect(snapshot);
  return { uid: parsed.uid, etag: snapshot.etag, snapshotHash: hashCalendarSnapshot(snapshot.data), parsedEvent: parsed };
}

/** One conditional write at most. Caller owns approval/lease/receipt checks. */
export async function executeApprovedCalendar(input: ApprovedCalendarInput, transport?: ApprovedCalendarTransport): Promise<ApprovedCalendarResult> {
  let uid: string | undefined; let href: string | undefined;
  try {
    const payload = parseCalendarActionPayload(input.type, input.payload);
    const stableUid = calendarUidForApproval(input.approvalId);
    const adapter = transport ?? await createApprovedCalendarTransport();
    const calendar = await authoritativeCalendar(input.calendarSourceUrl, adapter);
    uid = input.type === "CREATE_CALENDAR_EVENT" ? stableUid : (payload as UpdateCalendarActionPayload).expectedUid;
    href = objectHref(calendar, input.type === "CREATE_CALENDAR_EVENT" ? new URL(calendarFilenameForApproval(input.approvalId), calendar).href : input.eventHref ?? "");
    const before = await adapter.read(calendar, href);
    if (before) {
      const inspected = inspect(before);
      if (matches(inspected.parsed, payload, uid, inspected.event)) return { kind: "verified", uid, href, etag: before.etag, parsedEvent: inspected.parsed, reconciled: true };
      if (input.type === "CREATE_CALENDAR_EVENT") conflict("동일 UID의 원격 일정이 승인 내용과 다릅니다.");
      const update = payload as UpdateCalendarActionPayload;
      if (inspected.parsed.uid !== uid || before.etag !== update.expectedEtag || hashCalendarSnapshot(before.data) !== update.beforeSnapshotHash) conflict("승인 이후 원격 일정이 변경되었습니다. 다시 검토해야 합니다.");
    } else if (input.type === "UPDATE_CALENDAR_EVENT") conflict("수정할 원격 일정이 없습니다.");
    let status: number | null = null;
    try {
      if (input.type === "CREATE_CALENDAR_EVENT") {
        const body = ical({ name: "Personal OS" });
        body.createEvent({ id: uid, start: new Date(payload.startsAt), end: new Date(payload.endsAt), summary: payload.summary, description: payload.description ?? undefined, location: payload.location ?? undefined });
        status = (await adapter.create(calendar, calendarFilenameForApproval(input.approvalId), body.toString())).status;
      } else status = (await adapter.update(href, updatedIcs(before!, payload as UpdateCalendarActionPayload), (payload as UpdateCalendarActionPayload).expectedEtag)).status;
    } catch {
      // A lost PUT response is unresolved until the one bounded read below.
      status = null;
    }
    const after = await adapter.read(calendar, href);
    if (after) {
      const verified = inspect(after);
      if (matches(verified.parsed, payload, uid, verified.event)) return { kind: "verified", uid, href, etag: after.etag, parsedEvent: verified.parsed, reconciled: status === null || status === 412 };
      return { kind: status === 412 ? "conflict" : "uncertain", uid, href, message: "원격 일정이 승인 내용과 다릅니다. 재조회·검토가 필요합니다." };
    }
    return { kind: status === 412 ? "conflict" : "uncertain", uid, href, message: "원격 실행 결과를 확인하지 못했습니다. 재조회 전에는 다시 쓰지 않습니다." };
  } catch (error) {
    return { kind: error instanceof CalendarConflict ? "conflict" : "uncertain", uid, href, message: error instanceof Error ? error.message : "캘린더 결과를 확인할 수 없습니다." };
  }
}

/** Real transport is constructed only on explicitly invoked server paths. */
export async function createApprovedCalendarTransport(): Promise<ApprovedCalendarTransport> {
  const { createCalDavClient, appCalendarName } = await import("./client");
  const client = await createCalDavClient();
  const options = () => ({ signal: AbortSignal.timeout(20_000), redirect: "error" as const });
  return {
    configuredCalendarName: appCalendarName(),
    async listCalendars() {
      return (await client.fetchCalendars({ fetchOptions: options() })).filter((calendar) => !calendar.components || calendar.components.includes("VEVENT")).map((calendar) => ({ url: calendar.url, displayName: String(calendar.displayName ?? "") }));
    },
    async read(calendarUrl, href) {
      // collectionQuery/calendarMultiGet throw on a resource-level 404. Use
      // davRequest to retain the actual multistatus row and verify its href.
      const rows = await client.davRequest({ url: calendarUrl, init: { method: "REPORT", headers: { depth: "1" }, body: approvedCalendarMultigetBody(calendarUrl, href) }, convertIncoming: false, fetchOptions: options() });
      return parseApprovedCalendarDavRows(rows, calendarUrl, href);
    },
    async create(calendarUrl, filename, data) {
      const response = await client.createCalendarObject({ calendar: { url: calendarUrl }, filename, iCalString: data, fetchOptions: options() });
      return { status: response.status };
    },
    async update(href, data, etag) {
      const response = await client.updateCalendarObject({ calendarObject: { url: href, data, etag }, fetchOptions: options() });
      return { status: response.status };
    },
  };
}
