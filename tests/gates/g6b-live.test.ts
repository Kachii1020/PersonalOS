/**
 * Explicitly authorized live CalDAV gate, with approval/state in LOCAL DB only.
 * Caller supplies the already approved environment; this file reads no env file.
 * Never include in the default test suite. Real CREATE/UPDATE/conditional DELETE.
 * No AI calls, event enumeration, calendar sync, invitations, or alarms.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ICAL from "ical.js";
import { createClient } from "@supabase/supabase-js";
import { chromium, type Browser } from "playwright";
import type { Database } from "../../lib/types/database";
import type { CalendarActionPayload, CalendarActionType } from "../../lib/jarvis/calendar-action-payload";
import { calendarFilenameForApproval, calendarUidForApproval, parseCalendarActionPayload } from "../../lib/jarvis/calendar-action-payload";
import { createDialogueDraftForOwner } from "../../lib/repos/jarvis-dialogue";
import { upsertEvents } from "../../lib/repos/events";
import { claimApprovedActionByIdForJob } from "../../lib/repos/jarvis-approvals";
import { executeCalendarForApprovalForJob, readCalendarTargetForDraft } from "../../lib/repos/jarvis-calendar-actions";
import { createApprovedCalendarTransport, readApprovedCalendarTarget, type ApprovedCalendarTransport } from "../../lib/integrations/caldav/approved-actions";
import { createCalDavClient, appCalendarName } from "../../lib/integrations/caldav/client";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

test("G6B live calendar round trip, owner-cookie read-only recovery and conditional cleanup", { timeout: 240_000 }, async (t) => {
  assert.equal(process.env.GATE_ISOLATED_DB, "1");
  assert.equal(process.env.G6_ALLOW_LIVE_CALDAV, "1", "Live writes require explicit event create/update/delete authority");
  assert.equal(process.env.JARVIS_CALENDAR_ACTIONS_ENABLED, "true");
  const app = process.env.G6_APP_URL ?? "http://localhost:3055";
  assert.equal(app, "http://localhost:3055", "Owner recovery must use the dedicated local app on port 3055");
  // This is the caller's server-launch declaration, not runtime introspection.
  // The test worker's true flag permits the one approved PUT; the separately
  // launched app must keep its new-write executor disabled during recovery.
  assert.equal(process.env.G6_APP_CALENDAR_ACTIONS_ENABLED, "false", "Launch the local app with JARVIS_CALENDAR_ACTIONS_ENABLED=false and record that command separately");
  const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert.equal(dbUrl, "http://127.0.0.1:54621", "Never run this fixture against the operational database");
  assert.equal(process.env.ALLOWED_EMAIL, "phase5a@example.test");
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  assert.ok(service && anon && process.env.APPLE_ID && process.env.APPLE_APP_PASSWORD, "Approved local and Apple configuration is required");
  const admin = createClient<Database>(dbUrl!, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const usageBefore = await admin.from("ai_usage").select("id", { count: "exact", head: true });
  assert.ifError(usageBefore.error);

  // An existence query is enough to refuse an occupied fixture environment.
  for (const table of ["calendars", "events", "dialogue_action_drafts", "calendar_execution_receipts"] as const) {
    const existing = await admin.from(table).select("*").limit(1);
    assert.ifError(existing.error);
    assert.equal(existing.data.length, 0, `Dedicated local ${table} must be empty; do not erase unrelated rows`);
  }
  const marker = `G6B-live-${randomUUID()}`;
  const evidencePath = join(process.cwd(), "test-results", `${marker}.json`);
  const evidence: Record<string, unknown> = { marker, startedAt: new Date().toISOString(),
    database: "isolated local 54621", aiCallsRequested: false, aiUsageRowsBefore: usageBefore.count,
    stage: "authorized_preflight", cleanupConfirmed404: false, ownerRecoveryApp: app,
    declaredAppLaunchCalendarExecutorEnabled: false, appFlagRuntimeIntrospection: false };
  mkdirSync(join(process.cwd(), "test-results"), { recursive: true, mode: 0o700 });
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  const persist = (stage: string, update: Record<string, unknown> = {}) => {
    Object.assign(evidence, update, { stage, updatedAt: new Date().toISOString() });
    writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600 });
  };
  let calendarId = "", calendarUrl = "", href = "", uid = "", ownerId = "";
  let initiallyMissing = false, writeMayHaveOccurred = false, cleanupConfirmed = false;
  let transport: ApprovedCalendarTransport | undefined;
  let browser: Browser | undefined;
  let failPostUpdateRead = false;
  const closeOnAbort = () => { if (browser) void browser.close().catch((error) => {
    console.error("[g6b-live] Abort browser close failed:", error instanceof Error ? error.name : "UnknownError");
  }); };
  t.signal.addEventListener("abort", closeOnAbort);
  const drafts: string[] = [], approvals: string[] = [];
  const knownStates: CalendarActionPayload[] = [];
  const calls = { creates: 0, updates: 0, deletes: 0, syntheticPostUpdateReadFailures: 0 };
  let failure: unknown;
  let cleanupFailure: unknown;

  async function loginOwner() {
    const generated = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.ALLOWED_EMAIL! });
    assert.ifError(generated.error);
    const user = createClient<Database>(dbUrl!, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const verified = await user.auth.verifyOtp({ type: "email", email: process.env.ALLOWED_EMAIL!, token: generated.data.properties.email_otp });
    assert.ifError(verified.error);
    ownerId = verified.data.user!.id;
    const allowed = await user.rpc("is_allowed_user");
    assert.ifError(allowed.error); assert.equal(allowed.data, true);
    return user;
  }
  async function mirror() {
    const result = await admin.from("events").select("*").eq("calendar_id", calendarId).eq("caldav_uid", uid);
    assert.ifError(result.error); assert.equal(result.data.length, 1, "The stable UID must have exactly one local mirror"); return result.data[0];
  }
  function matches(parsed: Awaited<ReturnType<typeof readApprovedCalendarTarget>>["parsedEvent"], payload: CalendarActionPayload) {
    return parsed.uid === uid && parsed.summary === payload.summary && parsed.description === payload.description
      && parsed.location === payload.location && Date.parse(parsed.startsAt) === Date.parse(payload.startsAt)
      && Date.parse(parsed.endsAt) === Date.parse(payload.endsAt) && !parsed.isAllDay && parsed.rrule === null && parsed.exdates.length === 0;
  }
  async function assertReceipt(id: string, recovered = false) {
    const receipt = await admin.from("calendar_execution_receipts").select("state,write_attempts,mirror_event_id").eq("approval_id", id).single();
    assert.ifError(receipt.error); assert.equal(receipt.data.state, "verified"); assert.equal(receipt.data.write_attempts, 1);
    const audit = await admin.from("action_audit_logs").select("event").eq("approval_request_id", id).order("id");
    assert.ifError(audit.error);
    assert.deepEqual(audit.data.map((row) => row.event), recovered
      ? ["requested", "approved", "executing", "failed", "executed", "verified"]
      : ["requested", "approved", "executing", "executed", "verified"]);
    return receipt.data;
  }
  async function cleanupLocal() {
    // Recover local IDs if an RPC committed before its response was lost.
    if (drafts.length) {
      const linked = await admin.from("dialogue_action_drafts").select("approval_request_id").in("id", drafts);
      assert.ifError(linked.error);
      for (const row of linked.data) if (row.approval_request_id && !approvals.includes(row.approval_request_id)) approvals.push(row.approval_request_id);
    }
    const events = drafts.length ? await admin.from("system_events").select("id").eq("source_type", "dialogue_draft").in("source_id", drafts) : { data: [], error: null };
    assert.ifError(events.error);
    const eventIds = events.data.map((row) => row.id);
    const runs = eventIds.length ? await admin.from("agent_runs").select("id").in("trigger_event_id", eventIds) : { data: [], error: null };
    assert.ifError(runs.error);
    if (approvals.length) {
      assert.ifError((await admin.from("calendar_execution_receipts").delete().in("approval_id", approvals)).error);
      assert.ifError((await admin.from("action_audit_logs").delete().in("approval_request_id", approvals)).error);
      assert.ifError((await admin.from("tasks").delete().in("approval_request_id", approvals)).error);
    }
    if (drafts.length) assert.ifError((await admin.from("dialogue_action_drafts").delete().in("id", drafts)).error);
    if (approvals.length) assert.ifError((await admin.from("approval_requests").delete().in("id", approvals)).error);
    if (runs.data.length) assert.ifError((await admin.from("agent_runs").delete().in("id", runs.data.map((row) => row.id))).error);
    if (eventIds.length) assert.ifError((await admin.from("system_events").delete().in("id", eventIds)).error);
    if (calendarId) {
      assert.ifError((await admin.from("events").delete().eq("calendar_id", calendarId)).error);
      assert.ifError((await admin.from("calendars").delete().eq("id", calendarId)).error);
    }
  }

  try {
    const user = await loginOwner();
    transport = await createApprovedCalendarTransport();
    const discovered = (await transport.listCalendars()).filter((calendar) => calendar.displayName === appCalendarName());
    assert.equal(discovered.length, 1, "Configured app calendar must be unique; never create or rename a real calendar");
    calendarUrl = discovered[0].url;
    const target = new URL(calendarUrl);
    assert.equal(target.protocol, "https:"); assert.equal(target.username + target.password + target.search + target.hash, "");
    assert.ok(target.pathname.endsWith("/"));
    const inserted = await admin.from("calendars").insert({ source_url: calendarUrl, display_name: appCalendarName(), kind: "caldav", is_writable: true }).select("id").single();
    assert.ifError(inserted.error); calendarId = inserted.data.id;
    persist("calendar_metadata_seeded", { calendarId, calendarUrl, ownerId });
    const actual = transport;
    const counted: ApprovedCalendarTransport = { ...actual,
      read: async (...args) => {
        if (failPostUpdateRead && calls.updates === 1) {
          calls.syntheticPostUpdateReadFailures++;
          throw new Error("Synthetic loss of post-PUT read response after the one real approved UPDATE");
        }
        return actual.read(...args);
      },
      create: async (...args) => { calls.creates++; return actual.create(...args); },
      update: async (...args) => { calls.updates++; return actual.update(...args); },
    };
    const start = Math.floor((Date.now() + 2 * 86_400_000) / 60_000) * 60_000;
    const createPayload = parseCalendarActionPayload("CREATE_CALENDAR_EVENT", { version: 1, calendarId,
      summary: marker, description: `${marker} disposable authorized test`, location: null,
      startsAt: new Date(start).toISOString(), endsAt: new Date(start + 600_000).toISOString(), timezone: "Asia/Tokyo" });
    knownStates.push(createPayload);

    async function createPending(type: CalendarActionType, payload: CalendarActionPayload, sourceSnapshot: Record<string, string>) {
      const draft = await createDialogueDraftForOwner({ ownerId, type, title: `${marker} ${type}`, explanation: "Explicitly authorized disposable live calendar gate",
        payload, sourceSnapshot, executable: true });
      drafts.push(draft.id); persist("draft_saved", { draftIds: drafts, approvalIds: approvals, knownApprovedStates: knownStates });
      const requested = await user.rpc("request_dialogue_approval", { p_draft_id: draft.id });
      assert.ifError(requested.error); approvals.push(requested.data);
      persist("pending_approval_saved", { draftIds: drafts, approvalIds: approvals });
      const pending = await admin.from("approval_requests").select("status").eq("id", requested.data).single();
      assert.ifError(pending.error); assert.equal(pending.data.status, "pending");
      return requested.data;
    }
    async function execute(id: string, expectedKind: "verified" | "uncertain" = "verified") {
      const decided = await user.rpc("decide_approval", { p_approval_id: id, p_decision: "approved" }); assert.ifError(decided.error);
      const worker = `g6b-live-${randomUUID()}`;
      const claimed = await claimApprovedActionByIdForJob(id, worker); assert.ok(claimed);
      persist("before_remote_execution", { currentApprovalId: id, uid, href, knownApprovedStates: knownStates, writeCalls: calls });
      writeMayHaveOccurred = true;
      const outcome = await executeCalendarForApprovalForJob(claimed, worker, counted);
      persist("remote_execution_returned", { currentApprovalId: id, outcome, writeCalls: calls });
      assert.equal(outcome.kind, expectedKind, expectedKind === "verified" ? "Remote/mirror execution must actually verify before the gate passes" : "Lost post-PUT verification must remain uncertain, never falsely completed");
      return { claimed, worker, outcome };
    }

    const createId = await createPending("CREATE_CALENDAR_EVENT", createPayload, { calendarUrlHash: hash(calendarUrl) });
    uid = calendarUidForApproval(createId); href = new URL(calendarFilenameForApproval(createId), calendarUrl).href;
    persist("before_initial_resource_probe", { uid, href, createApprovalId: createId, knownApprovedStates: knownStates });
    assert.equal(await transport.read(calendarUrl, href), null, "Stable test href already exists; never overwrite or delete that resource");
    initiallyMissing = true; persist("initial_resource_confirmed_404", { initiallyMissing });
    const created = await execute(createId);
    const createdProof = await readApprovedCalendarTarget(calendarUrl, href, transport);
    assert.ok(matches(createdProof.parsedEvent, createPayload));
    let createdMirror = await mirror(); const createReceipt = await assertReceipt(createId);
    assert.equal(createReceipt.mirror_event_id, createdMirror.id); assert.equal(calls.creates, 1);
    assert.equal((await executeCalendarForApprovalForJob(created.claimed, created.worker, counted)).kind, "verified");
    assert.equal(calls.creates, 1);
    persist("create_and_replay_verified", { mirrorId: createdMirror.id, createReceipt, createSnapshotHash: createdProof.snapshotHash, writeCalls: calls });
    // Exercise the normal sync repository path for this exact synthetic object
    // only. Do not enumerate or mirror unrelated live calendar events.
    const davAliasHref = href.replace("@", "%40");
    assert.notEqual(davAliasHref, href);
    await upsertEvents(calendarId, [{ ...createdProof.parsedEvent, href: davAliasHref, etag: createdProof.etag }]);
    createdMirror = await mirror();
    assert.equal(createdMirror.source, "app", "routine sync must preserve established app provenance before UPDATE");
    assert.equal(createdMirror.caldav_href, href, "DAV %40 alias must preserve the established reviewed href");
    persist("normal_sync_provenance_verified", { mirrorId: createdMirror.id, sourceAfterSync: createdMirror.source });

    // Reads exactly the newly created object. No collection sync or unrelated
    // event contents are supplied to this test or to any model.
    const targetSnapshot = await readCalendarTargetForDraft(calendarUrl, href);
    assert.equal(targetSnapshot.uid, uid);
    const updatePayload = parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", { ...createPayload,
      summary: `${marker} updated`, startsAt: new Date(start + 1_800_000).toISOString(), endsAt: new Date(start + 2_400_000).toISOString(),
      eventId: createdMirror.id, expectedUid: targetSnapshot.uid, expectedEtag: targetSnapshot.etag, beforeSnapshotHash: targetSnapshot.snapshotHash });
    knownStates.push(updatePayload);
    const updateId = await createPending("UPDATE_CALENDAR_EVENT", updatePayload, { calendarUrlHash: hash(calendarUrl),
      eventUpdatedAt: createdMirror.updated_at, eventHrefHash: hash(href) });
    failPostUpdateRead = true;
    const updated = await execute(updateId, "uncertain");
    assert.equal(calls.updates, 1); assert.equal(calls.syntheticPostUpdateReadFailures, 1);
    const uncertainReceipt = await admin.from("calendar_execution_receipts").select("state,write_attempts,uid,href").eq("approval_id", updateId).single();
    assert.ifError(uncertainReceipt.error); assert.equal(uncertainReceipt.data.state, "uncertain"); assert.equal(uncertainReceipt.data.write_attempts, 1);
    assert.equal(uncertainReceipt.data.uid, uid); assert.equal(uncertainReceipt.data.href, href);
    const failedApproval = await admin.from("approval_requests").select("status,result").eq("id", updateId).single();
    assert.ifError(failedApproval.error); assert.equal(failedApproval.data.status, "failed");
    assert.equal((failedApproval.data.result as { calendarState?: string } | null)?.calendarState, "uncertain");
    assert.equal((await mirror()).summary, createPayload.summary, "Unverified UPDATE must not claim that the mirror was updated");
    persist("post_put_read_failure_recorded", { updateApprovalId: updateId, uncertainReceipt: uncertainReceipt.data,
      approvalStatus: failedApproval.data.status, writeCalls: calls });
    failPostUpdateRead = false;
    // The fault affected only the test worker's verification read. Observe the
    // one real UPDATE, then let the actual app perform its own independent read.
    const beforeRecoveryProof = await readApprovedCalendarTarget(calendarUrl, href, transport);
    assert.ok(matches(beforeRecoveryProof.parsedEvent, updatePayload));
    const session = await user.auth.getSession(); assert.ifError(session.error); assert.ok(session.data.session);
    browser = await chromium.launch({ channel: process.env.GATE_BROWSER_CHANNEL ?? "chrome", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{ name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify(session.data.session)).toString("base64"), url: app }]);
    const page = await context.newPage();
    const browserErrors: string[] = []; const unexpectedPosts: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("request", (request) => { if (request.method() === "POST" && new URL(request.url()).pathname !== "/approvals") unexpectedPosts.push(new URL(request.url()).pathname); });
    const loaded = await page.goto(`${app}/approvals`, { waitUntil: "domcontentloaded", timeout: 40_000 });
    assert.equal(loaded?.status(), 200); assert.equal(new URL(page.url()).pathname, "/approvals", "Owner cookie must authenticate the real page");
    const card = page.locator("section").filter({ has: page.getByRole("heading", { name: `${marker} UPDATE_CALENDAR_EVENT`, exact: true }) });
    assert.equal(await card.count(), 1);
    await card.getByText("실행 결과 확인 필요", { exact: true }).waitFor({ timeout: 15_000 });
    const recoveryButton = card.getByRole("button", { name: "실행 결과 다시 확인", exact: true });
    await recoveryButton.waitFor({ timeout: 15_000 });
    const [response] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === "/approvals"
        && response.request().method() === "POST" && !!response.request().headers()["next-action"], { timeout: 75_000 }),
      recoveryButton.click(),
    ]);
    assert.equal(response.status(), 200); assert.match(response.headers()["content-type"] ?? "", /text\/x-component/);
    await card.getByText("실행 완료", { exact: true }).waitFor({ timeout: 20_000 });
    assert.equal(await card.getByRole("button", { name: "실행 결과 다시 확인", exact: true }).count(), 0);
    assert.equal(await card.getByRole("alert").count(), 0);
    assert.deepEqual(browserErrors, []); assert.deepEqual(unexpectedPosts, [], "Recovery must not invoke chat/AI or any other action endpoint");
    const recoveredApproval = await admin.from("approval_requests").select("status,result").eq("id", updateId).single();
    assert.ifError(recoveredApproval.error); assert.equal(recoveredApproval.data.status, "executed");
    assert.equal((recoveredApproval.data.result as { calendarState?: string } | null)?.calendarState, "verified");
    const updateProof = await readApprovedCalendarTarget(calendarUrl, href, transport);
    assert.ok(matches(updateProof.parsedEvent, updatePayload)); assert.equal(updateProof.uid, uid);
    assert.equal(updateProof.etag, beforeRecoveryProof.etag, "Owner recovery must retain the remote version produced by the one real PUT");
    assert.equal((await mirror()).id, createdMirror.id); const updateReceipt = await assertReceipt(updateId, true);
    assert.equal(updateReceipt.mirror_event_id, createdMirror.id);
    const receiptCount = await admin.from("calendar_execution_receipts").select("approval_id", { count: "exact", head: true }).eq("approval_id", updateId);
    assert.ifError(receiptCount.error); assert.equal(receiptCount.count, 1);
    assert.equal(calls.creates, 1); assert.equal(calls.updates, 1);
    assert.equal((await executeCalendarForApprovalForJob(updated.claimed, updated.worker, counted)).kind, "verified");
    assert.equal(calls.creates, 1); assert.equal(calls.updates, 1);
    const usageAfter = await admin.from("ai_usage").select("id", { count: "exact", head: true });
    assert.ifError(usageAfter.error); assert.equal(usageAfter.count, usageBefore.count, "Live calendar gate must not add AI usage");
    persist("owner_cookie_recovery_and_replay_verified", { updateReceipt, updateSnapshotHash: updateProof.snapshotHash, writeCalls: calls,
      ownerRecoveryHttpStatus: response.status(), ownerRecoveryContentType: response.headers()["content-type"], ownerRecoveryCardStatus: "실행 완료",
      ownerRecoveryReceiptCount: receiptCount.count, remoteEtagUnchangedByRecovery: true, browserErrors, unexpectedPosts,
      aiUsageRowsAfter: usageAfter.count, roundTripVerified: true });
  } catch (error) {
    failure = error; persist("gate_failed", { failureName: error instanceof Error ? error.name : "UnknownError", writeCalls: calls });
  } finally {
    t.signal.removeEventListener("abort", closeOnAbort);
    try { await browser?.close(); }
    catch (error) { cleanupFailure = error; persist("browser_close_failed", { browserCloseFailureName: error instanceof Error ? error.name : "UnknownError" }); }
    try {
      if (transport && initiallyMissing && writeMayHaveOccurred) {
        persist("before_conditional_cleanup", { uid, href, writeCalls: calls });
        const current = await transport.read(calendarUrl, href);
        if (current === null) {
          cleanupConfirmed = true; persist("cleanup_confirmed_404", { cleanupConfirmed404: true, deleteWasNeeded: false });
        } else {
          const observed = await readApprovedCalendarTarget(calendarUrl, href, transport);
          assert.ok(knownStates.some((payload) => matches(observed.parsedEvent, payload)), "Remote object no longer matches our approved test states; preserve it and local receipts");
          assert.ok(observed.parsedEvent.summary.startsWith(marker), "Never delete a non-test title");
          assert.equal(observed.uid, uid); assert.equal(current.etag, observed.etag, "Object changed while inspecting cleanup; preserve it");
          const raw = new ICAL.Component(ICAL.parse(current.data));
          assert.equal(raw.getAllSubcomponents("vevent").length, 1);
          assert.equal(raw.getFirstSubcomponent("vevent")!.getAllSubcomponents("valarm").length, 0, "Do not delete an externally altered alarm-bearing object");
          const client = await createCalDavClient();
          calls.deletes++;
          let deleteStatus: number | null = null;
          let deleteFailureName: string | null = null;
          try {
            const deleted = await client.deleteCalendarObject({ calendarObject: { url: href, etag: current.etag },
              fetchOptions: { signal: AbortSignal.timeout(20_000), redirect: "error" } });
            deleteStatus = deleted.status;
          } catch (error) { deleteFailureName = error instanceof Error ? error.name : "UnknownDeleteError"; }
          // A lost DELETE response is unresolved until exact 404 read-back.
          persist("conditional_delete_sent", { deleteStatus, deleteFailureName, deleteEtag: current.etag, writeCalls: calls });
          assert.equal(await transport.read(calendarUrl, href), null, "Conditional cleanup not confirmed; retain local recovery receipts");
          cleanupConfirmed = true; persist("cleanup_confirmed_404", { cleanupConfirmed404: true, deleteStatus, writeCalls: calls });
        }
      } else if (!writeMayHaveOccurred) {
        // No remote write was attempted, so no remote deletion is permitted.
        persist("no_remote_write_attempted", { initiallyMissing, writeCalls: calls });
      }
      if (!writeMayHaveOccurred || cleanupConfirmed) {
        await cleanupLocal(); persist("local_fixture_cleanup_completed", { localFixtureCleanupCompleted: true, cleanupConfirmed404: cleanupConfirmed });
      }
    } catch (error) {
      cleanupFailure = error;
      persist(cleanupConfirmed ? "remote_cleanup_confirmed_local_cleanup_failed" : "cleanup_unconfirmed_retain_local_receipts", { cleanupConfirmed404: cleanupConfirmed,
        cleanupFailureName: error instanceof Error ? error.name : "UnknownError", recordedDraftIds: drafts, recordedApprovalIds: approvals, uid, href, writeCalls: calls });
    }
  }
  console.log(`G6B live evidence file: ${evidencePath}`);
  if (failure && cleanupFailure) throw new AggregateError([failure, cleanupFailure], "Live gate failed and cleanup requires recovery from the private evidence file");
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
  assert.equal(cleanupConfirmed, true, "Successful live gate includes confirmed remote cleanup");
});
