/** G7 isolated PostgreSQL gate. Synthetic holdout and mock transports, no AI/Push/CalDAV network.
 * Read-only restore/projection counts are not human/device conversation-completion evidence.
 * Never run alongside another fixture gate or claim seven days of timing from this file. */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { config } from "dotenv";
import ical from "ical-generator";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/types/database";
import type { WorkContext, WorkInput } from "../../lib/jarvis/work-types";
import type { DialogueDraft } from "../../lib/jarvis/dialogue-types";
import type { CalendarActionPayload, CalendarActionType } from "../../lib/jarvis/calendar-action-payload";
import { parseCalendarActionPayload, calendarUidForApproval, calendarFilenameForApproval } from "../../lib/jarvis/calendar-action-payload";
import { validateWorkInput, canSendWorkAttention, groundWorkIntent } from "../../lib/jarvis/work-context";
import { getWorkSnapshotForClient } from "../../lib/repos/work-contexts";
import { createDialogueDraftForOwner } from "../../lib/repos/jarvis-dialogue";
import { claimApprovedActionByIdForJob } from "../../lib/repos/jarvis-approvals";
import { executeApprovedActionById } from "../../lib/jarvis/executor";
import { executeCalendarForApprovalForJob } from "../../lib/repos/jarvis-calendar-actions";
import { readApprovedCalendarTarget, hashCalendarSnapshot, type ApprovedCalendarTransport, type CalendarObjectSnapshot } from "../../lib/integrations/caldav/approved-actions";

