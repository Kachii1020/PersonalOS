import test from "node:test";
import assert from "node:assert/strict";
import ical from "ical-generator";
import { parseEvent } from "../lib/integrations/caldav/parse";
import { calendarFilenameForApproval, calendarUidForApproval, parseCalendarActionPayload, type CalendarActionType } from "../lib/jarvis/calendar-action-payload";

const calendarId = "e0534b45-8173-4485-8b49-fdb186e66b3f";
const eventId = "41c23286-5595-4b41-aafc-5247dcb718da";
const create = (patch: Record<string, unknown> = {}) => ({ version: 1, calendarId, summary: "회의 준비", startsAt: "2026-09-08T10:00:00+09:00", endsAt: "2026-09-08T11:00:00+09:00", timezone: "Asia/Tokyo", description: null, location: null, ...patch });
const update = (patch: Record<string, unknown> = {}) => ({ ...create(), eventId, expectedUid: "existing@personal-os", expectedEtag: '"etag-123"', beforeSnapshotHash: "a".repeat(64), ...patch });

test("create is a normalized strict JSON payload without a user-controlled UID", () => {
  assert.deepEqual(parseCalendarActionPayload("CREATE_CALENDAR_EVENT", create()), create());
  const input = create({ summary: "  회의  ", description: "본문\n둘째 줄", location: undefined, calendarId: calendarId.toUpperCase() });
  const result = parseCalendarActionPayload("CREATE_CALENDAR_EVENT", input);
  assert.equal(result.summary, "회의");
  assert.equal(result.calendarId, calendarId);
  assert.equal(result.description, "본문\n둘째 줄");
  assert.equal(result.location, null);
  assert.equal(input.summary, "  회의  ");
  assert.equal(parseCalendarActionPayload("CREATE_CALENDAR_EVENT", create({ description: "", location: " " })).description, null);
});

