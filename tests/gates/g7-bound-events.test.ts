/** Pure work-source/privacy checks. No DB, model or CalDAV calls.
 * Run: node --import tsx --conditions=react-server --test tests/gates/g7-bound-events.test.ts
 * These checks do not establish actual calendar UPDATE end-to-end behavior.
 */
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { projectWorkBoundEventSources } from "../../lib/repos/jarvis-dialogue";
import { buildWorkPrompt } from "../../lib/ai/prompts/work-context";
import type { WorkSnapshot } from "../../lib/jarvis/work-types";

const eventId = "11111111-1111-4111-8111-111111111111";
const contextId = "22222222-2222-4222-8222-222222222222";
const approvalId = "33333333-3333-4333-8333-333333333333";
const observedAt = "2026-09-08T01:00:00Z";
const startsAt = "2026-11-01T10:00:00Z";
const endsAt = "2026-11-01T11:00:00Z";

function source(overrides: Record<string, unknown> = {}) {
  return { kind: "event", id: eventId, approvalId, available: true, observedAt,
    current: { id: eventId, summary: "연결된 준비", starts_at: startsAt, ends_at: endsAt, description: "PRIVATE_EVENT_DESCRIPTION" },
    ...overrides };
}
function work(): WorkSnapshot {
  return {
    context: { id: contextId, ownerId: "PRIVATE_OWNER", goal: "이력서 준비", progress: "프로젝트 설명까지 작성", nextStep: "성과 수치 정리",
      status: "active", revision: 1, deadlineAt: null, reminderAt: null, deadlineReminder: false, resumeReminder: false,
      missingFields: [], sourceRefs: [source()], lastProgressAt: observedAt, createdAt: observedAt, updatedAt: observedAt, expiresAt: null, forgottenAt: null },
    actions: [{ id: "44444444-4444-4444-8444-444444444444", contextId, approvalId, status: "executed", error: null,
      result: { calendarState: "verified", eventId }, draft: { id: "55555555-5555-4555-8555-555555555555", type: "CREATE_CALENDAR_EVENT",
        title: "일정 생성", explanation: "PRIVATE_DRAFT_EXPLANATION", expiresAt: "2026-09-08T01:15:00Z", canRequestApproval: false,
        payload: { version: 1, calendarId: "66666666-6666-4666-8666-666666666666", summary: "연결된 준비", startsAt, endsAt,
          timezone: "Asia/Tokyo", description: "PRIVATE_DRAFT_DESCRIPTION", location: null } } }],
    attention: [],
  };
}

before(() => { mock.method(globalThis, "fetch", () => { throw new Error("Network access is forbidden in the pure work-source gate"); }); });
after(() => { mock.restoreAll(); });

test("verified available work event projects its exact source ID", () => {
  const sources = projectWorkBoundEventSources(work());
  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, `event:${eventId}`);
});

test("projection contains only current title, times and observation metadata", () => {
  assert.deepEqual(projectWorkBoundEventSources(work()), [{ id: `event:${eventId}`, title: "연결된 준비", startsAt, endsAt, observedAt }]);
});

test("work prompt excludes owner, raw references, event descriptions and draft content", () => {
  const snapshot = work();
  const prompt = buildWorkPrompt([{ role: "user", content: "연결된 준비 일정 변경해줘" }], snapshot.context,
    new Date("2026-09-08T02:00:00Z"), projectWorkBoundEventSources(snapshot));
  for (const marker of ["PRIVATE_OWNER", "PRIVATE_EVENT_DESCRIPTION", "PRIVATE_DRAFT_EXPLANATION", "PRIVATE_DRAFT_DESCRIPTION"]) assert.equal(prompt.includes(marker), false);
  assert.deepEqual(JSON.parse(prompt).boundEvents, [{ id: `event:${eventId}`, title: "연결된 준비", startsAt, endsAt, observedAt }]);
});

test("a source reference without an executed linked action grants no candidate", () => {
  const snapshot = work(); snapshot.actions = [];
  assert.deepEqual(projectWorkBoundEventSources(snapshot), []);
});

test("an action belonging to another work context grants no candidate", () => {
  const snapshot = work(); snapshot.actions[0].contextId = "77777777-7777-4777-8777-777777777777";
  assert.deepEqual(projectWorkBoundEventSources(snapshot), []);
});

test("a task action cannot impersonate a verified calendar event", () => {
  const snapshot = work(); snapshot.actions[0].draft.type = "CREATE_TASK";
  assert.deepEqual(projectWorkBoundEventSources(snapshot), []);
});

test("cancelled, completed, paused or forgotten work exposes no update candidates", () => {
  for (const status of ["cancelled", "completed", "paused"] as const) {
    const snapshot = work(); snapshot.context.status = status;
    assert.deepEqual(projectWorkBoundEventSources(snapshot), []);
  }
  const forgotten = work(); forgotten.context.forgottenAt = observedAt;
  assert.deepEqual(projectWorkBoundEventSources(forgotten), []);
});

test("a missing current event remains unavailable instead of using old action payload", () => {
  const snapshot = work(); snapshot.context.sourceRefs = [source({ available: false, current: null })];
  assert.deepEqual(projectWorkBoundEventSources(snapshot), []);
});

test("source approval mismatch and unverified action states are rejected", () => {
  const mismatch = work(); mismatch.context.sourceRefs = [source({ approvalId: "unrelated-approval" })];
  assert.deepEqual(projectWorkBoundEventSources(mismatch), []);
  const unverified = work(); unverified.actions[0].result = { calendarState: "uncertain", eventId };
  assert.deepEqual(projectWorkBoundEventSources(unverified), []);
  const pending = work(); pending.actions[0].status = "pending";
  assert.deepEqual(projectWorkBoundEventSources(pending), []);
});

test("repeated verified actions for the same event produce one candidate", () => {
  const snapshot = work(); snapshot.actions.push(structuredClone(snapshot.actions[0]));
  assert.equal(projectWorkBoundEventSources(snapshot).length, 1);
});

test("invalid current source identity or times cannot become model candidates", () => {
  for (const current of [
    { id: "wrong-event", summary: "연결된 준비", starts_at: startsAt, ends_at: endsAt },
    { id: eventId, summary: "연결된 준비", starts_at: "unknown", ends_at: endsAt },
    { id: eventId, summary: "연결된 준비", starts_at: endsAt, ends_at: startsAt },
  ]) {
    const snapshot = work(); snapshot.context.sourceRefs = [source({ current })];
    assert.deepEqual(projectWorkBoundEventSources(snapshot), []);
  }
});
