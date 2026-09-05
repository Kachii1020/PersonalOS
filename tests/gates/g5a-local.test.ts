/** Real PostgreSQL/RLS/worker gate. Requires the isolated local stack; never hosted. */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { processJarvisStep, processJarvisSteps } from "../../lib/jarvis/orchestrator";
import { executeApprovedActionById } from "../../lib/jarvis/executor";
import { createTaskForApprovalForJob } from "../../lib/repos/jarvis-approvals";
import { generateCommandBriefForJob } from "../../lib/jarvis/command-brief";

config({ path: [".env.development.local", ".env.local"], quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const app = process.env.G5A_APP_URL ?? "http://localhost:3055";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const email = process.env.ALLOWED_EMAIL!;
let token = "";
let otherToken = "";
const ids: Record<string, string[]> = { inbox_items: [], system_events: [], agent_runs: [], approval_requests: [], tasks: [] };
async function rest(path: string, method = "GET", body?: unknown, key = service) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method, headers: { apikey: key === service ? service : anon, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, data: text ? JSON.parse(text) : null };
}
async function rows(path: string) {
  const result = await rest(path);
  assert.ok(result.ok, JSON.stringify(result.data));
  return result.data;
}
async function rpc(name: string, body: unknown, key = service) { return rest(`rpc/${name}`, "POST", body, key); }
async function login(address: string) {
  const client = createClient(url, service, { auth: { persistSession: false } });
  const link = await client.auth.admin.generateLink({ type: "magiclink", email: address });
  assert.ifError(link.error);
  const session = await createClient(url, anon, { auth: { persistSession: false } }).auth.verifyOtp({
    type: "email", email: address, token: link.data.properties.email_otp,
  });
  assert.ifError(session.error);
  return session.data.session!.access_token;
}
async function capture(text = "할 일: G5A integration task") {
  const r = await rest("inbox_items", "POST", { kind: "command", raw_text: text }, token);
  assert.ok(r.ok, JSON.stringify(r.data));
  const id = r.data[0].id as string;
  ids.inbox_items.push(id);
  const events = await rows(`system_events?source_id=eq.${id}`);
  assert.equal(events.length, 1);
  ids.system_events.push(events[0].id);
  return { id, eventId: events[0].id as string };
}
async function prepare() {
  const captureRow = await capture();
  const result = await processJarvisSteps({ workerId: crypto.randomUUID(), maxSteps: 6 });
  assert.ok(result.some((r) => r.kind === "approval_prepared"), JSON.stringify(result));
  const runs = await rows(`agent_runs?trigger_event_id=eq.${captureRow.eventId}`);
  ids.agent_runs.push(runs[0].id);
  const approvals = await rows(`approval_requests?agent_run_id=eq.${runs[0].id}`);
  ids.approval_requests.push(approvals[0].id);
  return approvals[0];
}
async function decision(id: string, value: "approved" | "rejected") {
  const r = await rpc("decide_approval", { p_approval_id: id, p_decision: value }, token);
  assert.ok(r.ok, JSON.stringify(r.data));
}

describe("G5A local database and worker integration", { concurrency: false }, () => {
  before(async () => {
    assert.equal(url, "http://127.0.0.1:54621", "Use the isolated G5A stack only");
    assert.equal(email, "phase5a@example.test");
    token = await login(email);
    otherToken = await login("not-allowed@example.test");
  });
  after(async () => {
    for (const id of ids.approval_requests) await rest(`tasks?approval_request_id=eq.${id}`, "DELETE");
    for (const table of ["tasks", "approval_requests", "agent_runs", "system_events", "inbox_items"]) {
      for (const id of ids[table]) await rest(`${table}?id=eq.${id}`, "DELETE");
    }
  });
  it("G5A-2: inbox trigger emits exactly one deduplicated event", async () => {
    const c = await capture("G5A trigger memo");
    const event = (await rows(`system_events?id=eq.${c.eventId}`))[0];
    const duplicate = await rest("system_events", "POST", { event_type: event.event_type, source_type: event.source_type, dedupe_key: event.dedupe_key });
    assert.equal(duplicate.status, 409);
    await processJarvisSteps({ workerId: "trigger-test", maxSteps: 3 });
    const runs = await rows(`agent_runs?trigger_event_id=eq.${c.eventId}`);
    ids.agent_runs.push(runs[0].id);
  });
  it("G5A-12: anon/non-allowlisted users cannot read data or invoke worker RPCs", async () => {
    for (const table of ["inbox_items", "system_events", "agent_runs", "approval_requests", "action_audit_logs", "command_briefs"]) {
      for (const key of [anon, otherToken]) {
        const r = await rest(`${table}?select=*`, "GET", undefined, key);
        assert.ok(!r.ok || r.data.length === 0, `${table}: unauthorized rows`);
      }
    }
    for (const key of [anon, token, otherToken]) {
      const r = await rpc("claim_next_system_event", { p_worker_id: "untrusted" }, key);
      assert.ok([401, 403].includes(r.status), "worker claim must be service-only");
      const execute = await rpc("execute_approved_task", { p_approval_id: crypto.randomUUID(), p_worker_id: "untrusted" }, key);
      assert.ok([401, 403].includes(execute.status));
    }
    const forged = await rest("inbox_items", "POST", { kind: "command", raw_text: "forged", status: "act_now" }, token);
    assert.ok(!forged.ok, "classification is server-owned");
  });
  it("G5A-3/4: two workers claim once and resume the persisted run step after lease expiry", async () => {
    const c = await capture();
    const claims = await Promise.all(["a", "b"].map((worker) => rpc("claim_next_system_event", { p_worker_id: worker })));
    assert.ok(claims.every((r) => r.ok));
    assert.equal(claims.flatMap((r) => r.data).filter((r) => r.id === c.eventId).length, 1);
    await rest(`system_events?id=eq.${c.eventId}`, "PATCH", { locked_until: "2000-01-01T00:00:00Z" });
    assert.equal((await processJarvisStep("resume-event")).kind, "run_started");
    const runs = await rows(`agent_runs?trigger_event_id=eq.${c.eventId}`);
    ids.agent_runs.push(runs[0].id);
    const runClaims = await Promise.all(["a", "b"].map((worker) => rpc("claim_next_agent_run", { p_worker_id: worker })));
    assert.equal(runClaims.flatMap((r) => r.data).length, 1);
    await rest(`agent_runs?id=eq.${runs[0].id}`, "PATCH", { locked_until: "2000-01-01T00:00:00Z" });
    assert.equal((await processJarvisStep("classify")).kind, "classified");
    assert.equal((await rows(`agent_runs?id=eq.${runs[0].id}`))[0].current_step, "prepare_approval");
    assert.equal((await processJarvisStep("new-request")).kind, "approval_prepared");
    const approval = (await rows(`approval_requests?agent_run_id=eq.${runs[0].id}`))[0];
    ids.approval_requests.push(approval.id);
    assert.equal((await rows(`tasks?approval_request_id=eq.${approval.id}`)).length, 0);
    await decision(approval.id, "rejected");
  });
  it("G5A-6/7/13: no preapproval task; concurrent approval/execution and replay create one task and ordered audit", async () => {
    const a = await prepare();
    assert.equal((await executeApprovedActionById(a.id, "before")).kind, "idle");
    assert.equal((await rows(`tasks?approval_request_id=eq.${a.id}`)).length, 0);
    const tampered = await rest(`approval_requests?id=eq.${a.id}`, "PATCH", { payload: { title: "forged" } }, token);
    assert.ok(!tampered.ok);
    const forged = await rest("tasks", "POST", { title: "forged task", approval_request_id: a.id }, token);
    assert.ok(!forged.ok, "client cannot preoccupy the approval idempotency key");
    const manual = await rest("tasks", "POST", { title: "G5A manual task" }, token);
    assert.ok(manual.ok, "ordinary task creation remains allowed");
    ids.tasks.push(manual.data[0].id);
    const relink = await rest(`tasks?id=eq.${manual.data[0].id}`, "PATCH", { approval_request_id: a.id }, token);
    assert.equal(relink.status, 403);
    assert.ok((await rest(`tasks?id=eq.${manual.data[0].id}`, "PATCH", { title: "G5A manual edit" }, token)).ok);
    const decisions = await Promise.all([1, 2].map(() => rpc("decide_approval", { p_approval_id: a.id, p_decision: "approved" }, token)));
    assert.equal(decisions.filter((r) => r.ok).length, 1);
    const results = await Promise.all(["worker-a", "worker-b"].map((worker) => executeApprovedActionById(a.id, worker)));
    assert.equal(results.filter((r) => r.kind === "executed").length, 1, JSON.stringify(results));
    assert.equal((await executeApprovedActionById(a.id, "replay")).kind, "idle");
    const tasks = await rows(`tasks?approval_request_id=eq.${a.id}`);
    assert.equal(tasks.length, 1);
    assert.equal((await createTaskForApprovalForJob(a.id, "response-lost-replay")).id, tasks[0].id);
    const audit = await rows(`action_audit_logs?approval_request_id=eq.${a.id}&order=id`);
    assert.deepEqual(audit.map((r: { event: string }) => r.event), ["requested", "approved", "executing", "executed", "verified"]);
    assert.equal((await rows(`agent_runs?id=eq.${a.agent_run_id}`))[0].current_step, "verified");
    console.log(`Evidence: approval ${a.id}, task ${tasks[0].id}, exact audit order, replay count=1`);
  });
  it("G5A-8: rejection leaves no side effect and records the decision", async () => {
    const a = await prepare();
    await decision(a.id, "rejected");
    assert.equal((await executeApprovedActionById(a.id, "rejected")).kind, "idle");
    assert.equal((await rows(`tasks?approval_request_id=eq.${a.id}`)).length, 0);
    assert.deepEqual((await rows(`action_audit_logs?approval_request_id=eq.${a.id}&order=id`)).map((r: { event: string }) => r.event), ["requested", "rejected"]);
  });
  it("expired/stale leases cannot insert tasks; a recovered approval is executable once", async () => {
    const a = await prepare();
    await decision(a.id, "approved");
    assert.ok((await rpc("claim_approved_action_by_id", { p_approval_id: a.id, p_worker_id: "old" })).ok);
    await rest(`approval_requests?id=eq.${a.id}`, "PATCH", { locked_until: "2000-01-01T00:00:00Z" });
    await assert.rejects(createTaskForApprovalForJob(a.id, "old"), /lease lost/);
    assert.equal((await rows(`tasks?approval_request_id=eq.${a.id}`)).length, 0);
    assert.ok((await rpc("claim_approved_action_by_id", { p_approval_id: a.id, p_worker_id: "new" })).ok);
    await assert.rejects(createTaskForApprovalForJob(a.id, "old"), /lease lost/);
    await rest(`approval_requests?id=eq.${a.id}`, "PATCH", { expires_at: "2000-01-01T00:00:00Z" });
    await assert.rejects(createTaskForApprovalForJob(a.id, "new"), /expired/);
    assert.equal((await rows(`tasks?approval_request_id=eq.${a.id}`)).length, 0);
  });
  it("execution transaction rolls back task and execution audit if a write fails", async () => {
    const a = await prepare();
    await decision(a.id, "approved");
    await rpc("claim_approved_action_by_id", { p_approval_id: a.id, p_worker_id: "rollback" });
    // Invalid FK result cannot be introduced through public input. An invalid
    // priority simulates a write failure inside the execution transaction.
    await rest(`approval_requests?id=eq.${a.id}`, "PATCH", { payload: { ...a.payload, priority: 999 } });
    await assert.rejects(createTaskForApprovalForJob(a.id, "rollback"));
    assert.equal((await rows(`tasks?approval_request_id=eq.${a.id}`)).length, 0);
    assert.deepEqual((await rows(`action_audit_logs?approval_request_id=eq.${a.id}&order=id`)).map((r: { event: string }) => r.event), ["requested", "approved"]);
    await rest(`approval_requests?id=eq.${a.id}`, "PATCH", { payload: a.payload });
    assert.ok((await createTaskForApprovalForJob(a.id, "rollback")).id);
  });
  it("G5A-9: unsupported action is failed and auditable without a task", async () => {
    const a = await prepare();
    await rest(`approval_requests?id=eq.${a.id}`, "PATCH", { action_type: "MAKE_PAYMENT" });
    await decision(a.id, "approved");
    assert.equal((await executeApprovedActionById(a.id, "denied-policy")).kind, "failed");
    assert.equal((await rows(`tasks?approval_request_id=eq.${a.id}`)).length, 0);
    assert.equal((await rows(`approval_requests?id=eq.${a.id}`))[0].status, "failed");
  });
  it("G5A-10/11: deterministic brief is persisted and contains at most three actions", async () => {
    const aiBefore = (await rows("ai_usage?select=id")).length;
    const many = await rest("tasks", "POST", Array.from({ length: 105 }, (_, i) => ({
      title: `G5A rank ${i}`, priority: i === 104 ? 100 : 1,
      due_at: i === 104 ? null : "2030-01-01T00:00:00Z",
    })));
    assert.ok(many.ok);
    ids.tasks.push(...many.data.map((r: { id: string }) => r.id));
    const result = await generateCommandBriefForJob();
    assert.ok(result.topActions.length <= 3);
    assert.equal(result.topActions[0].title, "G5A rank 104");
    const saved = await rows(`command_briefs?brief_date=eq.${result.date}`);
    assert.equal(saved.length, 1);
    assert.deepEqual(saved[0].top_actions, result.topActions);
    assert.equal((await rows("ai_usage?select=id")).length, aiBefore);
  });
  it("job endpoints reject unauthorized calls and persist worker failures as HTTP 500", async () => {
    for (const route of ["process-system-events", "process-approved-actions", "generate-command-brief"]) {
      assert.equal((await fetch(`${app}/api/jobs/${route}`, { method: "POST" })).status, 401);
    }
    const event = await rest("system_events", "POST", { event_type: "g5a.unsupported", source_type: "test", dedupe_key: crypto.randomUUID() });
    ids.system_events.push(event.data[0].id);
    const response = await fetch(`${app}/api/jobs/process-system-events`, { method: "POST", headers: { "x-cron-secret": process.env.CRON_SECRET! } });
    assert.equal(response.status, 500, await response.text());
    const run = (await rows(`agent_runs?trigger_event_id=eq.${event.data[0].id}`))[0];
    ids.agent_runs.push(run.id);
    assert.equal(run.status, "failed");
    const jobs = await rows("job_runs?job_name=eq.process-system-events&order=started_at.desc&limit=1");
    assert.equal(jobs[0].status, "failed");
  });
});
