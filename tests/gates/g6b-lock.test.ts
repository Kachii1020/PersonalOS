/**
 * Local-only target-lock/approval-expiry regression. No AI or CalDAV transport.
 * The only child process is psql in supabase_db_personalos-phase6-verified.
 * Root must run serially with other local fixture gates after reviewing this file.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/types/database";
import { createDialogueDraftForOwner } from "../../lib/repos/jarvis-dialogue";
import { claimApprovedActionByIdForJob } from "../../lib/repos/jarvis-approvals";
import { parseCalendarActionPayload } from "../../lib/jarvis/calendar-action-payload";

config({ path: [".env.development.local", ".env.local"], quiet: true });
const CONTAINER = "supabase_db_personalos-phase6-verified";
const LOCK_MARKER = "G6B_OWNED_CALENDAR_LOCK_ACQUIRED";
type Receipt = Database["public"]["Tables"]["calendar_execution_receipts"]["Row"];

function holdOwnedCalendar(calendarId: string) {
  assert.match(calendarId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  // No shell interpolation. The SQL ID is a validated newly inserted UUID.
  const child = spawn("docker", ["exec", "-i", CONTAINER, "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", "-"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "", errors = "", acquiredAt = 0;
  let resolveAcquired!: () => void, rejectAcquired!: (error: Error) => void;
  let resolveExited!: () => void, rejectExited!: (error: Error) => void;
  const acquired = new Promise<void>((resolve, reject) => { resolveAcquired = resolve; rejectAcquired = reject; });
  const exited = new Promise<void>((resolve, reject) => { resolveExited = resolve; rejectExited = reject; });
  // A startup error can settle exit before the caller reaches await exited.
  // It is still asserted by the normal execution path and inspected on cleanup.
  void exited.catch(() => undefined);
  const timer = setTimeout(() => {
    rejectAcquired(new Error("Local calendar lock was not acquired within 8 seconds"));
    child.kill("SIGTERM");
  }, 8_000);
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
    if (!acquiredAt && output.includes(LOCK_MARKER)) {
      clearTimeout(timer);
      if (!output.split(/\r?\n/).includes(calendarId)) {
        rejectAcquired(new Error("The fixed container did not find the owned calendar row; refuse the expiry RPC"));
        child.kill("SIGTERM"); return;
      }
      acquiredAt = Date.now(); resolveAcquired();
    }
  });
  child.stderr.on("data", (chunk: Buffer) => { errors += chunk.toString("utf8"); });
  child.stdin.on("error", (error) => { clearTimeout(timer); rejectAcquired(error); child.kill("SIGTERM"); });
  child.on("error", (error) => { clearTimeout(timer); rejectAcquired(error); rejectExited(error); });
  child.on("close", (code, signal) => {
    clearTimeout(timer);
    if (!acquiredAt) rejectAcquired(new Error(`Local lock process closed before its marker: ${code ?? signal}; ${errors}`));
    if (code === 0) resolveExited();
    else rejectExited(new Error(`Local lock process failed: ${code ?? signal}; ${errors}`));
  });
  // Timeouts are transaction-local. Even if the test/CLI dies, this synthetic
  // row cannot remain locked indefinitely. No DDL or persistent SQL change.
  child.stdin.end(`BEGIN;
SET LOCAL statement_timeout = '6s';
SET LOCAL idle_in_transaction_session_timeout = '6s';
SELECT id FROM public.calendars WHERE id='${calendarId}' FOR UPDATE;
\\echo ${LOCK_MARKER}
SELECT pg_sleep(3);
ROLLBACK;
`);
  return {
    child, acquired, exited, acquiredAt: () => acquiredAt,
    async close() {
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
      // The container-side statement has its own six-second ceiling; killing
      // the CLI is not taken as evidence that PostgreSQL released a lock.
      await new Promise<void>((resolve) => {
        const wait = setTimeout(resolve, 6_500);
        const finished = () => { clearTimeout(wait); resolve(); };
        void exited.then(finished, finished);
      });
    },
  };
}

test("G6B expired approval cannot consume a write after waiting for the target row lock", { timeout: 35_000 }, async () => {
  assert.equal(process.env.GATE_ISOLATED_DB, "1");
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54621");
  assert.equal(process.env.ALLOWED_EMAIL, "phase5a@example.test");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  assert.ok(anon && service);
  const admin = createClient<Database>(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const marker = `g6b-lock-${randomUUID()}`;
  let calendarId = "", draftId = "", approvalId = "";
  let lock: ReturnType<typeof holdOwnedCalendar> | undefined;

  async function rpc<T>(name: string, body: unknown) {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", signal: AbortSignal.timeout(12_000),
      headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const text = await response.text();
    return { ok: response.ok, status: response.status, data: (text ? JSON.parse(text) : null) as T };
  }
  try {
    const generated = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.ALLOWED_EMAIL! });
    assert.ifError(generated.error);
    const user = createClient<Database>(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await user.auth.verifyOtp({ type: "email", email: process.env.ALLOWED_EMAIL!, token: generated.data.properties.email_otp });
    assert.ifError(login.error);
    const calendarUrl = `https://calendar.example.test/${marker}/`;
    const inserted = await admin.from("calendars").insert({ kind: "caldav", source_url: calendarUrl, display_name: marker, is_writable: true }).select("id").single();
    assert.ifError(inserted.error); calendarId = inserted.data.id;
    const starts = Math.floor((Date.now() + 86_400_000) / 1000) * 1000;
    const payload = parseCalendarActionPayload("CREATE_CALENDAR_EVENT", { version: 1, calendarId, summary: marker, description: null, location: null,
      startsAt: new Date(starts).toISOString(), endsAt: new Date(starts + 600_000).toISOString(), timezone: "Asia/Tokyo" });
    const draft = await createDialogueDraftForOwner({ ownerId: login.data.user!.id, type: "CREATE_CALENDAR_EVENT", title: marker,
      explanation: "Local row-lock fixture; no CalDAV transport is invoked", payload,
      sourceSnapshot: { calendarUrlHash: createHash("sha256").update(calendarUrl).digest("hex") }, executable: true });
    draftId = draft.id;
    const requested = await user.rpc("request_dialogue_approval", { p_draft_id: draftId });
    assert.ifError(requested.error); approvalId = requested.data;
    const approved = await user.rpc("decide_approval", { p_approval_id: approvalId, p_decision: "approved" }); assert.ifError(approved.error);
    const worker = marker;
    assert.ok(await claimApprovedActionByIdForJob(approvalId, worker));
    const began = await rpc<Receipt>("begin_calendar_execution", { p_approval_id: approvalId, p_worker_id: worker });
    assert.ok(began.ok, JSON.stringify(began.data)); assert.ok(began.data.claim_token);

    lock = holdOwnedCalendar(calendarId);
    await lock.acquired;
    const expiresAt = new Date(Date.now() + 1000).toISOString();
    const changed = await admin.from("approval_requests").update({ expires_at: expiresAt }).eq("id", approvalId);
    assert.ifError(changed.error);
    const startedAt = Date.now();
    assert.ok(startedAt < Date.parse(expiresAt) - 150, "Expiry must still be in the future when the RPC begins");
    const denied = await rpc<{ message?: string }>("before_calendar_write", { p_approval_id: approvalId, p_worker_id: worker, p_claim_token: began.data.claim_token });
    const finishedAt = Date.now();
    await lock.exited;
    assert.equal(denied.ok, false, "The post-lock check must reject the expired approval");
    assert.match(denied.data?.message ?? "", /write lease expired while validating/);
    assert.ok(finishedAt - startedAt >= 1500, "This must exercise waiting on the held row, not immediate precondition rejection");
    assert.ok(finishedAt >= Date.parse(expiresAt));
    const receipt = await admin.from("calendar_execution_receipts").select("state,write_attempts,attempted_at").eq("approval_id", approvalId).single();
    assert.ifError(receipt.error);
    assert.deepEqual(receipt.data, { state: "prepared", write_attempts: 0, attempted_at: null });
    const audit = await admin.from("action_audit_logs").select("event").eq("approval_request_id", approvalId).order("id");
    assert.ifError(audit.error); assert.deepEqual(audit.data.map((row) => row.event), ["requested", "approved"]);
    const mirror = await admin.from("events").select("id").eq("calendar_id", calendarId); assert.ifError(mirror.error); assert.equal(mirror.data.length, 0);
    console.log(`G6B post-lock expiry: waited=${finishedAt - startedAt}ms, lockStarted=${new Date(lock.acquiredAt()).toISOString()}, writeAttempts=0, executingAudit=0`);
  } finally {
    if (lock) await lock.close();
    // Recover a committed approval ID if its response was lost. All filters
    // below are tied to this test's own generated IDs, never a global cleanup.
    if (draftId && !approvalId) {
      const row = await admin.from("dialogue_action_drafts").select("approval_request_id").eq("id", draftId).maybeSingle();
      assert.ifError(row.error); approvalId = row.data?.approval_request_id ?? "";
    }
    const events = draftId ? await admin.from("system_events").select("id").eq("source_type", "dialogue_draft").eq("source_id", draftId) : { data: [], error: null };
    assert.ifError(events.error);
    const eventIds = events.data.map((row) => row.id);
    const runs = eventIds.length ? await admin.from("agent_runs").select("id").in("trigger_event_id", eventIds) : { data: [], error: null };
    assert.ifError(runs.error);
    if (approvalId) {
      assert.ifError((await admin.from("calendar_execution_receipts").delete().eq("approval_id", approvalId)).error);
      assert.ifError((await admin.from("action_audit_logs").delete().eq("approval_request_id", approvalId)).error);
    }
    if (draftId) assert.ifError((await admin.from("dialogue_action_drafts").delete().eq("id", draftId)).error);
    if (approvalId) assert.ifError((await admin.from("approval_requests").delete().eq("id", approvalId)).error);
    if (runs.data.length) assert.ifError((await admin.from("agent_runs").delete().in("id", runs.data.map((row) => row.id))).error);
    if (eventIds.length) assert.ifError((await admin.from("system_events").delete().in("id", eventIds)).error);
    if (calendarId) {
      assert.ifError((await admin.from("events").delete().eq("calendar_id", calendarId)).error);
      assert.ifError((await admin.from("calendars").delete().eq("id", calendarId)).error);
    }
  }
});
