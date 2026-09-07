/**
 * G5B local integration: real PostgreSQL/RLS/repositories/workers; synthetic
 * public-source and extraction boundaries. No live website fetch or paid AI.
 * Run serially against the dedicated 54621 stack, never alongside other gates.
 * G5B-11 (G1–G5A regression) is a separate required run, not proved here.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/types/database";
import type { SystemEvent } from "../../lib/jarvis/db-types";
import type { JsonValue, ProposedAction } from "../../lib/jarvis/types";
import type { RankedOpportunity } from "../../lib/career/types";
import type { CareerFetchResult } from "../../lib/integrations/career/fetch";
import { canonicalizeCareerUrl } from "../../lib/career/url";
import { validateCareerExtraction } from "../../lib/career/extraction";
import { rankOpportunities } from "../../lib/career/assessment";
import { processCareerRun } from "../../lib/career/orchestrator";
import { getCareerWorkForJob } from "../../lib/repos/career";
import { createAgentRunForEventForJob, markSystemEventProcessedForJob } from "../../lib/repos/jarvis-queue";
import { createApprovalForJob } from "../../lib/repos/jarvis-approvals";
import { executeApprovedActionById } from "../../lib/jarvis/executor";

config({ path: [".env.development.local", ".env.local"], quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const email = process.env.ALLOWED_EMAIL!;
const marker = `g5b-${randomUUID()}`;
const prefix = `https://example.com/${marker}/`;
type Table<K extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][K]["Row"];
type EventRow = Table<"system_events">;
type IdRow = { id: string };
const owned = new Map<string, Set<string>>();
const remember = (table: string, id: string) => {
  if (!owned.has(table)) owned.set(table, new Set());
  owned.get(table)!.add(id);
  return id;
};
let token = "";
let otherToken = "";
let otherUserId = "";
let companyId = "";
let profileBefore: Table<"career_profile"> | undefined;
let guarded = false;
let networkFetches = 0;
let extractionCalls = 0;
const DAY = 86_400_000;
const TEXT_A = "Synthetic public posting. Year 2 or above. Applications are open.";
const TEXT_B = "Synthetic public posting. Year 4 or above. Applications are open.";

async function rest<T = unknown>(path: string, method = "GET", body?: unknown, key = service) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { apikey: key === service ? service : anon, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, data: (text ? JSON.parse(text) : null) as T };
}
async function rows<T = IdRow>(path: string, method = "GET", body?: unknown, key = service): Promise<T[]> {
  const result = await rest<T[]>(path, method, body, key);
  assert.ok(result.ok, `${path}: HTTP ${result.status} ${JSON.stringify(result.data)}`);
  return result.data ?? [];
}
async function rpc<T = unknown>(name: string, body: unknown, key = service) {
  return rest<T>(`rpc/${name}`, "POST", body, key);
}
async function mutate(action: string, id: string | null, input: unknown): Promise<string> {
  const result = await rpc<string>("career_mutate", { p_action: action, p_id: id, p_input: input }, token);
  assert.ok(result.ok, `${action}: ${JSON.stringify(result.data)}`);
  return result.data;
}
async function login(address: string) {
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: address });
  assert.ifError(link.error);
  const session = await createClient(url, anon, { auth: { persistSession: false } }).auth.verifyOtp({
    type: "email", email: address, token: link.data.properties.email_otp,
  });
  assert.ifError(session.error);
  return { token: session.data.session!.access_token, id: session.data.user!.id };
}
async function setProfile(year?: number) {
  const now = Date.now();
  await mutate("profile", null, { facts: year === undefined ? {} : {
    academic_year: { value: year, source: "Explicit synthetic gate fact", verifiedAt: new Date(now - DAY).toISOString(), reviewAt: new Date(now + 30 * DAY).toISOString() },
  } });
}
async function capture(label: string, forCompanyId = companyId) {
  const canonical = canonicalizeCareerUrl(`${prefix}${label}?utm_source=fixture#details`);
  const id = remember("opportunities", await mutate("capture", null, { companyId: forCompanyId, url: canonical, title: `G5B ${label}` }));
  const events = await rows<EventRow>(`system_events?source_id=eq.${id}&event_type=eq.career.refresh`);
  assert.equal(events.length, 1, "capture must emit exactly one event");
  remember("system_events", events[0].id);
  return { id, event: events[0], canonical };
}
async function newEvent(opportunityId: string, type = "career.refresh") {
  const [event] = await rows<EventRow>("system_events", "POST", {
    event_type: type, source_type: "opportunity", source_id: opportunityId, dedupe_key: `${marker}:${randomUUID()}`,
  });
  remember("system_events", event.id);
  return event;
}

/** Own exact event/run only; never claim or modify an unrelated queue row. */
async function leasedRun(event: EventRow, workerId = `${marker}:${randomUUID()}`) {
  remember("system_events", event.id);
  await rows(`system_events?id=eq.${event.id}`, "PATCH", {
    status: "processing", locked_by: workerId, locked_until: new Date(Date.now() + 90_000).toISOString(),
  });
  const mapped: SystemEvent = {
    id: event.id, eventType: event.event_type, sourceType: event.source_type, sourceId: event.source_id,
    payload: event.payload as JsonValue, dedupeKey: event.dedupe_key, status: "processing", attempts: event.attempts,
    lockedBy: workerId, lockedUntil: new Date(Date.now() + 90_000).toISOString(), error: null,
  };
  const run = await createAgentRunForEventForJob(mapped);
  remember("agent_runs", run.id);
  assert.equal((await createAgentRunForEventForJob(mapped)).id, run.id, "event replay must reuse its run");
  await markSystemEventProcessedForJob(event.id, workerId);
  await rows(`agent_runs?id=eq.${run.id}`, "PATCH", {
    locked_by: workerId, locked_until: new Date(Date.now() + 90_000).toISOString(),
  });
  return { run: { ...run, lockedBy: workerId }, workerId };
}
function fetched(sourceUrl: string, text = TEXT_A): CareerFetchResult {
  return { kind: "ok", url: sourceUrl, httpStatus: 200, checkedAt: new Date().toISOString(),
    etag: `"${createHash("sha256").update(text).digest("hex")}"`, lastModified: null,
    title: "Synthetic gate opportunity", text, contentHash: createHash("sha256").update(text).digest("hex") };
}
function services(result: CareerFetchResult, empty = false) {
  return {
    fetch: async () => { networkFetches++; return result; },
    extract: async (text: string, sourceId: string) => {
      extractionCalls++;
      const expected = text.includes("Year 4") ? 4 : 2;
      return validateCareerExtraction({ title: "Synthetic gate opportunity", deadline: null,
        requirements: empty ? [] : [{ field: "academic_year", operator: "gte", expected, hard: true, quote: `Year ${expected} or above`, sourceId }],
      }, text, sourceId);
    },
  };
}
async function refresh(id: string, result: CareerFetchResult, event?: EventRow) {
  const lease = await leasedRun(event ?? await newEvent(id));
  const outcome = await processCareerRun(lease.run, lease.workerId, services(result));
  if (result.kind === "ok" || result.kind === "not_modified") {
    const persisted = (await rows<Table<"opportunities">>(`opportunities?id=eq.${id}`))[0];
    assert.equal(new Date(persisted.last_checked_at!).toISOString(), new Date(result.checkedAt).toISOString(),
      "freshness must use the collecting worker's check time, not the database clock");
  }
  return { ...lease, outcome };
}
async function extract(id: string, empty = false) {
  const pending = await rows<EventRow>(`system_events?source_id=eq.${id}&event_type=eq.opportunity.source_changed&status=eq.pending&order=created_at.desc`);
  assert.ok(pending.length, "source change must queue extraction");
  const lease = await leasedRun(pending[0]);
  const work = await getCareerWorkForJob(id);
  const outcome = await processCareerRun(lease.run, lease.workerId, services(fetched(work.row.canonical_url), empty));
  assert.equal(outcome.kind, "career_step");
}
async function reviewInput(id: string, patch: Record<string, unknown> = {}) {
  const { opportunity } = await getCareerWorkForJob(id);
  assert.ok(opportunity.source);
  return { revision: opportunity.revision, title: opportunity.title, lifecycle: "open", deadline: null,
    location: null, workMode: null, fit: 80, value: 70, effort: 20, deliverableKey: null, complete: true,
    requirements: opportunity.requirements.map((r) => ({ ...r, reviewed: true })), ...patch };
}
async function ready(label: string) {
  const captured = await capture(label);
  await refresh(captured.id, fetched(captured.canonical), captured.event);
  await extract(captured.id);
  await mutate("review", captured.id, await reviewInput(captured.id));
  return captured;
}

