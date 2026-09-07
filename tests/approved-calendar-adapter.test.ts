import test from "node:test";
import assert from "node:assert/strict";
import ical from "ical-generator";
import { approvedCalendarMultigetBody, executeApprovedCalendar, hashCalendarSnapshot, parseApprovedCalendarDavRows, readApprovedCalendarTarget, type ApprovedCalendarInput, type ApprovedCalendarTransport, type CalendarObjectSnapshot } from "../lib/integrations/caldav/approved-actions";
import { calendarFilenameForApproval, calendarUidForApproval } from "../lib/jarvis/calendar-action-payload";

const approvalId = "79f67eae-fcae-4bd9-bf51-63c02f8a6d59";
const calendarUrl = "https://caldav.example.test/user/app/";
const href = new URL(calendarFilenameForApproval(approvalId), calendarUrl).href;
const payload = { version: 1, calendarId: "3a571704-d4e0-4440-b218-80855a60b26c", summary: "Approved meeting", startsAt: "2026-09-08T10:00:00+09:00", endsAt: "2026-09-08T11:00:00+09:00", timezone: "Asia/Tokyo", description: "Description", location: "Room A" };
const createInput: ApprovedCalendarInput = { approvalId, type: "CREATE_CALENDAR_EVENT", payload, calendarSourceUrl: calendarUrl };

function ics(summary = payload.summary): string {
  const calendar = ical({ name: "Personal OS" });
  calendar.createEvent({ id: calendarUidForApproval(approvalId), summary, start: new Date(payload.startsAt), end: new Date(payload.endsAt), description: payload.description, location: payload.location });
  return calendar.toString();
}

function fixture(initial?: CalendarObjectSnapshot) {
  let object: CalendarObjectSnapshot | null = initial ?? null;
  const calls = { creates: 0, updates: 0, reads: 0, etags: [] as string[] };
  const transport: ApprovedCalendarTransport = {
    configuredCalendarName: "Personal OS",
    async listCalendars() { return [{ url: calendarUrl, displayName: "Personal OS" }]; },
    async read(_calendar, target) { calls.reads++; assert.equal(target, href); return object; },
    async create(_calendar, filename, data) { calls.creates++; assert.equal(filename, calendarFilenameForApproval(approvalId)); if (object) return { status: 412 }; object = { data, etag: '"created"' }; return { status: 201 }; },
    async update(target, data, etag) { calls.updates++; calls.etags.push(etag); assert.equal(target, href); if (object?.etag !== etag) return { status: 412 }; object = { data, etag: '"updated"' }; return { status: 204 }; },
  };
  return { transport, calls, get: () => object, set: (value: CalendarObjectSnapshot | null) => { object = value; } };
}

function updateInput(snapshot: CalendarObjectSnapshot): ApprovedCalendarInput {
  return { ...createInput, type: "UPDATE_CALENDAR_EVENT", eventHref: href, payload: { ...payload, summary: "Changed meeting", eventId: "f06597d2-aac4-4d62-af89-c052afad69eb", expectedUid: calendarUidForApproval(approvalId), expectedEtag: snapshot.etag, beforeSnapshotHash: hashCalendarSnapshot(snapshot.data) } };
}

test("CREATE verifies remote fields and replay reuses one stable resource", async () => {
  const f = fixture();
  const first = await executeApprovedCalendar(createInput, f.transport);
  const second = await executeApprovedCalendar(createInput, f.transport);
  assert.equal(first.kind, "verified"); assert.equal(second.kind, "verified");
  assert.equal(f.calls.creates, 1);
  if (first.kind === "verified") { assert.equal(first.uid, calendarUidForApproval(approvalId)); assert.equal(first.parsedEvent.summary, payload.summary); assert.equal(first.etag, '"created"'); }
});

test("concurrent creates converge with create-only precondition and no duplicate", async () => {
  const f = fixture();
  const results = await Promise.all([executeApprovedCalendar(createInput, f.transport), executeApprovedCalendar(createInput, f.transport)]);
  assert.ok(results.every((result) => result.kind === "verified"));
  assert.ok(f.calls.creates <= 2);
  assert.ok(f.get());
  assert.equal(f.get()!.data.match(/BEGIN:VEVENT/g)?.length, 1);
});

test("lost CREATE response is read back once and never blindly written twice", async () => {
  const f = fixture(); const original = f.transport.create;
  f.transport.create = async (...args) => { await original(...args); throw new Error("response lost"); };
  const result = await executeApprovedCalendar(createInput, f.transport);
  assert.equal(result.kind, "verified");
  assert.equal(f.calls.creates, 1); assert.equal(f.calls.reads, 2);
  if (result.kind === "verified") assert.equal(result.reconciled, true);
});