test("update requires a complete immutable target and strong ETag snapshot", () => {
  assert.deepEqual(parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", update()), update());
  for (const key of ["eventId", "expectedUid", "expectedEtag", "beforeSnapshotHash"]) {
    const input: Record<string, unknown> = update();
    delete input[key];
    assert.throws(() => parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", input));
  }
  assert.equal(parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", update({ beforeSnapshotHash: "A".repeat(64) })).beforeSnapshotHash, "a".repeat(64));
  assert.equal(parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", update({ expectedUid: " original-uid " })).expectedUid, " original-uid ");
});

test("UPDATE preserves exact existing text while CREATE keeps normalization", () => {
  for (const texts of [{ summary: "  Existing meeting  ", description: "  line one\nline two  ", location: "  Room A  " }, { summary: "Meeting", description: "", location: "" }, { summary: "Meeting", description: " ", location: "  " }]) {
    const parsed = parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", update(texts));
    assert.equal(parsed.summary, texts.summary);
    assert.equal(parsed.description, texts.description);
    assert.equal(parsed.location, texts.location);
  }
  assert.throws(() => parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", update({ summary: "  " })));
  assert.throws(() => parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", update({ location: "Room\nB" })));
  const created = parseCalendarActionPayload("CREATE_CALENDAR_EVENT", create({ summary: "  Meeting  ", description: "", location: "  " }));
  assert.equal(created.summary, "Meeting");
  assert.equal(created.description, null);
  assert.equal(created.location, null);
});

test("unknown fields and unsupported actions cannot expand the approval", () => {
  for (const key of ["href", "url", "attendees", "rrule", "allDay", "uid", "expectedUid", "calendarSourceUrl", "approved", "idempotencyKey"]) assert.throws(() => parseCalendarActionPayload("CREATE_CALENDAR_EVENT", create({ [key]: null })));
  for (const key of ["href", "url", "attendees", "rrule", "allDay"]) assert.throws(() => parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", update({ [key]: null })));
  assert.throws(() => parseCalendarActionPayload("DELETE_CALENDAR_EVENT" as CalendarActionType, create()));
  for (const input of [null, [], new Date(), Object.create({ ...create() }), create({ [Symbol("extra")]: true }), JSON.parse('{"__proto__":{}}')]) assert.throws(() => parseCalendarActionPayload("CREATE_CALENDAR_EVENT", input));
});

test("UUID and schema fields reject coercion and invalid identifiers", () => {
  for (const patch of [{ calendarId: "calendar-1" }, { calendarId: "00000000-0000-0000-0000-000000000000" }, { calendarId: 12 }, { version: "1" }, { version: 2 }, { timezone: "UTC" }, { timezone: null }]) assert.throws(() => parseCalendarActionPayload("CREATE_CALENDAR_EVENT", create(patch)));
  assert.throws(() => parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", update({ eventId: "../other" })));
});

test("dates need an explicit known offset and actual calendar values", () => {
  for (const startsAt of ["2026-09-08", "2026-09-08T10:00:00", "2026-09-08T10:00:00-00:00", "2026-02-30T10:00:00+09:00", "2025-02-29T10:00:00+09:00", "2026-09-08T24:00:00+09:00", "2026-09-08T10:60:00+09:00", "2026-09-08T10:00:60+09:00", "2026-09-08T10:00:00+25:00", "2026-09-08T10:00:00+09:60", "2026-09-08T10:00:00.1234567+09:00"]) assert.throws(() => parseCalendarActionPayload("CREATE_CALENDAR_EVENT", create({ startsAt })));
  assert.equal(parseCalendarActionPayload("CREATE_CALENDAR_EVENT", create({ startsAt: "2028-02-29T01:00:00Z", endsAt: "2028-02-29T11:00:00+09:00" })).startsAt, "2028-02-29T01:00:00Z");
});

test("duration is positive and no more than seven days at whole-second precision", () => {
  for (const endsAt of ["2026-09-08T10:00:00+09:00", "2026-09-08T00:59:59Z", "2026-09-15T10:00:01+09:00"]) assert.throws(() => parseCalendarActionPayload("CREATE_CALENDAR_EVENT", create({ endsAt })));
  assert.doesNotThrow(() => parseCalendarActionPayload("CREATE_CALENDAR_EVENT", create({ endsAt: "2026-09-15T10:00:00+09:00" })));
  for (const patch of [{ startsAt: "2026-09-08T10:00:00.1+09:00" }, { endsAt: "2026-09-08T11:00:00.000001+09:00" }, { startsAt: "2026-09-08T10:00:00.123455+09:00", endsAt: "2026-09-08T10:00:00.123456+09:00" }]) {
    assert.throws(() => parseCalendarActionPayload("CREATE_CALENDAR_EVENT", create(patch)), /초 단위/);
    assert.throws(() => parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", update(patch)), /초 단위/);
  }
});

test("accepted instants round-trip through installed iCalendar serialization without time loss", () => {
  for (const patch of [{ startsAt: "2026-09-08T10:00:00.000000+09:00", endsAt: "2026-09-08T10:00:01.000+09:00" }, { startsAt: "2028-02-29T01:00:00Z", endsAt: "2028-02-29T10:00:01+09:00" }]) {
    const approved = parseCalendarActionPayload("CREATE_CALENDAR_EVENT", create(patch));
    assert.doesNotMatch(approved.startsAt, /\./);
    assert.doesNotMatch(approved.endsAt, /\./);
    const calendar = ical({ name: "Local serialization fixture" });
    calendar.createEvent({ id: calendarUidForApproval(eventId), summary: approved.summary, start: new Date(approved.startsAt), end: new Date(approved.endsAt) });
    const serialized = calendar.toString();
    const parsed = parseEvent(serialized);
    assert.ok(parsed);
    assert.equal(parsed.startsAt, new Date(approved.startsAt).toISOString());
    assert.equal(parsed.endsAt, new Date(approved.endsAt).toISOString());
    assert.notEqual(parsed.startsAt, parsed.endsAt);
    assert.equal(Date.parse(parsed.endsAt) - Date.parse(parsed.startsAt), 1000);
    assert.match(serialized, /DTSTART:202[68]0[29]\d{2}T010000Z/);
    assert.match(serialized, /DTEND:202[68]0[29]\d{2}T010001Z/);
  }
});

test("text limits and control characters are checked without coercion", () => {
  for (const patch of [{ summary: "" }, { summary: "  " }, { summary: "x".repeat(301) }, { summary: 42 }, { summary: "title\nATTENDEE:evil" }, { description: "x".repeat(4001) }, { location: "x".repeat(301) }, { location: [] }, { description: "nul\0" }]) assert.throws(() => parseCalendarActionPayload("CREATE_CALENDAR_EVENT", create(patch)));
  assert.doesNotThrow(() => parseCalendarActionPayload("CREATE_CALENDAR_EVENT", create({ summary: "x".repeat(300), description: "x".repeat(4000), location: "x".repeat(300) })));
});

test("update identity headers and hashes cannot introduce unsafe match semantics", () => {
  for (const expectedEtag of [null, "", "*", 'W/"weak"', "unquoted", '"a"\r\nX-Header: injected', '"a", "b"', '"' + "x".repeat(511) + '"']) assert.throws(() => parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", update({ expectedEtag })));
  for (const expectedUid of [null, "", "x".repeat(256), "UID\r\nATTENDEE:evil"]) assert.throws(() => parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", update({ expectedUid })));
  for (const beforeSnapshotHash of [null, "a".repeat(63), "g".repeat(64), "a".repeat(65)]) assert.throws(() => parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", update({ beforeSnapshotHash })));
});

test("approval UUID produces one deterministic UID and resource filename", () => {
  assert.equal(calendarUidForApproval(eventId), `jarvis-${eventId}@personal-os`);
  assert.equal(calendarUidForApproval(eventId.toUpperCase()), calendarUidForApproval(eventId));
  assert.equal(calendarFilenameForApproval(eventId), `${calendarUidForApproval(eventId)}.ics`);
  assert.notEqual(calendarUidForApproval(eventId), calendarUidForApproval(calendarId));
  for (const invalid of ["../event", "event@other", "", `${eventId}\n`]) assert.throws(() => calendarUidForApproval(invalid));
});
