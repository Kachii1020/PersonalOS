/** Actual local DB/RLS and proposal flow; injected interpretation, no AI/CalDAV. */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/types/database";
import type { DialogueIntent, DialogueDraft, ChatMessage, DialogueFact } from "../../lib/jarvis/dialogue-types";
import type { JsonValue } from "../../lib/jarvis/types";
import { answerDialogue, createDialogueDraftForOwner, readDialogueSnapshot } from "../../lib/repos/jarvis-dialogue";
import { parseCalendarActionPayload } from "../../lib/jarvis/calendar-action-payload";
import { executeApprovedActionById } from "../../lib/jarvis/executor";
import { buildDialoguePrompt } from "../../lib/ai/prompts/dialogue";
import { BudgetExceededError } from "../../lib/ai/budget";

config({ path: [".env.development.local", ".env.local"], quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const marker = `g6a-${randomUUID()}`;
const DAY = 86_400_000;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type Table<K extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][K]["Row"];
const owned = new Map<string, Set<string>>();
const remember = (table: string, id: string) => {
  if (!owned.has(table)) owned.set(table, new Set());
  owned.get(table)!.add(id); return id;
};
let token = "", otherToken = "", ownerId = "", otherId = "";
let client: SupabaseClient<Database>;
let guarded = false;
let profileBefore: Table<"career_profile"> | undefined;
let calendar: Table<"calendars">;
let event: Table<"events">;
let privateTaskId = "";
const privateFacts = `${marker}-PRIVATE-PROFILE`;
const privateDescription = `${marker}-PRIVATE-EVENT-DESCRIPTION`;
const privateNotes = `${marker}-PRIVATE-TASK-NOTES`;
const privateUrl = `https://example.invalid/${marker}/private-calendar-path/`;
const intent = (patch: Partial<DialogueIntent> = {}): DialogueIntent => ({ kind: "read_tasks", sourceId: null, title: null, date: null, time: null, duration: null, ...patch });
const quote = (text: string) => ({ messageIndex: 0, text });
const owner = () => ({ client, ownerId });

async function rest<T = unknown>(path: string, method = "GET", body?: unknown, key = service) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method, headers: { apikey: key === service ? service : anon, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, data: (text ? JSON.parse(text) : null) as T };
}
async function rows<T = { id: string }>(path: string, method = "GET", body?: unknown, key = service): Promise<T[]> {
  const result = await rest<T[]>(path, method, body, key);
  assert.ok(result.ok, `${path}: ${result.status} ${JSON.stringify(result.data)}`);
  return result.data ?? [];
}
async function rpc<T = unknown>(name: string, body: unknown, key = token) {
  return rest<T>(`rpc/${name}`, "POST", body, key);
}
async function login(address: string) {
  const auth = createClient(url, service, { auth: { persistSession: false } });
  const result = await auth.auth.admin.generateLink({ type: "magiclink", email: address });
  assert.ifError(result.error);
  const verified = await createClient(url, anon, { auth: { persistSession: false } }).auth.verifyOtp({ type: "email", email: address, token: result.data.properties.email_otp });
  assert.ifError(verified.error);
  return { token: verified.data.session!.access_token, id: verified.data.user!.id };
}
async function taskDraft(title = `${marker} task`, executable = true, forOwner = ownerId) {
  const draft = await createDialogueDraftForOwner({ ownerId: forOwner, type: "CREATE_TASK", title,
    explanation: "Synthetic owner-reviewed proposal", payload: { title }, sourceSnapshot: { requestHash: hash(title) }, executable });
  remember("dialogue_action_drafts", draft.id); return draft;
}
async function request(draft: DialogueDraft) {
  const result = await rpc<string>("request_dialogue_approval", { p_draft_id: draft.id });
  assert.ok(result.ok, JSON.stringify(result));
  remember("approval_requests", result.data); return result.data;
}
async function ageDraft(draft: DialogueDraft, hours: number) {
  await rows(`dialogue_action_drafts?id=eq.${draft.id}`, "PATCH", {
    created_at: new Date(Date.now() - hours * 3_600_000 - 600_000).toISOString(),
    expires_at: new Date(Date.now() - hours * 3_600_000).toISOString(),
  });
}
function calendarPayload() {
  return parseCalendarActionPayload("UPDATE_CALENDAR_EVENT", { version: 1, calendarId: calendar.id,
    summary: event.summary, startsAt: event.starts_at, endsAt: event.ends_at, timezone: "Asia/Tokyo",
    description: null, location: null, eventId: event.id, expectedUid: event.caldav_uid,
    expectedEtag: event.etag, beforeSnapshotHash: hash(JSON.stringify({ id: event.id, updatedAt: event.updated_at, etag: event.etag })) });
}
async function calendarDraft(payloadPatch: Record<string, JsonValue> = {}, snapshotPatch: Record<string, JsonValue> = {}) {
  const draft = await createDialogueDraftForOwner({ ownerId, type: "UPDATE_CALENDAR_EVENT", title: "Synthetic calendar proposal",
    explanation: "SQL guard fixture only; never passed to a calendar executor", payload: { ...calendarPayload(), ...payloadPatch },
    sourceSnapshot: { calendarUrlHash: hash(calendar.source_url), eventUpdatedAt: event.updated_at, ...snapshotPatch }, executable: true });
  remember("dialogue_action_drafts", draft.id); return draft;
}
async function draftIds() { return rows(`dialogue_action_drafts?owner_id=eq.${ownerId}&select=id&order=id`); }