test("unreadable or mismatching post-write state never reports success", async () => {
  const f = fixture(); const original = f.transport.read;
  f.transport.read = async (...args) => { if (f.calls.creates) throw new Error("read lost"); return original(...args); };
  assert.equal((await executeApprovedCalendar(createInput, f.transport)).kind, "uncertain");
  assert.equal(f.calls.creates, 1);
  const mismatch = fixture({ data: ics("Other title"), etag: '"other"' });
  assert.equal((await executeApprovedCalendar(createInput, mismatch.transport)).kind, "conflict");
  assert.equal(mismatch.calls.creates, 0);
  const whitespaceMismatch = fixture({ data: ics().replace("SUMMARY:Approved meeting", "SUMMARY:Approved meeting "), etag: '"other"' });
  assert.equal((await executeApprovedCalendar(createInput, whitespaceMismatch.transport)).kind, "conflict");
  assert.equal(whitespaceMismatch.calls.creates, 0);
});

test("authoritative discovery rejects forged calendars and escaping hrefs before writes", async () => {
  for (const calendarSourceUrl of ["https://evil.test/app/", "https://caldav.example.test/user/other/", "http://caldav.example.test/user/app/", "https://user:pass@caldav.example.test/user/app/"]) {
    const f = fixture(); assert.equal((await executeApprovedCalendar({ ...createInput, calendarSourceUrl }, f.transport)).kind, "conflict"); assert.equal(f.calls.creates, 0); assert.equal(f.calls.reads, 0);
  }
  for (const eventHref of ["https://evil.test/x.ics", calendarUrl + "nested/x.ics", calendarUrl + "%2e%2e/x.ics", calendarUrl + "x.ics?override=1", calendarUrl + "x%252fother.ics", calendarUrl + "x%250d.ics", calendarUrl + "x%00.ics", calendarUrl + "x%0a.ics", calendarUrl + "x%7f.ics", calendarUrl + "x%41.ics", calendarUrl + "x\n.ics"]) {
    const snapshot = { data: ics(), etag: '"before"' }; const f = fixture(snapshot);
    assert.equal((await executeApprovedCalendar({ ...updateInput(snapshot), eventHref }, f.transport)).kind, "conflict"); assert.equal(f.calls.updates, 0); assert.equal(f.calls.reads, 0);
  }
  const duplicate = fixture(); duplicate.transport.listCalendars = async () => [{ url: calendarUrl, displayName: "Personal OS" }, { url: calendarUrl + "other/", displayName: "Personal OS" }];
  assert.equal((await executeApprovedCalendar(createInput, duplicate.transport)).kind, "conflict");
});

test("UPDATE checks original hash/etag and preserves unrelated ICS properties", async () => {
  const snapshot = { data: ics().replace("END:VEVENT", "X-PRIVATE-COLOR:green\r\nTRANSP:OPAQUE\r\nEND:VEVENT"), etag: '"before"' };
  const f = fixture(snapshot);
  const target = await readApprovedCalendarTarget(calendarUrl, href, f.transport);
  assert.equal(target.snapshotHash, hashCalendarSnapshot(snapshot.data)); assert.equal(target.uid, calendarUidForApproval(approvalId));
  const result = await executeApprovedCalendar(updateInput(snapshot), f.transport);
  assert.equal(result.kind, "verified"); assert.deepEqual(f.calls.etags, ['"before"']);
  assert.match(f.get()!.data, /X-PRIVATE-COLOR:green/); assert.match(f.get()!.data, /TRANSP:OPAQUE/);
  if (result.kind === "verified") assert.equal(result.parsedEvent.summary, "Changed meeting");
});

test("time-only UPDATE preserves exact decoded text including whitespace and empty values", async () => {
  for (const location of ["  Room A  ", ""]) {
    const data = ics().replace("SUMMARY:Approved meeting", "SUMMARY;LANGUAGE=ko:  원래 회의  ").replace("DESCRIPTION:Description", "DESCRIPTION:  first\\nsecond  ").replace("LOCATION:Room A", `LOCATION:${location}`);
    const snapshot = { data, etag: '"before"' }; const f = fixture(snapshot);
    const target = await readApprovedCalendarTarget(calendarUrl, href, f.transport);
    assert.equal(target.parsedEvent.summary, "  원래 회의  ");
    assert.equal(target.parsedEvent.description, "  first\nsecond  ");
    assert.equal(target.parsedEvent.location, location);
    const input = updateInput(snapshot);
    input.payload = { ...(input.payload as Record<string, unknown>), summary: target.parsedEvent.summary, description: target.parsedEvent.description, location: target.parsedEvent.location, startsAt: "2026-09-08T12:00:00+09:00", endsAt: "2026-09-08T13:00:00+09:00" };
    const result = await executeApprovedCalendar(input, f.transport);
    assert.equal(result.kind, "verified");
    assert.equal(f.calls.updates, 1);
    assert.match(f.get()!.data, /SUMMARY;LANGUAGE=ko:  원래 회의  /);
    const after = await readApprovedCalendarTarget(calendarUrl, href, f.transport);
    assert.equal(after.parsedEvent.summary, target.parsedEvent.summary);
    assert.equal(after.parsedEvent.description, target.parsedEvent.description);
    assert.equal(after.parsedEvent.location, target.parsedEvent.location);
    assert.equal(after.parsedEvent.startsAt, "2026-09-08T03:00:00.000Z");
  }
});