config({ path: [".env.eval.local", ".env.local"], quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const marker = `g7-${randomUUID()}`;
const DAY = 86_400_000;
const hash = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const seconds = (value: number) => new Date(Math.floor(value / 1000) * 1000).toISOString();
const owned = new Map<string, Set<string>>();
const keep = (table: string, id: string) => { if (!owned.has(table)) owned.set(table, new Set()); owned.get(table)!.add(id); return id; };
type IdRow = { id: string };
type Attention = IdRow & { context_id: string; source_revision: number; kind: string; due_at: string; status: string; acknowledged_at: string | null; quota_reserved_at: string | null };
type Claim = { id: string; contextId: string; kind: string };
type Delivery = { deliveryId: string; attemptToken: string; attempt: number };
type HoldoutAction = { id: string; type: "CREATE_TASK" | CalendarActionType; fields: Record<string, string | null>; decision: string; outcome: string; priorOutcome?: string; remoteAlreadyMatchesReviewedTarget?: boolean; transportOutcome?: string };
type Holdout = { contexts: { id: string; input: WorkInput }[]; restores: { id: string; contextRef: string; channel: string; expected: WorkInput & { status: string } }[];
  workflows: { id: string; contextRef: string; actions: HoldoutAction[]; expected: { verifiedActionIds: string[]; uncertainActionIds: string[]; pendingApprovalActionIds: string[]; workStatus: string | null; mayMarkWorkCompleted: boolean; explicitUserStatusCommand?: string; explicitUserMemoryCommand?: string; contextAvailable?: boolean; failedActionIds?: string[]; conflictingActionIds?: string[]; staleReviewActionIds?: string[]; expiredActionIds?: string[]; confirmedEffectCount: number; verifiedExistingEffectCount?: number; linkedSource?: { currentStatus: string; storedContextClaim: string }; requestReplayCount?: number; duplicateApprovalClicks?: string[]; concurrentApprovalClients?: number; maximumUniqueEffects?: number; nextStepMustRemain?: string; ignoreUnverifiedAssistantClaim?: string } }[] };
const holdoutRaw = readFileSync(new URL("../fixtures/work-context-holdout.json", import.meta.url), "utf8");
const holdout = JSON.parse(holdoutRaw) as Holdout;
let ownerId = "", token = "", otherId = "", otherToken = "", calendarId = "", subscriptionId = "";
let client: SupabaseClient<Database>, secondClient: SupabaseClient<Database>;
let guarded = false;
const originalCalendarFlag = process.env.JARVIS_CALENDAR_ACTIONS_ENABLED;
const originalWorkFlag = process.env.JARVIS_CONTEXT_ENABLED;
const calendarUrl = `https://calendar.example.test/${marker}/`;
async function rest<T = unknown>(path: string, method = "GET", body?: unknown, key = service) {
  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/${path}`, { method, signal: AbortSignal.timeout(15_000),
      headers: { apikey: key === service ? service : anon, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (error) {
    throw new Error(`Local gate transport failed: ${method} ${path}`, { cause: error });
  }
  const text = await response.text(); return { ok: response.ok, status: response.status, data: (text ? JSON.parse(text) : null) as T };
}
async function rows<T = IdRow>(path: string, method = "GET", body?: unknown, key = service): Promise<T[]> { const r = await rest<T[]>(path, method, body, key); assert.ok(r.ok, `${path}: ${r.status} ${JSON.stringify(r.data)}`); return r.data ?? []; }
async function rpc<T = unknown>(name: string, body: unknown = {}, key = token) { return rest<T>(`rpc/${name}`, "POST", body, key); }
async function ok<T>(name: string, body: unknown = {}, key = token): Promise<T> { const r = await rpc<T>(name, body, key); assert.ok(r.ok, `${name}: ${JSON.stringify(r.data)}`); return r.data; }
async function login(address: string) {
  const a = createClient(url, service, { auth: { persistSession: false } }); const link = await a.auth.admin.generateLink({ type: "magiclink", email: address }); assert.ifError(link.error);
  const c = createClient<Database>(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const session = await c.auth.verifyOtp({ type: "email", email: address, token: link.data.properties.email_otp }); assert.ifError(session.error);
  return { client: c, token: session.data.session!.access_token, id: session.data.user!.id };
}
function workInput(label = marker): WorkInput { return { goal: label, progress: "명시한 진행 기록", nextStep: "다음 행동을 검토한다", deadlineAt: null, reminderAt: null, deadlineReminder: false, resumeReminder: false }; }
function mutation(operation: string, input: unknown, contextId: string | null = null, revision: number | null = null, requestId = randomUUID()) {
  keep("request_ids", requestId);
  return { p_operation: operation, p_context_id: contextId, p_expected_revision: revision, p_request_id: requestId,
    p_request_hash: hash({ operation, input, contextId, revision }), p_input: input };
}
async function snapshot(id: string) { const result = await getWorkSnapshotForClient(client, id); assert.ok(result); return result; }
async function makeWork(input = workInput()) { const request = mutation("create", validateWorkInput(input)); const id = keep("work_contexts", await ok<string>("mutate_work_context", request)); return { context: (await snapshot(id)).context, request }; }
async function change(context: WorkContext, operation: "update" | "status" | "forget", input: unknown) {
  return ok<string | null>("mutate_work_context", mutation(operation, input, context.id, context.revision));
}
async function attention(id: string) { const result = await rows<Attention>(`attention_items?context_id=eq.${id}&order=created_at,id`); result.forEach(r => keep("attention_items", r.id)); return result; }
async function parkOwnedAttention() {
  for (const id of owned.get("work_contexts") ?? []) await rows(`attention_items?context_id=eq.${id}`, "PATCH", { status: "cancelled", locked_by: null, locked_until: null, quota_reserved_at: null });
  const ids = [...(owned.get("work_contexts") ?? [])];
  const foreign = await rows(`attention_items?context_id=not.in.(${ids.join(",")})&status=in.(pending,processing,failed)&due_at=lte.${encodeURIComponent(seconds(Date.now() + DAY))}&select=id&limit=1`);
  assert.equal(foreign.length, 0, "Refuse a global claim while unrelated attention could be due; never park someone else's rows");
}
async function workDraft(context: WorkContext, type: DialogueDraft["type"], payload: Parameters<typeof createDialogueDraftForOwner>[0]["payload"], extra: Record<string, string> = {}) {
  const draft = await createDialogueDraftForOwner({ ownerId, type, title: `${marker} ${type}`, explanation: "Synthetic independent work gate", payload,
    sourceSnapshot: { workContextId: context.id, contextRevision: context.revision, ...extra }, executable: true }); keep("dialogue_action_drafts", draft.id); return draft;
}
async function link(context: WorkContext, drafts: DialogueDraft[], requestId = randomUUID()) {
  keep("request_ids", requestId);
  return ok<string>("link_work_drafts", { p_context_id: context.id, p_revision: context.revision, p_request_id: requestId,
    p_request_hash: hash({ context: context.id, revision: context.revision, ids: drafts.map(d => d.id) }), p_draft_ids: drafts.map(d => d.id) });
}
async function requestApproval(draft: DialogueDraft) { return keep("approval_requests", await ok<string>("request_dialogue_approval", { p_draft_id: draft.id })); }
type Runtime = { draft: DialogueDraft; spec: HoldoutAction; approvalId?: string; mirrorId?: string; writes: number; transport?: ApprovedCalendarTransport; href?: string; uid?: string; releaseReads?: () => void };
async function materialize(context: WorkContext, spec: HoldoutAction): Promise<Runtime> {
  if (spec.type === "CREATE_TASK") return { spec, writes: 0, draft: await workDraft(context, spec.type, { title: spec.outcome === "failed" ? "" : spec.fields.title!, dueAt: spec.fields.dueAt ?? null }) };
  let object: CalendarObjectSnapshot | null = null, rejectReads = false;
  const runtime = { spec, writes: 0 } as Runtime;
  const extra: Record<string, string> = { calendarUrlHash: hash(calendarUrl) };
  let payload: CalendarActionPayload = parseCalendarActionPayload("CREATE_CALENDAR_EVENT", { version: 1, calendarId, summary: spec.fields.summary,
    startsAt: spec.fields.startsAt, endsAt: spec.fields.endsAt, timezone: "Asia/Tokyo", description: null, location: null });
  if (spec.type === "UPDATE_CALENDAR_EVENT") {
    const uid = `${randomUUID()}@personal-os`, href = `${calendarUrl}${randomUUID()}.ics`;
    const offset = spec.remoteAlreadyMatchesReviewedTarget ? 0 : 3_600_000;
    const c = ical({ name: "Synthetic work workflow" }); c.createEvent({ id: uid, summary: payload.summary,
      start: new Date(Date.parse(payload.startsAt) - offset), end: new Date(Date.parse(payload.endsAt) - offset) });
    object = { data: c.toString(), etag: '"synthetic-reviewed-v1"' };
    const event = (await rows<{ id: string; updated_at: string }>("events", "POST", { calendar_id: calendarId, caldav_uid: uid, caldav_href: href, etag: object.etag,
      summary: payload.summary, starts_at: seconds(Date.parse(payload.startsAt) - offset), ends_at: seconds(Date.parse(payload.endsAt) - offset), source: "app" }))[0]; keep("events", event.id);
    runtime.mirrorId = event.id; runtime.href = href; runtime.uid = uid;
    extra.eventUpdatedAt = event.updated_at; extra.eventHrefHash = hash(href);
    payload = parseCalendarActionPayload(spec.type, { ...payload, eventId: event.id, expectedUid: uid, expectedEtag: object.etag, beforeSnapshotHash: hashCalendarSnapshot(object.data) });
    if (spec.outcome === "conflict") object = { ...object, etag: '"external-change"' };
  }
  runtime.draft = await workDraft(context, spec.type, payload, extra);
  runtime.releaseReads = () => { rejectReads = false; };
  runtime.transport = {
    configuredCalendarName: process.env.APP_CALENDAR_NAME ?? "Personal OS",
    async listCalendars() { return spec.outcome === "failed" ? [] : [{ url: calendarUrl, displayName: process.env.APP_CALENDAR_NAME ?? "Personal OS" }]; },
    async read(base, href) { assert.equal(base, calendarUrl); assert.equal(href, runtime.href); if (rejectReads) throw new Error("Synthetic post-write read failure"); return object; },
    async create(base, filename, data) { assert.equal(new URL(filename, base).href, runtime.href); runtime.writes++; if (object) return { status: 412 };
      object = { data, etag: '"created"' }; rejectReads = spec.outcome === "uncertain" || spec.priorOutcome === "uncertain";
      if (spec.transportOutcome === "write_response_lost") throw new Error("Synthetic lost response"); return { status: 201 }; },
    async update(href, data, etag) { assert.equal(href, runtime.href); runtime.writes++; if (object?.etag !== etag) return { status: 412 };
      object = { data, etag: '"updated"' }; rejectReads = spec.outcome === "uncertain" || spec.priorOutcome === "uncertain"; return { status: 204 }; },
  };
  return runtime;
}
async function execute(runtime: Runtime) {
  const id = runtime.approvalId!; const worker = `${marker}-${randomUUID()}`;
  if (runtime.spec.type === "CREATE_TASK") {
    const result = await executeApprovedActionById(id, worker);
    if (runtime.spec.outcome === "verified") assert.equal(result.kind, "executed", JSON.stringify(result));
    if (result.kind === "executed") runtime.writes++;
    return;
  }
  runtime.uid ??= calendarUidForApproval(id); runtime.href ??= new URL(calendarFilenameForApproval(id), calendarUrl).href;
  const claimed = await claimApprovedActionByIdForJob(id, worker); assert.ok(claimed);
  const outcome = await executeCalendarForApprovalForJob(claimed, worker, runtime.transport);
  if (runtime.spec.priorOutcome === "uncertain") {
    assert.equal(outcome.kind, "uncertain"); runtime.releaseReads!();
    const recoverWorker = randomUUID(); const receipt = await ok<{ claim_token: string }>("claim_calendar_reconciliation", { p_approval_id: id, p_owner_id: ownerId, p_worker_id: recoverWorker }, service);
    const observed = await readApprovedCalendarTarget(calendarUrl, runtime.href, runtime.transport);
    await ok("finish_calendar_execution", { p_approval_id: id, p_worker_id: recoverWorker, p_claim_token: receipt.claim_token,
      p_proof: { uid: observed.uid, href: runtime.href, etag: observed.etag, event: observed.parsedEvent } }, service);
  }
}

describe("G7 local ownership, restore, attention and workflow projection", { concurrency: false }, () => {
  before(async () => {
    assert.equal(process.env.GATE_ISOLATED_DB, "1"); assert.equal(url, "http://127.0.0.1:54721");
    assert.equal(process.env.ALLOWED_EMAIL, "phase5a@example.test"); assert.ok(anon && service);
    assert.equal(hash(holdoutRaw), "da2f013cdf196030de27bc7cab2ffe2d1731fe783b508fee5f2066728b012982", "Holdout must remain frozen"); guarded = true;
    const a = await login(process.env.ALLOWED_EMAIL!); ownerId = a.id; token = a.token; client = a.client;
    secondClient = (await login(process.env.ALLOWED_EMAIL!)).client;
    const other = await login(`${marker}@example.test`); otherId = other.id; otherToken = other.token;
    assert.equal((await rows("calendars?is_writable=eq.true&select=id")).length, 0, "Use a free local fixture stack; do not change unrelated calendars");
    calendarId = keep("calendars", (await rows("calendars", "POST", { kind: "caldav", source_url: calendarUrl, is_writable: true, display_name: process.env.APP_CALENDAR_NAME ?? "Personal OS" }))[0].id);
    subscriptionId = keep("push_subscriptions", (await rows("push_subscriptions", "POST", { endpoint: `https://push.example.test/${marker}`, p256dh: "synthetic-not-a-real-key", auth: "synthetic-not-a-real-auth" }))[0].id);
    process.env.JARVIS_CALENDAR_ACTIONS_ENABLED = "true";
    process.env.JARVIS_CONTEXT_ENABLED = "true";
  });
  after(async () => {
    if (!guarded) return;
    try {
      for (const id of owned.get("work_contexts") ?? []) {
        (await attention(id)).forEach(a => keep("attention_items", a.id));
        for (const a of await rows(`work_context_actions?context_id=eq.${id}&select=id`)) keep("work_context_actions", a.id);
      }
      for (const id of owned.get("attention_items") ?? []) await rows(`notification_deliveries?attention_id=eq.${id}`, "DELETE");
      for (const id of owned.get("dialogue_action_drafts") ?? []) {
        const row = (await rows<{ approval_request_id: string | null }>(`dialogue_action_drafts?id=eq.${id}&select=approval_request_id`))[0];
        if (row?.approval_request_id) keep("approval_requests", row.approval_request_id);
        for (const event of await rows(`system_events?source_type=eq.dialogue_draft&source_id=eq.${id}&select=id`)) keep("system_events", event.id);
      }
      for (const id of owned.get("system_events") ?? []) for (const run of await rows(`agent_runs?trigger_event_id=eq.${id}&select=id`)) keep("agent_runs", run.id);
      for (const id of owned.get("approval_requests") ?? []) {
        await rows(`calendar_execution_receipts?approval_id=eq.${id}`, "DELETE"); await rows(`action_audit_logs?approval_request_id=eq.${id}`, "DELETE");
        for (const task of await rows(`tasks?approval_request_id=eq.${id}&select=id`)) keep("tasks", task.id);
      }
      for (const id of owned.get("work_contexts") ?? []) await rows(`work_context_requests?context_id=eq.${id}`, "DELETE");
      for (const id of owned.get("request_ids") ?? []) await rows(`work_context_requests?owner_id=eq.${ownerId}&request_id=eq.${id}`, "DELETE");
      if (calendarId) for (const event of await rows(`events?calendar_id=eq.${calendarId}&select=id`)) keep("events", event.id);
      for (const table of ["work_context_actions", "attention_items", "dialogue_action_drafts", "tasks", "approval_requests", "agent_runs", "system_events", "events", "calendars", "push_subscriptions", "work_contexts"]) {
        for (const id of owned.get(table) ?? []) await rows(`${table}?id=eq.${id}`, "DELETE");
      }
    } finally {
      if (originalCalendarFlag === undefined) delete process.env.JARVIS_CALENDAR_ACTIONS_ENABLED; else process.env.JARVIS_CALENDAR_ACTIONS_ENABLED = originalCalendarFlag;
      if (originalWorkFlag === undefined) delete process.env.JARVIS_CONTEXT_ENABLED; else process.env.JARVIS_CONTEXT_ENABLED = originalWorkFlag;
      if (otherId) assert.ifError((await createClient(url, service).auth.admin.deleteUser(otherId)).error);
    }
  });

  it("owner RLS and RPC-only mutation protect all work tables", async () => {
    const { context } = await makeWork();
    for (const table of ["work_contexts", "work_context_requests", "work_context_actions", "attention_items", "notification_deliveries"]) for (const key of [anon, otherToken]) {
      const r = await rest<unknown[]>(`${table}?select=*`, "GET", undefined, key);
      assert.ok([401, 403].includes(r.status) || (r.ok && r.data.length === 0), table);
    }
    for (const key of [anon, otherToken, service]) assert.ok([401, 403].includes((await rpc("mutate_work_context", mutation("create", workInput()), key)).status));
    assert.equal(await ok("get_work_snapshot", { p_context_id: context.id }, otherToken), null);
    assert.equal((await rest(`work_contexts?id=eq.${context.id}`, "PATCH", { progress: "forged" }, token)).status, 403);
    for (const key of [anon, token, otherToken]) assert.ok([401, 403].includes((await rpc("claim_work_attention", { p_worker_id: "untrusted", p_allow_automatic: true }, key)).status));
  });

  it("request replay deduplicates but changed content/hash cannot reuse the request ID", async () => {
    const args = mutation("create", workInput("Same request"));
    const results = await Promise.all([ok<string>("mutate_work_context", args), ok<string>("mutate_work_context", args)]);
    assert.equal(results[0], results[1]); keep("work_contexts", results[0]);
    assert.equal((await rpc("mutate_work_context", { ...args, p_input: workInput("Different content") })).ok, false);
    assert.equal((await rpc("mutate_work_context", { ...args, p_request_hash: "0".repeat(64) })).ok, false);
    assert.equal((await snapshot(results[0])).context.revision, 1);
  });

  it("concurrent revisions isolate two work contexts and accept only one same-context correction", async () => {
    const a = (await makeWork(workInput("Shared goal"))).context, b = (await makeWork(workInput("Shared goal"))).context;
    const attempts = await Promise.all(["First", "Second"].map(progress => rpc("mutate_work_context", mutation("update", { ...workInput("Shared goal"), progress }, a.id, a.revision))));
    assert.equal(attempts.filter(r => r.ok).length, 1);
    await change(b, "update", { ...workInput("Shared goal"), progress: "Other context" });
    assert.notEqual((await snapshot(a.id)).context.progress, (await snapshot(b.id)).context.progress);
    assert.equal((await snapshot(a.id)).context.revision, 2); assert.equal((await snapshot(b.id)).context.revision, 2);
  });

  it("independent 30-context holdout restores 60 exact projections through two owner sessions", async () => {
    const idMap = new Map<string, string>();
    for (const item of holdout.contexts) idMap.set(item.id, (await makeWork(item.input)).context.id);
    let restored = 0;
    for (const check of holdout.restores) {
      const data = await getWorkSnapshotForClient(check.channel === "second_device" ? secondClient : client, idMap.get(check.contextRef)!); assert.ok(data);
      for (const key of ["goal", "progress", "nextStep", "status", "deadlineReminder", "resumeReminder"] as const) assert.deepEqual(data.context[key], check.expected[key], check.id);
      for (const key of ["deadlineAt", "reminderAt"] as const) assert.equal(data.context[key] === null ? null : Date.parse(data.context[key]!), check.expected[key] === null ? null : Date.parse(check.expected[key]!), check.id);
      assert.deepEqual(data.context.missingFields, []); assert.equal(data.actions.length, 0); restored++;
    }
    assert.equal(restored, 60); console.log("Synthetic holdout: 30 contexts / 60 exact owner-session restores; not physical devices or humans");
  });

  it("forget scrubs content and cached replies; old creates/updates cannot resurrect it", async () => {
    const { context, request } = await makeWork(workInput("Sensitive synthetic memory"));
    const chatId = keep("request_ids", randomUUID());
    const reservation = await ok<{ token: string }>("reserve_work_chat", { p_owner_id: ownerId, p_context_id: context.id, p_request_id: chatId, p_hash: hash(chatId) }, service);
    await ok("finish_work_chat", { p_owner_id: ownerId, p_request_id: chatId, p_token: reservation.token, p_response: { mode: "answer", work: { goal: context.goal } } }, service);
    assert.equal(await change(context, "forget", {}), null);
    assert.equal(await getWorkSnapshotForClient(client, context.id), null);
    assert.equal(await ok("mutate_work_context", request), null);
    assert.equal((await rpc("mutate_work_context", mutation("update", workInput(), context.id, context.revision + 1))).ok, false);
    const row = (await rows<{ goal: string; progress: string; next_step: string; source_refs: unknown[]; forgotten_at: string }>(`work_contexts?id=eq.${context.id}`))[0];
    assert.equal(row.goal + row.progress + row.next_step, ""); assert.deepEqual(row.source_refs, []); assert.ok(row.forgotten_at);
    const cache = (await rows<{ response: unknown }>(`work_context_requests?request_id=eq.${chatId}&operation=eq.chat`))[0]; assert.equal(cache.response, null);
    assert.equal((await rpc("reserve_work_chat", { p_owner_id: ownerId, p_context_id: context.id, p_request_id: chatId, p_hash: hash(chatId) }, service)).ok, false);
  });

  it("expired retained work is purged without resurrecting or deleting its request ledger", async () => {
    const { context, request } = await makeWork(); await change(context, "status", { status: "completed" });
    const completed = (await snapshot(context.id)).context; assert.equal(completed.status, "completed");
    assert.ok(Date.parse(completed.expiresAt!) >= Date.now() + 29 * DAY);
    await rows(`work_contexts?id=eq.${context.id}`, "PATCH", { expires_at: seconds(Date.now() - 60_000) });
    const ids = [...owned.get("work_contexts")!];
    assert.equal((await rows(`work_contexts?id=not.in.(${ids.join(",")})&forgotten_at=is.null&expires_at=lte.${encodeURIComponent(seconds(Date.now() + DAY))}&select=id&limit=1`)).length, 0, "Refuse global prune with unrelated expiring work");
    assert.equal(await ok<number>("prune_work_contexts", {}, service), 1);
    assert.equal(await getWorkSnapshotForClient(client, context.id), null); assert.equal(await ok("mutate_work_context", request), null);
    assert.equal((await rows(`work_context_requests?context_id=eq.${context.id}&operation=eq.create`)).length, 1);
  });

  it("max three work drafts, current revision and per-action approvals remain mandatory", async () => {
    const context = (await makeWork()).context; const drafts = await Promise.all(Array.from({ length: 4 }, (_, i) => workDraft(context, "CREATE_TASK", { title: `${marker}-${i}` })));
    assert.equal((await rpc("request_dialogue_approval", { p_draft_id: drafts[0].id })).ok, false, "orphan work-stamped draft cannot enter approvals");
    assert.equal((await rpc("link_work_drafts", { p_context_id: context.id, p_revision: context.revision, p_request_id: randomUUID(), p_request_hash: hash("four"), p_draft_ids: drafts.map(d => d.id) })).ok, false);
    await link(context, drafts.slice(0, 3));
    const approval = await requestApproval(drafts[0]); await ok("decide_approval", { p_approval_id: approval, p_decision: "approved" });
    await change(context, "status", { status: "cancelled" });
    const claimed = await rpc<unknown[]>("claim_approved_action_by_id", { p_approval_id: approval, p_worker_id: marker }, service);
    assert.ok(!claimed.ok || claimed.data.length === 0, "cancelled work cannot obtain a new execution lease");
    assert.equal((await rows(`tasks?approval_request_id=eq.${approval}`)).length, 0);
    assert.equal((await rpc("request_dialogue_approval", { p_draft_id: drafts[1].id })).ok, false);
  });

  it("30 independent workflow holdout projections preserve real per-action outcomes and work status", async () => {
    let checked = 0;
    for (const flow of holdout.workflows) {
      let context = (await makeWork(holdout.contexts.find(c => c.id === flow.contextRef)!.input)).context;
      if (flow.expected.linkedSource) {
        // Existing source fixture is prior history, not a new action in this
        // workflow request. Verify the product re-reads its current state.
        const previous = await materialize(context, { id: "prior", type: "CREATE_TASK", fields: { title: `${marker} prior source`, dueAt: null }, decision: "approved", outcome: "verified" });
        await link(context, [previous.draft]); previous.approvalId = await requestApproval(previous.draft);
        await ok("decide_approval", { p_approval_id: previous.approvalId, p_decision: "approved" }); await execute(previous);
        const task = (await rows<{ id: string }>(`tasks?approval_request_id=eq.${previous.approvalId}`))[0];
        await rows(`tasks?id=eq.${task.id}`, "PATCH", { status: flow.expected.linkedSource.currentStatus, completed_at: seconds(Date.now()) });
        await change(context, "update", { ...holdout.contexts.find(c => c.id === flow.contextRef)!.input, progress: flow.expected.linkedSource.storedContextClaim });
        const refreshed = await snapshot(context.id); context = refreshed.context;
        const ref = refreshed.context.sourceRefs.find(value => value && typeof value === "object" && !Array.isArray(value) && value.kind === "task" && value.id === task.id) as { current: { status: string } } | undefined;
        assert.equal(ref?.current.status, flow.expected.linkedSource.currentStatus, flow.id);
        assert.equal(context.progress, flow.expected.linkedSource.storedContextClaim, "original observation must be distinguishable from the stored progress claim");
      }
      const actions = await Promise.all(flow.actions.map(a => materialize(context, a)));
      if (actions.length) {
        const requestId = randomUUID(); await link(context, actions.map(a => a.draft), requestId);
        for (let replay = 0; replay < (flow.expected.requestReplayCount ?? 0); replay++) await link(context, actions.map(a => a.draft), requestId);
        const linked = await snapshot(context.id);
        assert.equal(linked.actions.filter(a => actions.some(runtime => runtime.draft.id === a.draft.id)).length, actions.length);
      }
      for (const action of actions) {
        if (action.spec.outcome === "review_rejected") {
          await change(context, "update", { ...holdout.contexts.find(c => c.id === flow.contextRef)!.input, nextStep: "명시적으로 정정한 다음 행동" });
          context = (await snapshot(context.id)).context;
          assert.equal((await rpc("request_dialogue_approval", { p_draft_id: action.draft.id })).ok, false); continue;
        }
        if ((flow.expected.concurrentApprovalClients ?? 0) > 1 || flow.expected.duplicateApprovalClicks?.includes(action.spec.id)) {
          const requests = await Promise.all([requestApproval(action.draft), requestApproval(action.draft)]);
          assert.equal(requests[0], requests[1]); action.approvalId = requests[0];
        } else action.approvalId = await requestApproval(action.draft);
        if (action.spec.decision === "pending") continue;
        if (action.spec.decision === "expired") { await rows(`approval_requests?id=eq.${action.approvalId}`, "PATCH", { expires_at: seconds(Date.now() - 1000) }); continue; }
        if ((flow.expected.concurrentApprovalClients ?? 0) > 1) {
          const decisions = await Promise.all([rpc("decide_approval", { p_approval_id: action.approvalId, p_decision: action.spec.decision }), rpc("decide_approval", { p_approval_id: action.approvalId, p_decision: action.spec.decision })]);
          assert.equal(decisions.filter(r => r.ok).length, 1, "concurrent decisions must record exactly one transition");
        } else await ok("decide_approval", { p_approval_id: action.approvalId, p_decision: action.spec.decision });
        if (action.spec.decision === "approved") await execute(action);
        if (action.spec.outcome === "verified" && (flow.expected.duplicateApprovalClicks?.includes(action.spec.id) || (flow.expected.concurrentApprovalClients ?? 0) > 1)) {
          assert.equal(await claimApprovedActionByIdForJob(action.approvalId, randomUUID()), null, "replay cannot obtain another execution lease");
        }
      }
      let result = await snapshot(context.id);
      const statusOf = (action: Runtime) => result.actions.find(a => a.draft.id === action.draft.id)!.status;
      assert.deepEqual(actions.filter(a => statusOf(a) === "executed").map(a => a.spec.id), flow.expected.verifiedActionIds, flow.id);
      assert.deepEqual(actions.filter(a => statusOf(a) === "pending").map(a => a.spec.id), flow.expected.pendingApprovalActionIds, flow.id);
      assert.deepEqual(actions.filter(a => {
        const data = result.actions.find(item => item.draft.id === a.draft.id)!;
        return data.result && typeof data.result === "object" && !Array.isArray(data.result) && data.result.calendarState === "uncertain";
      }).map(a => a.spec.id), flow.expected.uncertainActionIds, flow.id);
      assert.equal(new Set(actions.flatMap(a => a.approvalId ? [a.approvalId] : [])).size, actions.filter(a => a.approvalId).length, "each action needs its own approval identity");
      for (const action of actions) {
        const status = statusOf(action); const data = result.actions.find(a => a.draft.id === action.draft.id)!;
        if (action.spec.outcome === "uncertain") { assert.equal(status, "failed", flow.id); assert.equal((data.result as { calendarState: string }).calendarState, "uncertain"); }
        if (action.spec.outcome === "failed" || action.spec.outcome === "conflict") assert.equal(status, "failed", flow.id);
        if (action.spec.outcome === "review_rejected") assert.equal(status, "stale", flow.id);
        if (action.spec.decision === "expired") assert.equal(status, "expired", flow.id);
        if (action.spec.decision === "rejected") assert.equal(status, "rejected", flow.id);
        if (action.spec.decision !== "approved") assert.equal(action.writes, 0, flow.id);
        if (action.spec.outcome === "conflict") assert.equal((data.result as { calendarState: string }).calendarState, "conflict", flow.id);
      }
      assert.equal(actions.reduce((sum, a) => sum + a.writes, 0), flow.expected.confirmedEffectCount + flow.expected.uncertainActionIds.length, flow.id);
      assert.equal(result.context.status, "active", "action success never implicitly completes the work");
      if (flow.expected.maximumUniqueEffects !== undefined) assert.ok(actions.reduce((sum, action) => sum + action.writes, 0) <= flow.expected.maximumUniqueEffects);
      if (flow.expected.nextStepMustRemain) assert.equal(result.context.nextStep, flow.expected.nextStepMustRemain);
      if (flow.expected.ignoreUnverifiedAssistantClaim) {
        const fabricated = { operation: "status", goal: null, progress: null, nextStep: null, deadline: null, reminder: null, deadlineReminder: null, resumeReminder: null, status: "completed", actions: [] };
        assert.equal(groundWorkIntent(fabricated, [{ role: "assistant", content: flow.expected.ignoreUnverifiedAssistantClaim }, { role: "user", content: "업무 진행 상태를 보여줘" }], result.context, new Date()).operation, "clarify");
      }
      if (flow.expected.explicitUserStatusCommand) { await change(result.context, "status", { status: flow.expected.explicitUserStatusCommand }); result = await snapshot(context.id); assert.equal(result.context.status, flow.expected.workStatus); }
      if (flow.expected.explicitUserMemoryCommand === "forget") {
        const existingTaskIds = result.actions.flatMap(a => a.result && typeof a.result === "object" && !Array.isArray(a.result) && typeof a.result.taskId === "string" ? [a.result.taskId] : []);
        await change(result.context, "forget", {}); assert.equal(await getWorkSnapshotForClient(client, context.id), null);
        for (const id of existingTaskIds) assert.equal((await rows(`tasks?id=eq.${id}`)).length, 1, "forgetting cannot delete confirmed task effects");
        for (const action of actions) if (action.approvalId) assert.ok((await rows(`action_audit_logs?approval_request_id=eq.${action.approvalId}`)).length > 0, "forgetting cannot erase action audit history");
      }
      checked++;
    }
    assert.equal(checked, 30); console.log("30 synthetic workflow DB projections verified; mock calendar outcomes, not 30 human/browser conversations");
  });

  it("attention outbox timestamps deduplicate and changed conditions cancel obsolete items", async () => {
    const input = { ...workInput(), deadlineAt: seconds(Date.now() + 2 * DAY), reminderAt: seconds(Date.now() + 3_600_000), deadlineReminder: true, resumeReminder: true };
    let context = (await makeWork(input)).context; const first = await attention(context.id); assert.equal(first.length, 3);
    assert.equal(Date.parse(first.find(a => a.kind === "deadline")!.due_at), Date.parse(input.deadlineAt) - DAY);
    assert.equal(Date.parse(first.find(a => a.kind === "resume")!.due_at), Date.parse(context.lastProgressAt) + 2 * DAY);
    await change(context, "update", { ...input, nextStep: "새로 명시한 다음 행동" }); context = (await snapshot(context.id)).context;
    const stable = await attention(context.id); assert.deepEqual(stable.map(a => a.id).sort(), first.map(a => a.id).sort());
    await change(context, "update", { ...input, reminderAt: seconds(Date.now() + 7_200_000) });
    const changed = await attention(context.id); assert.equal(changed.find(a => a.id === first.find(a => a.kind === "explicit")!.id)!.status, "cancelled");
    assert.equal(changed.filter(a => a.kind === "explicit" && a.status === "pending").length, 1);
  });

  it("delivery claim, provider acceptance, client receipt/open and acknowledgment are distinct", async () => {
    await parkOwnedAttention(); const { context } = await makeWork({ ...workInput(), reminderAt: seconds(Date.now() - 60_000) });
    const target = (await attention(context.id))[0]; const workers = [randomUUID(), randomUUID()];
    const claims = await Promise.all(workers.map(worker => ok<Claim | null>("claim_work_attention", { p_worker_id: worker }, service)));
    assert.equal(claims.filter(Boolean).length, 1); const worker = workers[claims.findIndex(Boolean)]; assert.equal(claims.find(Boolean)!.id, target.id);
    const args = { p_attention_id: target.id, p_worker_id: worker, p_subscription_id: subscriptionId };
    const attempts = await Promise.all([ok<Delivery | null>("begin_work_delivery", args, service), ok<Delivery | null>("begin_work_delivery", args, service)]);
    assert.equal(attempts.filter(Boolean).length, 1); const delivery = attempts.find(Boolean)!;
    await ok("finish_work_delivery", { p_delivery_id: delivery.deliveryId, p_worker_id: worker, p_attempt_token: delivery.attemptToken, p_status: "accepted" }, service);
    const state = (await rows<{ received_at: string | null; opened_at: string | null }>(`notification_deliveries?id=eq.${delivery.deliveryId}`))[0]; assert.equal(state.received_at, null); assert.equal(state.opened_at, null);
    assert.equal(await ok("begin_work_delivery", args, service), null);
    await ok("finish_work_attention", { p_attention_id: target.id, p_worker_id: worker, p_status: "ready" }, service);
    assert.equal((await rpc("ack_work_delivery", { p_delivery_id: delivery.deliveryId, p_event: "opened" }, otherToken)).status, 403);
    await ok("ack_work_delivery", { p_delivery_id: delivery.deliveryId, p_event: "received" }); await ok("ack_work_delivery", { p_delivery_id: delivery.deliveryId, p_event: "opened" });
    await ok("mutate_work_attention", { p_attention_id: target.id, p_operation: "ack" });
    assert.equal((await attention(context.id))[0].status, "acknowledged");
    assert.equal(await ok("claim_work_attention", { p_worker_id: "replay" }, service), null);
  });

  it("cancel before delivery prevents sending, and tomorrow snooze preserves original JST time", async () => {
    await parkOwnedAttention(); let context = (await makeWork({ ...workInput(), reminderAt: seconds(Date.now() - 60_000) })).context;
    const claimed = await ok<Claim>("claim_work_attention", { p_worker_id: marker }, service); assert.equal(claimed.contextId, context.id);
    await change(context, "status", { status: "cancelled" });
    assert.equal(await ok("begin_work_delivery", { p_attention_id: claimed.id, p_worker_id: marker, p_subscription_id: subscriptionId }, service), null);
    context = (await makeWork({ ...workInput(), reminderAt: seconds(Date.now() - 600_000) })).context; const item = (await attention(context.id))[0];
    await ok("mutate_work_attention", { p_attention_id: item.id, p_operation: "tomorrow" });
    const refreshed = (await snapshot(context.id)).context;
    assert.equal(new Date(Date.parse(refreshed.reminderAt!) + 9 * 3_600_000).toISOString().slice(11), new Date(Date.parse(item.due_at) + 9 * 3_600_000).toISOString().slice(11));
    assert.equal((await attention(context.id)).find(a => a.id === item.id)!.status, "cancelled");
  });

  it("automatic policy is opt-in, quiet/capped, while explicit time reminders are exempt", async (t) => {
    await parkOwnedAttention();
    const quietNow = new Date("2026-09-08T13:00:00Z"); const due = "2026-09-08T13:00:00.000Z";
    const c = (await makeWork({ ...workInput(), reminderAt: due, deadlineAt: "2026-09-09T20:00:00Z", deadlineReminder: true })).context;
    assert.equal(canSendWorkAttention({ context: c, kind: "explicit", dueAt: due, now: quietNow, automaticSentToday: 3 }), true);
    assert.equal(canSendWorkAttention({ context: c, kind: "deadline", dueAt: due, now: quietNow, automaticSentToday: 0 }), false);
    await parkOwnedAttention();
    for (let i = 0; i < 4; i++) await makeWork({ ...workInput(`Automatic ${i}`), deadlineAt: seconds(Date.now() + 12 * 3_600_000), deadlineReminder: true });
    assert.equal(await ok("claim_work_attention", { p_worker_id: "automatic-off" }, service), null);
    const hour = new Date(Date.now() + 9 * 3_600_000).getUTCHours();
    if (hour < 8 || hour >= 22) {
      assert.equal(await ok("claim_work_attention", { p_worker_id: "quiet", p_allow_automatic: true }, service), null);
      t.diagnostic("Actual DB quiet-hour branch verified; daytime cap needs a daytime run, not a fabricated clock");
    } else {
      for (let i = 0; i < 3; i++) { const a = await ok<Claim>("claim_work_attention", { p_worker_id: `cap-${i}`, p_allow_automatic: true }, service); assert.ok(a); await ok("finish_work_attention", { p_attention_id: a.id, p_worker_id: `cap-${i}`, p_status: "ready" }, service); }
      assert.equal(await ok("claim_work_attention", { p_worker_id: "capped", p_allow_automatic: true }, service), null);
      t.diagnostic("Actual DB daily condition cap=3 verified; quiet-hour boundaries separately exercised in pure policy");
    }
    const explicit = (await makeWork({ ...workInput("Explicit exception"), reminderAt: seconds(Date.now() - 60_000) })).context;
    const claimed = await ok<Claim>("claim_work_attention", { p_worker_id: "explicit-exception", p_allow_automatic: true }, service); assert.equal(claimed.contextId, explicit.id);
  });

  it("seven-day scheduler accuracy and human conversation completion require actual separate observation", (t) => {
    t.skip("No seven-day elapsed period, Push device receipt, human usefulness or 30 browser conversations is established by synthetic local DB projections");
  });
});