describe("G6A real local DB gate (no model or CalDAV network)", { concurrency: false }, () => {
  before(async () => {
    assert.equal(process.env.GATE_ISOLATED_DB, "1");
    assert.ok(["http://127.0.0.1:54621", "http://127.0.0.1:54721"].includes(url), "Only the dedicated G6/evaluation stacks are permitted");
    assert.equal(process.env.ALLOWED_EMAIL, "phase5a@example.test");
    assert.ok(anon && service); guarded = true;
    const auth = await login(process.env.ALLOWED_EMAIL!); token = auth.token; ownerId = auth.id;
    const other = await login(`${marker}@example.test`); otherToken = other.token; otherId = other.id;
    client = createClient<Database>(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    profileBefore = (await rows<Table<"career_profile">>("career_profile?singleton=eq.true"))[0];
    assert.ok(profileBefore);
    await rows("career_profile?singleton=eq.true", "PATCH", { facts: { degree: { value: privateFacts,
      verifiedAt: new Date(Date.now() - DAY).toISOString(), reviewAt: new Date(Date.now() + DAY).toISOString(), source: "Synthetic privacy sentinel" } } });
    assert.equal((await rows("calendars?is_writable=eq.true&select=id")).length, 0,
      "The dedicated gate requires no existing writable calendar; do not alter unrelated calendars");
    calendar = (await rows<Table<"calendars">>("calendars", "POST", { kind: "caldav", source_url: privateUrl,
      display_name: process.env.APP_CALENDAR_NAME ?? "Personal OS", is_writable: true, last_synced_at: new Date().toISOString() }))[0];
    remember("calendars", calendar.id);
    const start = Math.floor((Date.now() + 3_600_000) / 1000) * 1000;
    event = (await rows<Table<"events">>("events", "POST", { calendar_id: calendar.id, caldav_uid: `${marker}@personal-os`,
      caldav_href: `${privateUrl}private-object.ics`, etag: '"g6a-etag"', summary: `${marker} meeting`, description: privateDescription,
      location: `${marker}-PRIVATE-LOCATION`, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 3_600_000).toISOString(), source: "app" }))[0];
    remember("events", event.id);
    privateTaskId = remember("tasks", (await rows("tasks", "POST", { title: `${marker} known task`, notes: privateNotes, due_at: new Date(start).toISOString() }))[0].id);
  });

  after(async () => {
    if (!guarded) return;
    try {
      for (const id of owned.get("dialogue_action_drafts") ?? []) {
        const drafts = await rows<Table<"dialogue_action_drafts">>(`dialogue_action_drafts?id=eq.${id}`);
        if (drafts[0]?.approval_request_id) remember("approval_requests", drafts[0].approval_request_id);
        for (const row of await rows(`system_events?source_id=eq.${id}&source_type=eq.dialogue_draft&select=id`)) remember("system_events", row.id);
      }
      for (const id of owned.get("system_events") ?? []) for (const row of await rows(`agent_runs?trigger_event_id=eq.${id}&select=id`)) remember("agent_runs", row.id);
      for (const id of owned.get("approval_requests") ?? []) {
        for (const row of await rows(`tasks?approval_request_id=eq.${id}&select=id`)) remember("tasks", row.id);
        await rows(`action_audit_logs?approval_request_id=eq.${id}`, "DELETE");
      }
      for (const table of ["dialogue_action_drafts", "tasks", "approval_requests", "agent_runs", "system_events", "events", "calendars"]) {
        for (const id of owned.get(table) ?? []) await rows(`${table}?id=eq.${id}`, "DELETE");
      }
    } finally {
      if (profileBefore) {
        await rows("career_profile?singleton=eq.true", "PATCH", profileBefore);
        assert.deepEqual((await rows<Table<"career_profile">>("career_profile?singleton=eq.true"))[0], profileBefore);
      }
      if (otherId) assert.ifError((await createClient(url, service).auth.admin.deleteUser(otherId)).error);
    }
  });

  it("owner-scoped draft RLS and RPC permissions reject anon, other owners, and direct writes", async () => {
    const mine = await taskDraft(); const theirs = await taskDraft("Other owner's synthetic draft", true, otherId);
    assert.equal((await rows(`dialogue_action_drafts?id=eq.${mine.id}`, "GET", undefined, token)).length, 1);
    assert.equal((await rows(`dialogue_action_drafts?id=eq.${theirs.id}`, "GET", undefined, token)).length, 0);
    for (const key of [anon, otherToken]) {
      const read = await rest<unknown[]>(`dialogue_action_drafts?id=eq.${mine.id}`, "GET", undefined, key);
      assert.ok([401, 403].includes(read.status) || (read.ok && read.data.length === 0));
      assert.ok([401, 403].includes((await rpc("request_dialogue_approval", { p_draft_id: mine.id }, key)).status));
    }
    assert.equal((await rpc("request_dialogue_approval", { p_draft_id: theirs.id }, token)).status, 403);
    assert.equal((await rest(`dialogue_action_drafts?id=eq.${mine.id}`, "PATCH", { executable: true, payload: { title: "forged" } }, token)).status, 403);
    assert.equal((await rest("dialogue_action_drafts", "POST", { owner_id: ownerId, action_type: "CREATE_TASK", title: "forged", explanation: "", payload: {}, executable: true }, token)).status, 403);
    assert.equal((await rpc("request_dialogue_approval", { p_draft_id: mine.id }, service)).status, 403);
    for (const key of [anon, token, otherToken]) assert.ok([401, 403].includes((await rpc("prune_dialogue_drafts", {}, key)).status));
  });

  it("actual owner records ground answers while private profile/event/task data stay out of model context", async () => {
    const snapshot = await readDialogueSnapshot(client, new Date());
    assert.ok(snapshot.taskFacts.some((fact) => fact.id === `task:${privateTaskId}`));
    assert.ok(snapshot.eventFacts.some((fact) => fact.id === `event:${event.id}`));
    let captured: { messages: ChatMessage[]; sources: DialogueFact[]; now: Date } | undefined;
    const reply = await answerDialogue({ messages: [{ role: "user", content: "할 일 목록 보여줘" }] }, {
      owner: owner(), interpret: async (messages, sources, now) => { captured = { messages, sources, now }; return intent(); },
    });
    assert.equal(reply.mode, "answer"); assert.equal(reply.draft, null);
    assert.ok(reply.facts.some((fact) => fact.id === `task:${privateTaskId}` && fact.href === "/tasks"));
    assert.ok(captured);
    const prompt = buildDialoguePrompt(captured.messages, captured.sources, captured.now);
    for (const secret of [privateFacts, privateDescription, privateNotes, privateUrl, service, token]) assert.equal(prompt.includes(secret), false);
    assert.ok(reply.facts.every((fact) => snapshot.taskFacts.some((source) => source.id === fact.id && source.title === fact.title)));
    assert.match(reply.message, new RegExp(String(snapshot.taskCount)));
    const calendarReply = await answerDialogue({ messages: [{ role: "user", content: "현재 일정 보여줘" }] }, {
      owner: owner(), interpret: async () => intent({ kind: "read_calendar" }),
    });
    assert.ok(calendarReply.facts.some((fact) => fact.id === `event:${event.id}`));
    assert.equal(JSON.stringify(calendarReply).includes(privateDescription), false);
  });

  it("unknown references, invented quotes, ambiguous times and unsupported zones produce no draft", async () => {
    const beforeIds = await draftIds();
    const base = intent({ kind: "create_calendar", title: quote("영어 공부"), date: quote("내일"), time: quote("오후 3시"), duration: quote("1시간") });
    for (const content of ["내일 오후 3시나 오후 4시에 영어 공부 1시간 일정 추가해", "내일 오후 3시 중국 시간 기준 영어 공부 1시간 일정 추가해"]) {
      const reply = await answerDialogue({ messages: [{ role: "user", content }] }, { owner: owner(), interpret: async () => base });
      assert.equal(reply.mode, "clarify"); assert.equal(reply.draft, null);
    }
    const unknown = await answerDialogue({ messages: [{ role: "user", content: "일정 변경해" }] }, { owner: owner(), interpret: async () => intent({ kind: "update_calendar", sourceId: "event:unknown" }) });
    assert.equal(unknown.mode, "clarify");
    const invented = await answerDialogue({ messages: [{ role: "user", content: "할 일 추가해" }] }, { owner: owner(), interpret: async () => intent({ kind: "create_task", title: quote("invented title") }) });
    assert.equal(invented.mode, "clarify");
    await assert.rejects(answerDialogue({ messages: [{ role: "user", content: "Send something" }] }, { owner: owner(), interpret: async () => ({ ...intent(), kind: "send_email" } as unknown as DialogueIntent) }));
    assert.deepEqual(await draftIds(), beforeIds);
  });

  it("grounded task draft creates one pending approval under concurrent clicks, then one task after approval", async () => {
    const title = `${marker} prepare outline`;
    const userMessage = `${title} 할 일 추가해; ${marker}-RAW-CHAT-DO-NOT-STORE`;
    const reply = await answerDialogue({ messages: [{ role: "user", content: userMessage }] }, {
      owner: owner(), interpret: async () => intent({ kind: "create_task", title: quote(title) }),
    });
    assert.equal(reply.mode, "propose"); assert.ok(reply.draft); assert.equal(reply.draft.canRequestApproval, true);
    const draft = reply.draft; remember("dialogue_action_drafts", draft.id);
    const stored = (await rows<Table<"dialogue_action_drafts">>(`dialogue_action_drafts?id=eq.${draft.id}`))[0];
    assert.equal(JSON.stringify(stored).includes(`${marker}-RAW-CHAT-DO-NOT-STORE`), false);
    assert.deepEqual(Object.keys(stored.source_snapshot as object).sort(), ["fieldEvidence", "observedAt", "requestHash", "targetOrigin", "timezone"]);
    const provenance = stored.source_snapshot as { fieldEvidence: unknown; observedAt: string; requestHash: string; targetOrigin: string; timezone: string };
    assert.deepEqual(provenance.fieldEvidence, [{ messageIndex: 0, text: title }], "retain only the explicitly quoted title, not the complete user message");
    assert.equal(provenance.targetOrigin, "new_user_request");
    assert.equal(provenance.timezone, "Asia/Tokyo");
    assert.equal(provenance.requestHash, hash(userMessage));
    assert.equal(provenance.observedAt, reply.observedAt);
    const requested = await Promise.all([1, 2].map(() => rpc<string>("request_dialogue_approval", { p_draft_id: draft.id })));
    assert.ok(requested.every((result) => result.ok), JSON.stringify(requested));
    assert.equal(requested[0].data, requested[1].data);
    const approvalId = remember("approval_requests", requested[0].data);
    const approvals = await rows<Table<"approval_requests">>(`approval_requests?id=eq.${approvalId}`);
    assert.equal(approvals[0].status, "pending"); assert.deepEqual(approvals[0].payload, stored.payload);
    const events = await rows<Table<"system_events">>(`system_events?source_id=eq.${draft.id}&source_type=eq.dialogue_draft`);
    assert.equal(events.length, 1); assert.equal(events[0].status, "processed");
    const runs = await rows<Table<"agent_runs">>(`agent_runs?trigger_event_id=eq.${events[0].id}`);
    assert.equal(runs.length, 1); assert.equal(runs[0].status, "waiting_approval");
    assert.deepEqual((await rows<Table<"action_audit_logs">>(`action_audit_logs?approval_request_id=eq.${approvalId}&order=id`)).map((row) => row.event), ["requested"]);
    assert.equal((await executeApprovedActionById(approvalId, "not-approved")).kind, "idle");
    assert.equal((await rows(`tasks?approval_request_id=eq.${approvalId}`)).length, 0);
    assert.ok((await rpc("decide_approval", { p_approval_id: approvalId, p_decision: "approved" })).ok);
    const result = await Promise.all(["a", "b"].map((worker) => executeApprovedActionById(approvalId, `${marker}-${worker}`)));
    assert.equal(result.filter((item) => item.kind === "executed").length, 1, JSON.stringify(result));
    assert.equal((await executeApprovedActionById(approvalId, "replay")).kind, "idle");
    const tasks = await rows<Table<"tasks">>(`tasks?approval_request_id=eq.${approvalId}`);
    assert.equal(tasks.length, 1); assert.equal(tasks[0].title, title); remember("tasks", tasks[0].id);
    assert.deepEqual((await rows<Table<"action_audit_logs">>(`action_audit_logs?approval_request_id=eq.${approvalId}&order=id`)).map((row) => row.event), ["requested", "approved", "executing", "executed", "verified"]);
    console.log(`G6A DB evidence: draft=${draft.id}, approval=${approvalId}, task=${tasks[0].id}, count=1`);
  });

  it("rejected or expired approvals and expired/disabled drafts create no task or event", async () => {
    const eventIds = await rows("events?select=id&order=id");
    for (const decision of ["rejected", "expired"] as const) {
      const draft = await taskDraft(`${marker}-${decision}`); const approvalId = await request(draft);
      if (decision === "rejected") assert.ok((await rpc("decide_approval", { p_approval_id: approvalId, p_decision: "rejected" })).ok);
      else {
        assert.ok((await rpc("decide_approval", { p_approval_id: approvalId, p_decision: "approved" })).ok);
        await rows(`approval_requests?id=eq.${approvalId}`, "PATCH", { expires_at: new Date(Date.now() - 1000).toISOString() });
      }
      assert.equal((await executeApprovedActionById(approvalId, `${marker}-${decision}`)).kind, "idle");
      assert.equal((await rows(`tasks?approval_request_id=eq.${approvalId}`)).length, 0);
    }
    const expired = await taskDraft(); await ageDraft(expired, 1);
    const disabled = await taskDraft(`${marker}-disabled`, false);
    for (const draft of [expired, disabled]) {
      assert.equal((await rpc("request_dialogue_approval", { p_draft_id: draft.id })).ok, false);
      assert.equal((await rows(`system_events?source_id=eq.${draft.id}&source_type=eq.dialogue_draft`)).length, 0);
    }
    assert.deepEqual(await rows("events?select=id&order=id"), eventIds);
  });

  it("6A calendar conversation persists a reviewable but non-executable draft", async () => {
    const content = "내일 오후 3시 영어 공부 1시간 일정 추가해";
    const reply = await answerDialogue({ messages: [{ role: "user", content }] }, { owner: owner(), interpret: async () => intent({
      kind: "create_calendar", title: quote("영어 공부"), date: quote("내일"), time: quote("오후 3시"), duration: quote("1시간"),
    }) });
    assert.equal(reply.mode, "propose"); assert.ok(reply.draft); remember("dialogue_action_drafts", reply.draft.id);
    assert.equal(reply.draft.canRequestApproval, false);
    assert.equal((await rpc("request_dialogue_approval", { p_draft_id: reply.draft.id })).ok, false);
    assert.equal((await rows(`system_events?source_id=eq.${reply.draft.id}`)).length, 0);
  });

  it("SQL calendar guards reject changed URL/UID/ETag/timestamp and read-only targets", async () => {
    // A valid SQL-only future-executor fixture proves failures below are caused
    // by the changed precondition, not a malformed baseline. Never execute it.
    const baseline = await calendarDraft(); const baselineApproval = await request(baseline);
    assert.ok((await rpc("decide_approval", { p_approval_id: baselineApproval, p_decision: "rejected" })).ok);
    const variants = [
      await calendarDraft({}, { calendarUrlHash: "0".repeat(64) }),
      await calendarDraft({ expectedUid: "changed@personal-os" }),
      await calendarDraft({ expectedEtag: '"changed"' }),
      await calendarDraft({}, { eventUpdatedAt: new Date(Date.parse(event.updated_at) - 1000).toISOString() }),
    ];
    for (const draft of variants) assert.equal((await rpc("request_dialogue_approval", { p_draft_id: draft.id })).ok, false);
    const readOnly = await calendarDraft();
    try {
      await rows(`calendars?id=eq.${calendar.id}`, "PATCH", { is_writable: false });
      assert.equal((await rpc("request_dialogue_approval", { p_draft_id: readOnly.id })).ok, false);
    } finally { await rows(`calendars?id=eq.${calendar.id}`, "PATCH", { is_writable: true }); }
    for (const draft of [...variants, readOnly]) assert.equal((await rows(`system_events?source_id=eq.${draft.id}&source_type=eq.dialogue_draft`)).length, 0);
  });

  it("interpreter budget/network failure propagates without draft, approval, task, or usage side effects", async () => {
    const beforeDrafts = await draftIds(); const beforeUsage = await rows("ai_usage?select=id&order=id");
    const beforeTasks = await rows("tasks?select=id&order=id");
    for (const error of [new BudgetExceededError(10, 10), new Error("Synthetic interpretation unavailable")]) {
      await assert.rejects(answerDialogue({ messages: [{ role: "user", content: "할 일 추가해" }] }, {
        owner: owner(), interpret: async () => { throw error; },
      }), (actual: unknown) => actual === error);
    }
    assert.deepEqual(await draftIds(), beforeDrafts);
    assert.deepEqual(await rows("ai_usage?select=id&order=id"), beforeUsage);
    assert.deepEqual(await rows("tasks?select=id&order=id"), beforeTasks);
  });

  it("pruning deletes only old unsubmitted drafts and preserves linked approvals plus recent drafts", async () => {
    const old = await taskDraft(`${marker}-prune-old`); await ageDraft(old, 48);
    const recent = await taskDraft(`${marker}-prune-recent`);
    const retained = await taskDraft(`${marker}-prune-submitted`); const approvalId = await request(retained);
    await ageDraft(retained, 48);
    const ownIds = [...owned.get("dialogue_action_drafts")!];
    const unrelated = await rows(`dialogue_action_drafts?id=not.in.(${ownIds.join(",")})&approval_request_id=is.null&expires_at=lt.${encodeURIComponent(new Date(Date.now() - 23 * 3_600_000).toISOString())}&select=id&limit=1`);
    assert.equal(unrelated.length, 0, "Refuse global prune while unrelated drafts could qualify; do not alter those drafts");
    const pruned = await rpc<number>("prune_dialogue_drafts", {}, service);
    assert.ok(pruned.ok, JSON.stringify(pruned)); assert.equal(pruned.data, 1);
    assert.equal((await rows(`dialogue_action_drafts?id=eq.${old.id}`)).length, 0);
    for (const draft of [recent, retained]) assert.equal((await rows(`dialogue_action_drafts?id=eq.${draft.id}`)).length, 1);
    assert.equal((await rows(`approval_requests?id=eq.${approvalId}`)).length, 1);
  });

  it("G6A HTTP auth, browser flow and historical regression are separately executed gates", (t) => {
    t.skip("This local DB gate does not claim actual HTTP 401/403, model generation, browser acceptance or G1–G5B regression");
  });
});