test("stale ETag or original content mismatch stops UPDATE before PUT", async () => {
  const snapshot = { data: ics(), etag: '"before"' };
  for (const changed of [{ data: snapshot.data, etag: '"new"' }, { data: snapshot.data.replace("Room A", "Other room"), etag: snapshot.etag }]) {
    const f = fixture(changed); assert.equal((await executeApprovedCalendar(updateInput(snapshot), f.transport)).kind, "conflict"); assert.equal(f.calls.updates, 0);
  }
});

test("UPDATE 412 keeps the concurrent remote edit intact and asks for review", async () => {
  const snapshot = { data: ics(), etag: '"before"' }; const f = fixture(snapshot);
  f.transport.update = async () => { f.calls.updates++; f.set({ data: ics("External edit"), etag: '"external"' }); return { status: 412 }; };
  const result = await executeApprovedCalendar(updateInput(snapshot), f.transport);
  assert.equal(result.kind, "conflict"); assert.equal(f.calls.updates, 1); assert.match(f.get()!.data, /External edit/);
});

test("lost UPDATE response reconciles desired state, with no second PUT on replay", async () => {
  const snapshot = { data: ics(), etag: '"before"' }; const f = fixture(snapshot); const original = f.transport.update;
  f.transport.update = async (...args) => { await original(...args); throw new Error("timeout"); };
  assert.equal((await executeApprovedCalendar(updateInput(snapshot), f.transport)).kind, "verified");
  assert.equal((await executeApprovedCalendar(updateInput(snapshot), f.transport)).kind, "verified");
  assert.equal(f.calls.updates, 1);
});

test("recurrence, invitation, all-day and multiple-event resources are never updated", async () => {
  const base = ics();
  for (const data of [base.replace("END:VEVENT", "RRULE:FREQ=DAILY\r\nEND:VEVENT"), base.replace("END:VEVENT", "RDATE:20260909T010000Z\r\nEND:VEVENT"), base.replace("END:VEVENT", "RECURRENCE-ID:20260908T010000Z\r\nEND:VEVENT"), base.replace("END:VEVENT", "ATTENDEE:mailto:test@example.test\r\nEND:VEVENT"), base.replace(/DTSTART:[^\r\n]+/, "DTSTART;VALUE=DATE:20260908"), base.replace("END:VCALENDAR", "BEGIN:VEVENT\r\nUID:second\r\nEND:VEVENT\r\nEND:VCALENDAR")]) {
    const snapshot = { data, etag: '"before"' }; const f = fixture(snapshot);
    assert.equal((await executeApprovedCalendar(updateInput(snapshot), f.transport)).kind, "conflict"); assert.equal(f.calls.updates, 0);
  }
});

test("raw DAV response accepts only exact per-resource 404 including percent-encoded at sign", () => {
  const resource = { href: new URL(href).pathname.replace("@", "%40"), status: 404, ok: false, raw: { multistatus: { response: { href: new URL(href).pathname, status: "HTTP/1.1 404 Not Found" } } } };
  assert.equal(parseApprovedCalendarDavRows([resource], calendarUrl, href), null);
  for (const bad of [[], [resource, resource], [{ ...resource, href: calendarUrl }], [{ ...resource, raw: "Collection not found" }], [{ ...resource, raw: { error: "not found" } }], [{ ...resource, href: "https://evil.test/x.ics" }], [{ ...resource, href: calendarUrl + "%2e%2e/x.ics" }], [{ ...resource, href: calendarUrl + "nested%2fx.ics" }], [{ ...resource, status: 302 }], [{ ...resource, status: 401 }], [{ ...resource, status: 207, ok: true, props: {} }]]) assert.throws(() => parseApprovedCalendarDavRows(bad, calendarUrl, href));
});

test("raw DAV success preserves exact data and validates response ETag and resource", () => {
  const data = ics();
  const row = { href: new URL(href).pathname.replace("@", "%40"), status: 207, ok: true, raw: { multistatus: { response: {} } }, props: { calendarData: { _cdata: data }, getetag: '"v1"' } };
  assert.deepEqual(parseApprovedCalendarDavRows([row], calendarUrl, href), { data, etag: '"v1"' });
  assert.throws(() => parseApprovedCalendarDavRows([{ ...row, props: { ...row.props, getetag: 'W/"weak"' } }], calendarUrl, href));
  assert.throws(() => parseApprovedCalendarDavRows([{ ...row, href: calendarUrl + "different.ics" }], calendarUrl, href));
});

test("multiget REPORT XML escapes the resource href and never interpolates raw XML", () => {
  const body = approvedCalendarMultigetBody(calendarUrl, calendarUrl + "x&y.ics");
  assert.match(body, /<d:href>\/user\/app\/x&amp;y\.ics<\/d:href>/);
  assert.match(body, /<d:getetag\/><c:calendar-data\/>/);
  assert.throws(() => approvedCalendarMultigetBody(calendarUrl, "https://evil.test/x.ics"));
});