describe("G5B local database gate (synthetic source/AI boundaries)", { concurrency: false }, () => {
  before(async () => {
    assert.equal(process.env.GATE_ISOLATED_DB, "1");
    assert.equal(url, "http://127.0.0.1:54621", "Only the dedicated local gate stack is allowed");
    assert.equal(email, "phase5a@example.test");
    assert.ok(anon && service);
    guarded = true;
    profileBefore = (await rows<Table<"career_profile">>("career_profile?singleton=eq.true"))[0];
    assert.ok(profileBefore, "migration singleton missing");
    token = (await login(email)).token;
    const other = await login(`${marker}@example.test`);
    otherToken = other.token; otherUserId = other.id;
    companyId = remember("company_watchlist", await mutate("company", null, {
      name: marker, officialPrefixes: [prefix], tier: 1, windowStart: null, windowEnd: null,
    }));
    await setProfile(3);
  });

  after(async () => {
    if (!guarded) return;
    // Collect descendants solely through IDs created by this test run, including
    // records created atomically by triggers/RPCs before an assertion failed.
    for (const id of owned.get("opportunities") ?? []) {
      for (const table of ["opportunity_sources", "opportunity_requirements", "application_cases"] as const) {
        for (const row of await rows(`${table}?opportunity_id=eq.${id}&select=id`)) remember(table, row.id);
      }
    }
    for (const id of [...(owned.get("opportunities") ?? []), ...(owned.get("application_cases") ?? [])]) {
      for (const row of await rows(`system_events?source_id=eq.${id}&select=id`)) remember("system_events", row.id);
    }
    for (const id of owned.get("system_events") ?? []) {
      for (const row of await rows(`agent_runs?trigger_event_id=eq.${id}&select=id`)) remember("agent_runs", row.id);
    }
    for (const id of owned.get("agent_runs") ?? []) {
      for (const row of await rows(`approval_requests?agent_run_id=eq.${id}&select=id`)) remember("approval_requests", row.id);
    }
    for (const id of owned.get("approval_requests") ?? []) {
      for (const row of await rows(`tasks?approval_request_id=eq.${id}&select=id`)) remember("tasks", row.id);
      await rows(`action_audit_logs?approval_request_id=eq.${id}`, "DELETE");
    }
    for (const id of owned.get("opportunities") ?? []) {
      await rows(`opportunities?id=eq.${id}`, "PATCH", { current_source_id: null, extracted_source_id: null });
    }
    for (const id of owned.get("opportunity_sources") ?? []) {
      await rows(`opportunity_sources?id=eq.${id}`, "PATCH", { supersedes_source_id: null });
    }
    for (const table of ["tasks", "approval_requests", "agent_runs", "system_events", "application_cases", "opportunity_requirements", "opportunity_sources", "opportunities", "company_watchlist"]) {
      for (const id of owned.get(table) ?? []) await rows(`${table}?id=eq.${id}`, "DELETE");
    }
    if (profileBefore) {
      await rows("career_profile?singleton=eq.true", "PATCH", profileBefore);
      assert.deepEqual((await rows("career_profile?singleton=eq.true"))[0], profileBefore, "original career profile must be restored exactly");
    }
    if (otherUserId) assert.ifError((await createClient(url, service).auth.admin.deleteUser(otherUserId)).error);
    console.log(`G5B fixture boundaries: ${networkFetches} injected source responses, ${extractionCalls} injected extractions; no live source or AI request`);
  });

  it("permissions: anon/other cannot read or mutate; owner cannot forge worker state", async () => {
    for (const table of ["career_profile", "company_watchlist", "opportunities", "opportunity_sources", "opportunity_requirements", "application_cases"]) {
      for (const key of [anon, otherToken]) {
        const result = await rest<unknown[]>(`${table}?select=*`, "GET", undefined, key);
        assert.ok([401, 403].includes(result.status) || (result.ok && result.data.length === 0), `${table} leaked rows`);
      }
    }
    for (const key of [anon, otherToken]) {
      const result = await rpc("career_mutate", { p_action: "profile", p_input: { facts: {} } }, key);
      assert.ok([401, 403].includes(result.status), JSON.stringify(result));
    }
    for (const key of [anon, token, otherToken]) {
      const result = await rpc("commit_career_step", { p_run_id: randomUUID(), p_worker_id: "untrusted", p_opportunity_id: randomUUID(), p_revision: 0, p_kind: "source", p_data: {} }, key);
      assert.ok([401, 403].includes(result.status), JSON.stringify(result));
      const monitor = await rpc("queue_due_career_sources", {}, key);
      assert.ok([401, 403].includes(monitor.status));
    }
    const captured = await capture("permissions");
    const forged = await rest(`opportunities?id=eq.${captured.id}`, "PATCH", { source_available: true, source_reviewed: true }, token);
    assert.equal(forged.status, 403);
    assert.equal((await rest("career_profile?singleton=eq.true", "PATCH", { facts: {} }, token)).status, 403);
  });

  it("G5B-1/2/4: canonical capture, saved exact evidence, unknown profile, and live profile reassessment", async () => {
    const captured = await capture("canonical");
    const duplicate = await mutate("capture", null, { companyId, url: canonicalizeCareerUrl(`${captured.canonical}?utm_campaign=again#top`), title: "Duplicate" });
    assert.equal(duplicate, captured.id);
    assert.equal((await rows(`system_events?source_id=eq.${captured.id}&event_type=eq.career.refresh`)).length, 1);
    await refresh(captured.id, fetched(captured.canonical), captured.event);
    await extract(captured.id);
    let work = await getCareerWorkForJob(captured.id);
    assert.equal(work.opportunity.requirements[0].quote, "Year 2 or above");
    assert.equal(work.opportunity.requirements[0].sourceId, work.opportunity.source?.id);
    assert.equal(work.opportunity.assessment.eligibility, "possibly_eligible", "AI candidates must not be confirmed");
    await setProfile();
    await mutate("review", captured.id, await reviewInput(captured.id));
    assert.equal((await getCareerWorkForJob(captured.id)).opportunity.assessment.eligibility, "possibly_eligible");
    await setProfile(3);
    work = await getCareerWorkForJob(captured.id);
    assert.equal(work.opportunity.assessment.eligibility, "confirmed_eligible", JSON.stringify({
      invariant: "reviewed current evidence and valid facts must confirm eligibility",
      assessment: work.opportunity.assessment, source: work.opportunity.source,
      facts: work.facts, requirements: work.opportunity.requirements, now: new Date().toISOString(),
    }));
    assert.equal(work.opportunity.assessment.status, "act_now");
    await setProfile(1);
    assert.equal((await getCareerWorkForJob(captured.id)).opportunity.assessment.eligibility, "not_eligible");
    await setProfile(3);
  });

  it("G5B-2: empty extraction persists an unreviewed hard unknown and never confirms", async () => {
    const captured = await capture("empty-extraction");
    await refresh(captured.id, fetched(captured.canonical), captured.event);
    await extract(captured.id, true);
    const { opportunity } = await getCareerWorkForJob(captured.id);
    assert.equal(opportunity.requirements.length, 1);
    assert.equal(opportunity.requirements[0].operator, "unknown");
    assert.equal(opportunity.requirements[0].hard, true);
    assert.equal(opportunity.requirements[0].reviewed, false);
    assert.equal(opportunity.assessment.eligibility, "possibly_eligible");
  });

  it("G5B-4/5: same hash reuses snapshot; changes and reversion emit revalidation and invalidate review", async () => {
    const captured = await ready("source-history");
    const original = (await getCareerWorkForJob(captured.id)).opportunity.source!.id;
    const originalSnapshot = (await rows<Table<"opportunity_sources">>(`opportunity_sources?id=eq.${original}`))[0];
    assert.equal(originalSnapshot.source_class, "official_posting");
    assert.equal(originalSnapshot.http_status, 200);
    assert.equal(originalSnapshot.supersedes_source_id, null);
    const beforeEvents = (await rows(`system_events?source_id=eq.${captured.id}&event_type=eq.opportunity.source_changed`)).length;
    await refresh(captured.id, { ...fetched(captured.canonical), checkedAt: new Date(Date.now() - 2000).toISOString() });
    assert.equal((await rows(`opportunity_sources?opportunity_id=eq.${captured.id}`)).length, 1);
    assert.equal((await rows(`system_events?source_id=eq.${captured.id}&event_type=eq.opportunity.source_changed`)).length, beforeEvents);
    assert.equal((await getCareerWorkForJob(captured.id)).opportunity.source?.reviewed, true);
    await refresh(captured.id, { ...fetched(captured.canonical), kind: "not_modified", httpStatus: 304,
      checkedAt: new Date(Date.now() - 1000).toISOString() });
    assert.equal((await rows(`opportunity_sources?opportunity_id=eq.${captured.id}`)).length, 1);
    assert.equal((await getCareerWorkForJob(captured.id)).opportunity.source?.reviewed, true);
    assert.equal((await rows(`system_events?source_id=eq.${captured.id}&event_type=eq.opportunity.source_changed`)).length, beforeEvents);
    const secondFetch = { ...fetched(captured.canonical, TEXT_B), lastModified: "Mon, 01 Sep 2025 00:00:00 GMT" };
    await refresh(captured.id, secondFetch);
    assert.equal((await rows(`opportunity_sources?opportunity_id=eq.${captured.id}`)).length, 2);
    const changed = await getCareerWorkForJob(captured.id);
    assert.equal(changed.opportunity.assessment.eligibility, "possibly_eligible");
    const second = changed.opportunity.source!.id;
    const secondSnapshot = (await rows<Table<"opportunity_sources">>(`opportunity_sources?id=eq.${second}`))[0];
    assert.equal(secondSnapshot.supersedes_source_id, original);
    assert.equal(secondSnapshot.source_class, "official_posting");
    assert.equal(secondSnapshot.http_status, 200);
    assert.equal(secondSnapshot.etag, secondFetch.etag);
    assert.equal(secondSnapshot.last_modified, secondFetch.lastModified);
    assert.equal(new Date(secondSnapshot.retrieved_at).toISOString(), secondFetch.checkedAt);
    const changedEvents = await rows<EventRow>(`system_events?source_id=eq.${captured.id}&event_type=eq.opportunity.source_changed&order=created_at.desc`);
    assert.deepEqual(changedEvents[0].payload, { sourceId: second, supersedesSourceId: original });
    await extract(captured.id);
    await refresh(captured.id, fetched(captured.canonical));
    assert.equal((await rows(`opportunity_sources?opportunity_id=eq.${captured.id}`)).length, 2);
    const reverted = await getCareerWorkForJob(captured.id);
    assert.equal(reverted.opportunity.source?.id, original);
    assert.equal(reverted.opportunity.source?.reviewed, false);
    assert.equal((await rows(`system_events?source_id=eq.${captured.id}&event_type=eq.opportunity.source_changed`)).length, beforeEvents + 2);
    const revertedEvents = await rows<EventRow>(`system_events?source_id=eq.${captured.id}&event_type=eq.opportunity.source_changed&order=created_at.desc`);
    assert.deepEqual(revertedEvents[0].payload, { sourceId: original, supersedesSourceId: second });
    assert.deepEqual((await rows<Table<"opportunity_sources">>(`opportunity_sources?id=eq.${original}`))[0], originalSnapshot,
      "A→B→A must reuse immutable snapshot A; the transition event records B as its predecessor");
  });

  it("review revision guards reject missing/stale inputs and permit exactly one concurrent review", async () => {
    const captured = await ready("review-race");
    const input = await reviewInput(captured.id);
    const { revision: omitted, ...missing } = input;
    assert.ok(Number.isInteger(omitted));
    const noRevision = await rpc("career_mutate", { p_action: "review", p_id: captured.id, p_input: missing }, token);
    assert.equal(noRevision.ok, false);
    const results = await Promise.all([1, 2].map(() => rpc("career_mutate", { p_action: "review", p_id: captured.id, p_input: input }, token)));
    assert.equal(results.filter((result) => result.ok).length, 1);
    const stale = await rpc("career_mutate", { p_action: "review", p_id: captured.id, p_input: input }, token);
    assert.equal(stale.ok, false);
  });

  it("worker CAS and lease guards prevent superseded, expired, null, or misbound source commits", async () => {
    const captured = await ready("worker-guards");
    const work = await getCareerWorkForJob(captured.id);
    const result = { ...fetched(captured.canonical, TEXT_B), nextCheckAt: new Date(Date.now() + DAY).toISOString() };
    for (const expires of [null, "2000-01-01T00:00:00Z"]) {
      const { run, workerId } = await leasedRun(await newEvent(captured.id));
      await rows(`agent_runs?id=eq.${run.id}`, "PATCH", { locked_until: expires });
      const denied = await rpc("commit_career_step", { p_run_id: run.id, p_worker_id: workerId, p_opportunity_id: captured.id, p_revision: work.row.revision, p_kind: "source", p_data: result });
      assert.equal(denied.ok, false);
      assert.equal((await getCareerWorkForJob(captured.id)).row.revision, work.row.revision);
    }
    const { run, workerId } = await leasedRun(await newEvent(captured.id));
    const misbound = await rpc("commit_career_step", { p_run_id: run.id, p_worker_id: workerId, p_opportunity_id: randomUUID(), p_revision: work.row.revision, p_kind: "source", p_data: result });
    assert.equal(misbound.ok, false);
    await mutate("review", captured.id, await reviewInput(captured.id));
    const obsolete = await rpc<boolean>("commit_career_step", { p_run_id: run.id, p_worker_id: workerId, p_opportunity_id: captured.id, p_revision: work.row.revision, p_kind: "source", p_data: result });
    assert.ok(obsolete.ok, JSON.stringify(obsolete));
    assert.equal(obsolete.data, false);
    assert.equal((await getCareerWorkForJob(captured.id)).opportunity.source?.id, work.opportunity.source?.id);
  });

  it("G5B-3/6/9: actual assessments exclude closed/ineligible/rejected/deferred and cap/deduplicate top actions", async () => {
    const candidates: RankedOpportunity[] = [];
    for (let index = 0; index < 9; index++) {
      const captured = await ready(`ranking-${index}`);
      await mutate("review", captured.id, await reviewInput(captured.id, {
        lifecycle: index === 5 ? "closed" : "open", deliverableKey: index < 2 ? "same-essay" : null,
      }));
      if (index === 2 || index === 3) await mutate("decision", captured.id, {
        decision: index === 2 ? "reject" : "defer", reason: "Preserve time for existing commitments", deferUntil: index === 3 ? new Date(Date.now() + DAY).toISOString() : null,
      });
      if (index === 6) {
        const input = await reviewInput(captured.id);
        await mutate("review", captured.id, { ...input, requirements: input.requirements.map((r) => ({ ...r, expected: 4 })) });
      }
      const { opportunity: item } = await getCareerWorkForJob(captured.id);
      candidates.push({ id: item.id, title: item.title, organization: item.organization, eligibility: item.assessment.eligibility,
        lifecycle: item.assessment.lifecycle, deadline: item.deadline, verifiedAt: item.source!.checkedAt,
        fit: item.fit, value: item.value, effort: item.effort, decision: item.decision,
        deferUntil: item.deferUntil, decisionReason: item.decisionReason, deliverableKey: item.deliverableKey });
    }
    const top = rankOpportunities(candidates, new Date());
    assert.equal(top.length, 3, "more than three eligible distinct candidates must still yield exactly three");
    assert.equal(top.filter((item) => item.deliverableKey === "same-essay").length, 1);
    assert.ok(top.every((item) => item.eligibility === "confirmed_eligible" && item.lifecycle === "open" && item.decision === "none"));
    assert.ok(candidates.filter((item) => item.decision !== "none").every((item) => item.decisionReason === "Preserve time for existing commitments"));
    assert.equal(candidates[6].eligibility, "not_eligible");
    await mutate("decision", candidates[2].id, { decision: "none", reason: "", deferUntil: null });
    const reconsidered = await getCareerWorkForJob(candidates[2].id);
    assert.equal(reconsidered.opportunity.decisionReason, "Preserve time for existing commitments", "reconsidering must not erase the prior reason");
    const history = (await rows<{ decision_history: unknown[] }>(`opportunities?id=eq.${candidates[2].id}&select=decision_history`))[0].decision_history;
    assert.equal(history.length, 2);
    const recommendedAgain = rankOpportunities([{ ...candidates[2], decision: "none", decisionReason: reconsidered.opportunity.decisionReason }], new Date());
    assert.match(recommendedAgain[0].reason, /Preserve time for existing commitments/);
  });

  it("G5B-7/8: unique case and next action become an approved CREATE_TASK exactly once, with full audit", async () => {
    const captured = await ready("application");
    const input = { nextAction: "G5B prepare the application outline", dueAt: null };
    const cases = await Promise.all([1, 2].map(() => mutate("case", captured.id, input)));
    assert.equal(cases[0], cases[1]);
    const caseId = remember("application_cases", cases[0]);
    const saved = await rows<Table<"application_cases">>(`application_cases?id=eq.${caseId}`);
    assert.equal(saved[0].next_action, input.nextAction);
    const events = await rows<EventRow>(`system_events?source_id=eq.${caseId}&event_type=eq.career.application_started`);
    assert.equal(events.length, 1);
    const { run, workerId } = await leasedRun(events[0]);
    const noExternal = {
      fetch: async (): Promise<CareerFetchResult> => { throw new Error("application must not fetch external sources"); },
      extract: async (): Promise<ReturnType<typeof validateCareerExtraction>> => { throw new Error("application must not call AI"); },
    };
    assert.equal((await processCareerRun(run, workerId, noExternal)).kind, "classified");
    const planned = (await rows<Table<"agent_runs">>(`agent_runs?id=eq.${run.id}`))[0];
    assert.equal(planned.current_step, "prepare_approval");
    const state = planned.state as unknown as { classification: { proposedAction: ProposedAction } };
    assert.equal(state.classification.proposedAction.type, "CREATE_TASK");
    const approvalWorker = `${marker}:approval`;
    await rows(`agent_runs?id=eq.${run.id}`, "PATCH", { locked_by: approvalWorker, locked_until: new Date(Date.now() + 90_000).toISOString() });
    const approval = await createApprovalForJob(run.id, state.classification.proposedAction, approvalWorker);
    remember("approval_requests", approval.id);
    assert.equal((await executeApprovedActionById(approval.id, "unapproved")).kind, "idle");
    assert.equal((await rows(`tasks?approval_request_id=eq.${approval.id}`)).length, 0);
    const decision = await rpc("decide_approval", { p_approval_id: approval.id, p_decision: "approved" }, token);
    assert.ok(decision.ok, JSON.stringify(decision));
    // The executor performs real atomic claim-by-ID, so other pending queue
    // rows are neither consumed nor modified by this test.
    const executions = await Promise.all(["a", "b"].map((suffix) => executeApprovedActionById(approval.id, `${marker}:${suffix}`)));
    assert.equal(executions.filter((result) => result.kind === "executed").length, 1, JSON.stringify(executions));
    assert.equal((await executeApprovedActionById(approval.id, "replay")).kind, "idle");
    const tasks = await rows<Table<"tasks">>(`tasks?approval_request_id=eq.${approval.id}`);
    assert.equal(tasks.length, 1); remember("tasks", tasks[0].id);
    assert.equal(tasks[0].title, input.nextAction);
    const audits = await rows<Table<"action_audit_logs">>(`action_audit_logs?approval_request_id=eq.${approval.id}&order=id`);
    assert.deepEqual(audits.map((audit) => audit.event), ["requested", "approved", "executing", "executed", "verified"]);
    console.log(`G5B application evidence: case=${caseId}, approval=${approval.id}, task=${tasks[0].id}, taskCount=1`);
  });

  it("G5B-10: unavailable official source downgrades prior confirmed eligibility", async () => {
    const captured = await ready("disappeared");
    assert.equal((await getCareerWorkForJob(captured.id)).opportunity.assessment.eligibility, "confirmed_eligible");
    const { outcome, run } = await refresh(captured.id, { kind: "unavailable", url: captured.canonical, httpStatus: 404,
      checkedAt: new Date().toISOString(), etag: null, lastModified: null, error: "Synthetic source HTTP 404" });
    assert.equal(outcome.kind, "failed");
    const failedRun = (await rows<Table<"agent_runs">>(`agent_runs?id=eq.${run.id}`))[0];
    assert.equal(failedRun.status, "failed", "source failure must be visible in its durable agent run");
    assert.match(failedRun.error ?? "", /404/);
    const { opportunity } = await getCareerWorkForJob(captured.id);
    assert.equal(opportunity.source?.available, false);
    assert.equal(opportunity.assessment.eligibility, "possibly_eligible");
    assert.notEqual(opportunity.assessment.status, "act_now");
    assert.match(opportunity.lastError ?? "", /404/);
  });

  it("repository pagination finds an opportunity's company beyond the first 200 rows", async () => {
    const created = await rows<Table<"company_watchlist">>("company_watchlist", "POST", [
      ...Array.from({ length: 201 }, (_, index) => ({ name: `000-${marker}-${String(index).padStart(3, "0")}`, official_prefixes: [prefix], tier: 1 })),
      { name: `zzz-${marker}`, official_prefixes: [prefix], tier: 1 },
    ]);
    for (const company of created) remember("company_watchlist", company.id);
    assert.equal(created.length, 202);
    const late = created.find((company) => company.name === `zzz-${marker}`)!;
    assert.ok(late);
    const firstPage = await rows<Table<"company_watchlist">>("company_watchlist?order=name&limit=200");
    assert.equal(firstPage.some((company) => company.id === late.id), false, "fixture must actually sit beyond the first page");
    const captured = await capture("late-company", late.id);
    const work = await getCareerWorkForJob(captured.id);
    assert.equal(work.company.id, late.id);
    await refresh(captured.id, fetched(captured.canonical), captured.event);
    assert.equal((await getCareerWorkForJob(captured.id)).opportunity.source?.official, true);
  });

  it("monitor: due rows queue once; weekly/monthly/window-only cadence and exclusions are enforced", async () => {
    const now = Date.now();
    const future = new Date(now + 2 * DAY).toISOString();
    const overdue = new Date(now - DAY).toISOString();
    const addCompany = async (label: string, tier: number, windowStart: string | null = null, windowEnd: string | null = null) =>
      remember("company_watchlist", await mutate("company", null, {
        name: `${marker}-${label}`, reason: "Synthetic monitor cadence fixture", officialPrefixes: [prefix], tier, windowStart, windowEnd,
      }));
    const monthlyCompany = await addCompany("monthly", 2);
    const insideCompany = await addCompany("inside-window", 3, new Date(now - DAY).toISOString(), future);
    const outsideCompany = await addCompany("outside-window", 3, future, new Date(now + 3 * DAY).toISOString());
    const disabledCompany = await addCompany("disabled", 1);
    await rows(`company_watchlist?id=eq.${disabledCompany}`, "PATCH", { enabled: false });
    const weekly = await capture("monitor-weekly");
    const monthly = await capture("monitor-monthly", monthlyCompany);
    const inside = await capture("monitor-inside", insideCompany);
    const weeklyFuture = await capture("monitor-weekly-future");
    const monthlyFuture = await capture("monitor-monthly-future", monthlyCompany);
    const outside = await capture("monitor-outside", outsideCompany);
    const disabled = await capture("monitor-disabled", disabledCompany);

    // The monitor RPC is global. Make only this test's selected rows due, then
    // refuse to call it if ANY unrelated opportunity could become due soon.
    // All changes here target IDs owned by this gate; no unrelated row is parked.
    const ownedIds = [...owned.get("opportunities")!];
    for (const id of ownedIds) await rows(`opportunities?id=eq.${id}`, "PATCH", { next_check_at: future });
    for (const item of [weekly, monthly, inside, outside, disabled]) {
      await rows(`opportunities?id=eq.${item.id}`, "PATCH", { next_check_at: overdue });
    }
    const unrelatedNearDue = await rows(`opportunities?id=not.in.(${ownedIds.join(",")})&next_check_at=lte.${encodeURIComponent(new Date(now + DAY).toISOString())}&select=id&limit=1`);
    assert.equal(unrelatedNearDue.length, 0, "Global monitor test requires no unrelated opportunity due within 24h; do not alter those rows");

    const queued = await rpc<number>("queue_due_career_sources", { p_limit: 20 });
    assert.ok(queued.ok, JSON.stringify(queued));
    assert.equal(queued.data, 3, "only due tier 1, tier 2 and in-window tier 3 rows may queue");
    const dueEvents = async (id: string) => rows<EventRow>(`system_events?source_id=eq.${id}&dedupe_key=like.career:due:*`);
    for (const item of [weekly, monthly, inside]) {
      const events = await dueEvents(item.id);
      assert.equal(events.length, 1);
      remember("system_events", events[0].id);
    }
    for (const item of [weeklyFuture, monthlyFuture, outside, disabled]) assert.equal((await dueEvents(item.id)).length, 0);
    const repeated = await rpc<number>("queue_due_career_sources", { p_limit: 20 });
    assert.ok(repeated.ok, JSON.stringify(repeated));
    assert.equal(repeated.data, 0, "immediate monitor replay must not create duplicate due events");

    // Process the actual emitted event with synthetic source I/O. Timestamp
    // bounds cover the worker call itself and preserve exact 7/30/1-day policy.
    for (const [item, days] of [[weekly, 7], [monthly, 30], [inside, 1]] as const) {
      const [event] = await dueEvents(item.id);
      const beforeRefresh = Date.now();
      await refresh(item.id, fetched(item.canonical), event);
      const afterRefresh = Date.now();
      const saved = (await rows<Table<"opportunities">>(`opportunities?id=eq.${item.id}`))[0];
      const next = Date.parse(saved.next_check_at);
      assert.ok(next >= beforeRefresh + days * DAY && next <= afterRefresh + days * DAY,
        `tier cadence must be ${days} days from this successful check`);
      assert.equal((await dueEvents(item.id)).length, 1);
    }
    assert.equal((await rpc<number>("queue_due_career_sources", { p_limit: 20 })).data, 0,
      "successful cadence, future dates, disabled watchlist and closed windows must remain excluded");
  });

  it("G5B-11: G1–G5A regression is a separately executed gate", (t) => {
    t.skip("Run and report the complete regression separately; this synthetic-boundary integration gate cannot establish it");
  });
});
