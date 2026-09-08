/** Real isolated DB receipts/approval/mirror; in-memory CalDAV, never remote I/O. */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import ical from "ical-generator";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { Database } from "../../lib/types/database";
import type { CalendarActionPayload, CalendarActionType } from "../../lib/jarvis/calendar-action-payload";
import { calendarFilenameForApproval, calendarUidForApproval, parseCalendarActionPayload } from "../../lib/jarvis/calendar-action-payload";
import { createDialogueDraftForOwner } from "../../lib/repos/jarvis-dialogue";
import { upsertEvents } from "../../lib/repos/events";
import { claimApprovedActionByIdForJob } from "../../lib/repos/jarvis-approvals";
import { executeCalendarForApprovalForJob } from "../../lib/repos/jarvis-calendar-actions";
import { hashCalendarSnapshot, readApprovedCalendarTarget, type ApprovedCalendarTransport, type CalendarObjectSnapshot } from "../../lib/integrations/caldav/approved-actions";

config({ path: [".env.development.local", ".env.local"], quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const marker = `g6b-${randomUUID()}`;
const calendarUrl = "https://calendar.example.test/app/";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type Table<K extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][K]["Row"];
type Receipt = Table<"calendar_execution_receipts">;
type Bundle = { id: string; draftId: string; payload: CalendarActionPayload; type: CalendarActionType; href: string; uid: string; event?: Table<"events">; initial?: CalendarObjectSnapshot };
const owned = new Map<string, Set<string>>();
const remember = (table: string, id: string) => { if (!owned.has(table)) owned.set(table, new Set()); owned.get(table)!.add(id); return id; };
let token = "", ownerId = "", otherToken = "", otherId = "", calendarId = "";
let guarded = false;
const originalFlag = process.env.JARVIS_CALENDAR_ACTIONS_ENABLED;

async function rest<T = unknown>(path: string, method = "GET", body?: unknown, key = service) {
  const response = await fetch(`${url}/rest/v1/${path}`, { method,
    headers: { apikey: key === service ? service : anon, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { ok: response.ok, status: response.status, data: (text ? JSON.parse(text) : null) as T };
}
async function rows<T = { id: string }>(path: string, method = "GET", body?: unknown, key = service): Promise<T[]> {
  const result = await rest<T[]>(path, method, body, key);
  assert.ok(result.ok, `${path}: ${result.status} ${JSON.stringify(result.data)}`); return result.data ?? [];
}
async function rpc<T = unknown>(name: string, body: unknown, key = service) { return rest<T>(`rpc/${name}`, "POST", body, key); }
async function rpcOk<T>(name: string, body: unknown, key = service): Promise<T> {
  const result = await rpc<T>(name, body, key); assert.ok(result.ok, `${name}: ${JSON.stringify(result.data)}`); return result.data;
}
async function login(address: string) {
  const result = await createClient(url, service, { auth: { persistSession: false } }).auth.admin.generateLink({ type: "magiclink", email: address });
  assert.ifError(result.error);
  const verified = await createClient(url, anon, { auth: { persistSession: false } }).auth.verifyOtp({ type: "email", email: address, token: result.data.properties.email_otp });
  assert.ifError(verified.error); return { id: verified.data.user!.id, token: verified.data.session!.access_token };
}
function common() {
  const start = Math.floor((Date.now() + 86_400_000) / 1000) * 1000;
  return { version: 1, calendarId, summary: `${marker} approved event`, startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + 3_600_000).toISOString(), timezone: "Asia/Tokyo", description: "Approved description", location: "Room A" };
}
function rawIcs(uid: string, payload: CalendarActionPayload) {
  const c = ical({ name: "Synthetic local CalDAV" });
  c.createEvent({ id: uid, summary: payload.summary, description: payload.description ?? undefined, location: payload.location ?? undefined,
    start: new Date(payload.startsAt), end: new Date(payload.endsAt) }); return c.toString();
}
function remote(href: string, initial: CalendarObjectSnapshot | null = null) {
  let object = initial;
  const calls = { reads: 0, creates: 0, updates: 0, etags: [] as string[] };
  const transport: ApprovedCalendarTransport = {
    configuredCalendarName: process.env.APP_CALENDAR_NAME ?? "Personal OS",
    async listCalendars() { return [{ url: calendarUrl, displayName: process.env.APP_CALENDAR_NAME ?? "Personal OS" }]; },
    async read(base, target) { assert.equal(base, calendarUrl); assert.equal(target, href); calls.reads++; return object; },
    async create(base, filename, data) { assert.equal(base, calendarUrl); assert.equal(new URL(filename, base).href, href); calls.creates++;
      if (object) return { status: 412 }; object = { data, etag: '"created"' }; return { status: 201 }; },
    async update(target, data, etag) { assert.equal(target, href); calls.updates++; calls.etags.push(etag);
      if (object?.etag !== etag) return { status: 412 }; object = { data, etag: '"updated"' }; return { status: 204 }; },
  };
  return { transport, calls, get: () => object, set: (value: CalendarObjectSnapshot | null) => { object = value; } };
}
async function bundle(update = false, approve = true): Promise<Bundle> {
  let payload: CalendarActionPayload = parseCalendarActionPayload("CREATE_CALENDAR_EVENT", common());
  let event: Table<"events"> | undefined;
  let initial: CalendarObjectSnapshot | undefined;
  const sourceSnapshot: Record<string, string> = { calendarUrlHash: hash(calendarUrl) };
  if (update) {
    const uid = `${randomUUID()}@personal-os`; const href = `${calendarUrl}${randomUUID()}.ics`;
    const raw = rawIcs(uid, payload).replace(`SUMMARY:${payload.summary}`, "SUMMARY;LANGUAGE=ko:  원래 회의  ")
      .replace("DESCRIPTION:Approved description", "DESCRIPTION:  first\\nsecond  ").replace("LOCATION:Room A", "LOCATION:")
      .replace("END:VEVENT", "X-PRIVATE-COLOR:green\r\nTRANSP:OPAQUE\r\nEND:VEVENT");
    initial = { data: raw, etag: '"before"' };
    const snapshot = await readApprovedCalendarTarget(calendarUrl, href, remote(href, initial).transport);
    event = (await rows<Table<"events">>("events", "POST", { calendar_id: calendarId, caldav_uid: uid, caldav_href: href,
      etag: initial.etag, summary: snapshot.parsedEvent.summary, description: snapshot.parsedEvent.description, location: snapshot.parsedEvent.location,
      starts_at: snapshot.parsedEvent.startsAt, ends_at: snapshot.parsedEvent.endsAt, source: "app" }))[0];
    remember("events", event.id);
    payload = parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", { ...payload, summary: snapshot.parsedEvent.summary,
      description: snapshot.parsedEvent.description, location: snapshot.parsedEvent.location,
      startsAt: new Date(Date.parse(payload.startsAt) + 3_600_000).toISOString(), endsAt: new Date(Date.parse(payload.endsAt) + 3_600_000).toISOString(),
      eventId: event.id, expectedUid: uid, expectedEtag: initial.etag, beforeSnapshotHash: hashCalendarSnapshot(raw) });
    sourceSnapshot.eventUpdatedAt = event.updated_at; sourceSnapshot.eventHrefHash = hash(href);
  }
  const type = update ? "UPDATE_CALENDAR_EVENT" : "CREATE_CALENDAR_EVENT";
  const draft = await createDialogueDraftForOwner({ ownerId, type, title: `${marker} ${type}`, explanation: "Synthetic calendar gate proposal",
    payload, sourceSnapshot, executable: true }); remember("dialogue_action_drafts", draft.id);
  const id = await rpcOk<string>("request_dialogue_approval", { p_draft_id: draft.id }, token); remember("approval_requests", id);
  if (approve) await rpcOk("decide_approval", { p_approval_id: id, p_decision: "approved" }, token);
  return { id, draftId: draft.id, type, payload, uid: event?.caldav_uid ?? calendarUidForApproval(id),
    href: event?.caldav_href ?? new URL(calendarFilenameForApproval(id), calendarUrl).href, event, initial };
}
async function claim(b: Bundle, worker = `${marker}-${randomUUID()}`) {
  const approval = await claimApprovedActionByIdForJob(b.id, worker); assert.ok(approval); return { approval, worker };
}
async function begin(b: Bundle) {
  const claimed = await claim(b);
  const receipt = await rpcOk<Receipt>("begin_calendar_execution", { p_approval_id: b.id, p_worker_id: claimed.worker });
  return { ...claimed, receipt };
}
const claimArgs = (b: Bundle, worker: string, receipt: Receipt) => ({ p_approval_id: b.id, p_worker_id: worker, p_claim_token: receipt.claim_token });
async function proof(b: Bundle, transport: ApprovedCalendarTransport) {
  const observed = await readApprovedCalendarTarget(calendarUrl, b.href, transport);
  return { uid: observed.uid, href: b.href, etag: observed.etag, event: observed.parsedEvent };
}
async function receiptRow(b: Bundle) { return (await rows<Receipt>(`calendar_execution_receipts?approval_id=eq.${b.id}`))[0]; }
async function audit(b: Bundle) { return (await rows<Table<"action_audit_logs">>(`action_audit_logs?approval_request_id=eq.${b.id}&order=id`)).map((r) => r.event); }

describe("G6B DB receipts and mock CalDAV gate", { concurrency: false }, () => {
  before(async () => {
    assert.equal(process.env.GATE_ISOLATED_DB, "1"); assert.ok(["http://127.0.0.1:54621", "http://127.0.0.1:54721"].includes(url));
    assert.equal(process.env.ALLOWED_EMAIL, "phase5a@example.test"); assert.ok(anon && service); guarded = true;
    const auth = await login(process.env.ALLOWED_EMAIL!); ownerId = auth.id; token = auth.token;
    const other = await login(`${marker}@example.test`); otherId = other.id; otherToken = other.token;
    assert.equal((await rows("calendars?is_writable=eq.true&select=id")).length, 0, "Never disable an unrelated writable calendar to run this gate");
    calendarId = remember("calendars", (await rows("calendars", "POST", { source_url: calendarUrl, kind: "caldav",
      display_name: process.env.APP_CALENDAR_NAME ?? "Personal OS", is_writable: true, last_synced_at: new Date().toISOString() }))[0].id);
    process.env.JARVIS_CALENDAR_ACTIONS_ENABLED = "true";
  });
  after(async () => {
    if (!guarded) return;
    try {
      for (const id of owned.get("dialogue_action_drafts") ?? []) {
        for (const r of await rows(`system_events?source_type=eq.dialogue_draft&source_id=eq.${id}&select=id`)) remember("system_events", r.id);
      }
      for (const id of owned.get("system_events") ?? []) for (const r of await rows(`agent_runs?trigger_event_id=eq.${id}&select=id`)) remember("agent_runs", r.id);
      for (const id of owned.get("approval_requests") ?? []) {
        await rows(`calendar_execution_receipts?approval_id=eq.${id}`, "DELETE");
        await rows(`action_audit_logs?approval_request_id=eq.${id}`, "DELETE");
      }
      if (calendarId) for (const r of await rows(`events?calendar_id=eq.${calendarId}&select=id`)) remember("events", r.id);
      for (const table of ["dialogue_action_drafts", "approval_requests", "agent_runs", "system_events", "events", "calendars"]) {
        for (const id of owned.get(table) ?? []) await rows(`${table}?id=eq.${id}`, "DELETE");
      }
    } finally {
      if (originalFlag === undefined) delete process.env.JARVIS_CALENDAR_ACTIONS_ENABLED;
      else process.env.JARVIS_CALENDAR_ACTIONS_ENABLED = originalFlag;
      if (otherId) assert.ifError((await createClient(url, service).auth.admin.deleteUser(otherId)).error);
    }
  });

  it("receipt RLS, service-only capabilities, and runtime readiness fail closed", async () => {
    const b = await bundle(); const { approval, worker } = await claim(b); const mock = remote(b.href);
    process.env.JARVIS_CALENDAR_ACTIONS_ENABLED = "false";
    try {
      assert.equal((await executeCalendarForApprovalForJob(approval, worker, mock.transport)).kind, "conflict");
      assert.equal(mock.calls.reads + mock.calls.creates + mock.calls.updates, 0);
      assert.equal((await rows(`calendar_execution_receipts?approval_id=eq.${b.id}`)).length, 0);
    } finally { process.env.JARVIS_CALENDAR_ACTIONS_ENABLED = "true"; }
    const receipt = await rpcOk<Receipt>("begin_calendar_execution", { p_approval_id: b.id, p_worker_id: worker });
    assert.equal((await rows(`calendar_execution_receipts?approval_id=eq.${b.id}`, "GET", undefined, token)).length, 1);
    for (const key of [anon, otherToken]) {
      const result = await rest<unknown[]>(`calendar_execution_receipts?approval_id=eq.${b.id}`, "GET", undefined, key);
      assert.ok([401, 403].includes(result.status) || (result.ok && result.data.length === 0));
    }
    for (const key of [anon, token, otherToken]) {
      for (const [name, args] of [
        ["begin_calendar_execution", { p_approval_id: b.id, p_worker_id: worker }],
        ["before_calendar_write", claimArgs(b, worker, receipt)],
        ["finish_calendar_execution", { ...claimArgs(b, worker, receipt), p_proof: {} }],
        ["fail_calendar_execution", { ...claimArgs(b, worker, receipt), p_state: "uncertain", p_error: "forged" }],
        ["claim_calendar_reconciliation", { p_approval_id: b.id, p_owner_id: ownerId, p_worker_id: worker }],
      ] as const) assert.ok([401, 403].includes((await rpc(name, args, key)).status));
    }
    assert.equal((await rest(`calendar_execution_receipts?approval_id=eq.${b.id}`, "PATCH", { write_attempts: 0 }, token)).status, 403);
  });

  it("approved CREATE claims once, writes once, verifies one mirror and replays without PUT", async () => {
    const b = await bundle(); const mock = remote(b.href); const workers = [randomUUID(), randomUUID()];
    const claims = await Promise.all(workers.map((worker) => claimApprovedActionByIdForJob(b.id, worker)));
    assert.equal(claims.filter(Boolean).length, 1);
    const index = claims.findIndex(Boolean); const approval = claims[index]!;
    const result = await executeCalendarForApprovalForJob(approval, workers[index], mock.transport);
    assert.equal(result.kind, "verified", JSON.stringify(result));
    assert.equal((await executeCalendarForApprovalForJob(approval, workers[index], mock.transport)).kind, "verified");
    assert.equal(mock.calls.creates, 1); assert.equal(mock.calls.updates, 0);
    const mirrors = await rows<Table<"events">>(`events?calendar_id=eq.${calendarId}&caldav_uid=eq.${b.uid}`);
    assert.equal(mirrors.length, 1); assert.equal(mirrors[0].summary, b.payload.summary);
    assert.equal((await receiptRow(b)).write_attempts, 1);
    assert.deepEqual(await audit(b), ["requested", "approved", "executing", "executed", "verified"]);
    console.log(`G6B CREATE evidence: approval=${b.id}, mirror=${mirrors[0].id}, PUT=1, mirrorCount=1`);
  });

  it("normal sync preserves verified CREATE provenance and permits a later approved UPDATE", async () => {
    const b = await bundle(); const mock = remote(b.href); const claimed = await claim(b);
    assert.equal((await executeCalendarForApprovalForJob(claimed.approval, claimed.worker, mock.transport)).kind, "verified");
    const observed = await readApprovedCalendarTarget(calendarUrl, b.href, mock.transport);
    const davHref = b.href.replace("@", "%40");
    assert.notEqual(davHref, b.href);
    await upsertEvents(calendarId, [{ ...observed.parsedEvent, href: davHref, etag: observed.etag }]);
    const synced = (await rows<Table<"events">>(`events?calendar_id=eq.${calendarId}&caldav_uid=eq.${b.uid}`))[0];
    assert.equal(synced.source, "app", "routine default-icloud sync must preserve established app provenance");
    assert.equal(synced.caldav_href, b.href, "a DAV %40 alias must not invalidate an established reviewed href");
    const payload = parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", { ...b.payload,
      startsAt: new Date(Date.parse(b.payload.startsAt) + 3_600_000).toISOString(), endsAt: new Date(Date.parse(b.payload.endsAt) + 3_600_000).toISOString(),
      eventId: synced.id, expectedUid: b.uid, expectedEtag: observed.etag, beforeSnapshotHash: observed.snapshotHash });
    const draft = await createDialogueDraftForOwner({ ownerId, type: "UPDATE_CALENDAR_EVENT", title: `${marker} after sync`, explanation: "Local sync compatibility regression",
      payload, sourceSnapshot: { calendarUrlHash: hash(calendarUrl), eventUpdatedAt: synced.updated_at, eventHrefHash: hash(b.href) }, executable: true });
    remember("dialogue_action_drafts", draft.id);
    const id = await rpcOk<string>("request_dialogue_approval", { p_draft_id: draft.id }, token); remember("approval_requests", id);
    await rpcOk("decide_approval", { p_approval_id: id, p_decision: "approved" }, token);
    const update: Bundle = { ...b, id, draftId: draft.id, payload, type: "UPDATE_CALENDAR_EVENT", event: synced, initial: mock.get()! };
    const updateClaim = await claim(update);
    const result = await executeCalendarForApprovalForJob(updateClaim.approval, updateClaim.worker, mock.transport);
    assert.equal(result.kind, "verified", JSON.stringify(result));
    assert.equal(mock.calls.creates, 1); assert.equal(mock.calls.updates, 1);
    assert.equal((await rows<Table<"events">>(`events?id=eq.${synced.id}`))[0].source, "app");
  });

  it("normal sync between remote CREATE and receipt finish adopts only the exact proven mirror", async () => {
    const b = await bundle(); const mock = remote(b.href); const create = mock.transport.create;
    let syncMirrorId = "";
    mock.transport.create = async (...args) => {
      const result = await create(...args);
      const observed = await readApprovedCalendarTarget(calendarUrl, b.href, mock.transport);
      const davHref = b.href.replace("@", "%40");
      assert.notEqual(davHref, b.href);
      await upsertEvents(calendarId, [{ ...observed.parsedEvent, href: davHref, etag: observed.etag }]);
      const synced = (await rows<Table<"events">>(`events?calendar_id=eq.${calendarId}&caldav_uid=eq.${b.uid}`))[0];
      assert.equal(synced.source, "icloud", "before receipt proof an imported UID alone must not become app provenance");
      assert.equal(synced.caldav_href, davHref, "newly imported rows retain their actual DAV href until receipt proof");
      syncMirrorId = synced.id;
      return result;
    };
    const { approval, worker } = await claim(b);
    const result = await executeCalendarForApprovalForJob(approval, worker, mock.transport);
    assert.equal(result.kind, "verified", JSON.stringify(result));
    assert.equal(mock.calls.creates, 1);
    const mirrors = await rows<Table<"events">>(`events?calendar_id=eq.${calendarId}&caldav_uid=eq.${b.uid}`);
    assert.equal(mirrors.length, 1); assert.equal(mirrors[0].id, syncMirrorId); assert.equal(mirrors[0].source, "app");
    assert.equal(mirrors[0].caldav_href, b.href, "receipt completion must reconcile only the known %40/@ alias to its canonical href");
    assert.equal((await receiptRow(b)).write_attempts, 1);
  });

  it("normal sync never grants app provenance from an app-looking UID without an existing app row or receipt", async () => {
    const uid = calendarUidForApproval(randomUUID()); const href = `${calendarUrl}${randomUUID()}.ics`;
    const payload = parseCalendarActionPayload("CREATE_CALENDAR_EVENT", common());
    const mock = remote(href, { data: rawIcs(uid, payload), etag: '"unproven"' });
    const observed = await readApprovedCalendarTarget(calendarUrl, href, mock.transport);
    await upsertEvents(calendarId, [{ ...observed.parsedEvent, href, etag: observed.etag }]);
    const imported = (await rows<Table<"events">>(`events?calendar_id=eq.${calendarId}&caldav_uid=eq.${uid}`))[0];
    assert.equal(imported.source, "icloud");
    await upsertEvents(calendarId, [{ ...observed.parsedEvent, href, etag: observed.etag }]);
    assert.equal((await rows<Table<"events">>(`events?id=eq.${imported.id}`))[0].source, "icloud");
  });

  it("lost write response and failed read become uncertain, then reconcile read-only even after expiry", async () => {
    const b = await bundle(); const mock = remote(b.href); const create = mock.transport.create; const read = mock.transport.read;
    mock.transport.create = async (...args) => { await create(...args); throw new Error("Synthetic lost PUT response"); };
    mock.transport.read = async (...args) => { if (mock.calls.creates) throw new Error("Synthetic read unavailable"); return read(...args); };
    const { approval, worker } = await claim(b);
    const uncertain = await executeCalendarForApprovalForJob(approval, worker, mock.transport);
    assert.equal(uncertain.kind, "uncertain"); assert.equal(mock.calls.creates, 1);
    const receipt = await receiptRow(b); assert.equal(receipt.state, "uncertain"); assert.equal(receipt.write_attempts, 1);
    assert.equal((await rows<Table<"approval_requests">>(`approval_requests?id=eq.${b.id}`))[0].status, "failed");
    await rows(`approval_requests?id=eq.${b.id}`, "PATCH", { expires_at: new Date(Date.now() - 1000).toISOString() });
    assert.equal((await rpc("claim_calendar_reconciliation", { p_approval_id: b.id, p_owner_id: otherId, p_worker_id: "wrong-owner" })).status, 403);
    const recoveryWorker = randomUUID();
    const recovery = await rpcOk<Receipt>("claim_calendar_reconciliation", { p_approval_id: b.id, p_owner_id: ownerId, p_worker_id: recoveryWorker });
    assert.equal(recovery.claim_mode, "reconcile");
    assert.equal((await rpc("before_calendar_write", claimArgs(b, recoveryWorker, recovery))).ok, false);
    mock.transport.read = read;
    const observed = await proof(b, mock.transport);
    const finished = await rpcOk<Receipt>("finish_calendar_execution", { ...claimArgs(b, recoveryWorker, recovery), p_proof: observed });
    assert.equal(finished.state, "verified"); assert.equal(mock.calls.creates, 1); assert.equal(finished.write_attempts, 1);
    assert.equal((await rows(`events?calendar_id=eq.${calendarId}&caldav_uid=eq.${b.uid}`)).length, 1);
    assert.deepEqual((await audit(b)).slice(-2), ["executed", "verified"]);
  });

  it("UPDATE preserves original text/property parameters and uses the approved ETag", async () => {
    const b = await bundle(true); const mock = remote(b.href, b.initial!); const { approval, worker } = await claim(b);
    const result = await executeCalendarForApprovalForJob(approval, worker, mock.transport);
    assert.equal(result.kind, "verified", JSON.stringify(result)); assert.equal(mock.calls.updates, 1);
    assert.deepEqual(mock.calls.etags, [b.initial!.etag]); assert.equal(mock.calls.creates, 0);
    assert.match(mock.get()!.data, /SUMMARY;LANGUAGE=ko:  원래 회의  /);
    assert.match(mock.get()!.data, /X-PRIVATE-COLOR:green/);
    const mirror = (await rows<Table<"events">>(`events?id=eq.${b.event!.id}`))[0];
    assert.equal(mirror.summary, b.payload.summary); assert.equal(mirror.description, b.payload.description); assert.equal(mirror.location, "");
    assert.equal(Date.parse(mirror.starts_at), Date.parse(b.payload.startsAt));
    assert.equal((await executeCalendarForApprovalForJob(approval, worker, mock.transport)).kind, "verified");
    assert.equal(mock.calls.updates, 1);
  });

  it("stale remote ETag/hash and a conditional 412 preserve external content", async () => {
    for (const fault of ["etag", "hash", "412"] as const) {
      const b = await bundle(true); const mock = remote(b.href, b.initial!);
      let expected: string;
      if (fault === "etag") { mock.set({ ...b.initial!, etag: '"external"' }); expected = b.initial!.data; }
      else if (fault === "hash") { expected = b.initial!.data.replace("green", "red"); mock.set({ ...b.initial!, data: expected }); }
      else {
        expected = b.initial!.data.replace("green", "red");
        mock.transport.update = async () => { mock.calls.updates++; mock.set({ data: expected, etag: '"external"' }); return { status: 412 }; };
      }
      const { approval, worker } = await claim(b);
      const result = await executeCalendarForApprovalForJob(approval, worker, mock.transport);
      assert.equal(result.kind, "conflict", JSON.stringify(result)); assert.equal(mock.get()!.data, expected);
      assert.equal(mock.calls.updates, fault === "412" ? 1 : 0); assert.equal(mock.calls.creates, 0);
      assert.equal((await receiptRow(b)).state, "conflict");
      assert.equal((await rows<Table<"events">>(`events?id=eq.${b.event!.id}`))[0].etag, b.initial!.etag);
    }
  });

  it("tampered mirror href is rejected before any transport write", async () => {
    const b = await bundle(true); const mock = remote(b.href, b.initial!);
    await rows(`events?id=eq.${b.event!.id}`, "PATCH", { caldav_href: `${calendarUrl}different.ics` });
    const { approval, worker } = await claim(b);
    assert.equal((await executeCalendarForApprovalForJob(approval, worker, mock.transport)).kind, "conflict");
    assert.equal(mock.calls.reads + mock.calls.creates + mock.calls.updates, 0);
    assert.equal((await rows(`calendar_execution_receipts?approval_id=eq.${b.id}`)).length, 0);
  });

  it("null/stale claims, expired approvals and consumed write allowances fail closed", async () => {
    const pending = await bundle(false, false);
    assert.equal((await rpc("begin_calendar_execution", { p_approval_id: pending.id, p_worker_id: "unapproved" })).ok, false);
    for (const field of ["locked_until", "expires_at"] as const) {
      const b = await bundle(); const { worker } = await claim(b);
      await rows(`approval_requests?id=eq.${b.id}`, "PATCH", { [field]: field === "locked_until" ? null : new Date(Date.now() - 1000).toISOString() });
      assert.equal((await rpc("begin_calendar_execution", { p_approval_id: b.id, p_worker_id: worker })).ok, false);
      assert.equal((await rows(`calendar_execution_receipts?approval_id=eq.${b.id}`)).length, 0);
    }
    const b = await bundle(); const { receipt, worker } = await begin(b); const args = claimArgs(b, worker, receipt);
    for (const invalidToken of [null, randomUUID()]) {
      assert.equal((await rpc("before_calendar_write", { ...args, p_claim_token: invalidToken })).ok, false);
      assert.equal((await rpc("finish_calendar_execution", { ...args, p_claim_token: invalidToken, p_proof: {} })).ok, false);
    }
    await rows(`calendar_execution_receipts?approval_id=eq.${b.id}`, "PATCH", { locked_until: null });
    assert.equal((await rpc("before_calendar_write", args)).ok, false);
    await rows(`calendar_execution_receipts?approval_id=eq.${b.id}`, "PATCH", { locked_until: new Date(Date.now() + 60_000).toISOString() });
    await rpcOk("before_calendar_write", args);
    assert.equal((await rpc("before_calendar_write", args)).ok, false);
    assert.equal((await receiptRow(b)).write_attempts, 1);
    const mock = remote(b.href, { data: rawIcs(b.uid, b.payload), etag: '"observed"' });
    const observed = await proof(b, mock.transport);
    await rows(`calendar_execution_receipts?approval_id=eq.${b.id}`, "PATCH", { locked_until: new Date(Date.now() - 1000).toISOString() });
    assert.equal((await rpc("finish_calendar_execution", { ...args, p_proof: observed })).ok, false);
    assert.equal((await rows(`events?calendar_id=eq.${calendarId}&caldav_uid=eq.${b.uid}`)).length, 0);
  });

  it("a released uncertain receipt rejects null worker/token attempts to rewrite its state", async () => {
    const b = await bundle(); const { receipt, worker } = await begin(b);
    await rpcOk("before_calendar_write", claimArgs(b, worker, receipt));
    await rpcOk("fail_calendar_execution", { ...claimArgs(b, worker, receipt), p_state: "uncertain", p_error: "Synthetic write outcome unknown" });
    assert.equal((await receiptRow(b)).claim_token, null);
    const invalid = await rpc("fail_calendar_execution", { p_approval_id: b.id, p_worker_id: null, p_claim_token: null, p_state: "conflict", p_error: "must not persist" });
    assert.equal(invalid.ok, false, "absence of both stored and supplied claim tokens must not authenticate a worker");
    assert.equal((await receiptRow(b)).state, "uncertain");
  });

  it("mirror failure rolls back completion/audits; read-only recovery finishes without another PUT", async () => {
    const b = await bundle(); const mock = remote(b.href); const create = mock.transport.create; let conflictId = "";
    mock.transport.create = async (...args) => {
      const result = await create(...args);
      // An incompatible local identity makes finish fail after the remote write.
      conflictId = remember("events", (await rows("events", "POST", { calendar_id: calendarId, caldav_uid: b.uid, caldav_href: b.href,
        summary: "Conflicting pre-existing mirror", starts_at: b.payload.startsAt, ends_at: b.payload.endsAt, source: "icloud" }))[0].id);
      return result;
    };
    const { approval, worker } = await claim(b);
    assert.equal((await executeCalendarForApprovalForJob(approval, worker, mock.transport)).kind, "uncertain");
    assert.equal(mock.calls.creates, 1);
    const receipt = await receiptRow(b);
    assert.equal(receipt.state, "uncertain"); assert.equal(receipt.mirror_event_id, null); assert.equal(receipt.write_attempts, 1);
    assert.ok(!(await audit(b)).some((event) => event === "executed" || event === "verified"));
    const conflicting = (await rows<Table<"events">>(`events?id=eq.${conflictId}`))[0];
    assert.equal(conflicting.source, "icloud"); assert.equal(conflicting.summary, "Conflicting pre-existing mirror");
    await rows(`events?id=eq.${conflictId}`, "DELETE");
    const recoveryWorker = randomUUID(); const recovered = await rpcOk<Receipt>("claim_calendar_reconciliation", { p_approval_id: b.id, p_owner_id: ownerId, p_worker_id: recoveryWorker });
    const finished = await rpcOk<Receipt>("finish_calendar_execution", { ...claimArgs(b, recoveryWorker, recovered), p_proof: await proof(b, mock.transport) });
    assert.equal(finished.state, "verified"); assert.equal(mock.calls.creates, 1);
    assert.equal((await rows(`events?calendar_id=eq.${calendarId}&caldav_uid=eq.${b.uid}`)).length, 1);
    assert.deepEqual((await audit(b)).slice(-2), ["executed", "verified"]);
  });

  it("real CalDAV, HTTP owner recovery and simultaneous target-lock expiry require separate gates", (t) => {
    t.skip("No external calendar call or Next cookie-scoped owner wrapper is executed; target-lock wait timing is not claimed by this REST fixture gate");
  });
});
