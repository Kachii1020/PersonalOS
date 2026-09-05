import test from "node:test";
import assert from "node:assert/strict";
import { classifyCapture } from "../lib/jarvis/capture";
import { parseCreateTaskPayload } from "../lib/jarvis/action-payload";
import { buildCommandBrief } from "../lib/jarvis/brief";
import { policyForAction } from "../lib/jarvis/policy";
import { selectTopActions } from "../lib/jarvis/priority";

const NOW = new Date("2026-09-05T00:00:00.000Z");

test("policy fails closed and separates internal, approval, denied actions", () => {
  assert.equal(policyForAction("SUMMARIZE_INTERNAL"), "auto");
  assert.equal(policyForAction("CREATE_TASK"), "approval");
  assert.equal(policyForAction("MAKE_PAYMENT"), "deny");
  assert.equal(policyForAction("UNKNOWN_ACTION"), "deny");
});

test("explicit task capture prepares a low-risk CREATE_TASK approval", () => {
  const result = classifyCapture({
    id: "capture-1",
    kind: "command",
    rawText: "할 일: Finatext 지원동기 완성",
    sourceUrl: null,
  });
  assert.equal(result.status, "act_now");
  assert.equal(result.proposedAction?.type, "CREATE_TASK");
  assert.equal(result.proposedAction?.idempotencyKey, "capture:capture-1:create-task:v1");
  assert.equal((result.proposedAction?.payload as { title: string }).title, "Finatext 지원동기 완성");
});

test("URL is monitored instead of being promoted to an immediate action", () => {
  const result = classifyCapture({
    id: "capture-2",
    kind: "url",
    rawText: null,
    sourceUrl: "https://example.com/program",
  });
  assert.equal(result.status, "monitor");
  assert.equal(result.proposedAction, null);
});

test("learning capture goes to learn queue", () => {
  const result = classifyCapture({
    id: "capture-3",
    kind: "text",
    rawText: "공부: PostgreSQL window function",
    sourceUrl: null,
  });
  assert.equal(result.status, "learn");
  assert.equal(result.summary, "PostgreSQL window function");
});

test("CREATE_TASK payload validation rejects malformed or dangerous values", () => {
  assert.throws(() => parseCreateTaskPayload({ title: "" }), /제목/);
  assert.throws(() => parseCreateTaskPayload({ title: "ok", priority: 101 }), /0 이상 100 이하/);
  assert.throws(() => parseCreateTaskPayload({ title: "ok", dueAt: "not-a-date" }), /유효한 날짜/);

  assert.deepEqual(
    parseCreateTaskPayload({
      title: "Apply",
      priority: 80,
      estimatedMinutes: 45,
      category: "career",
      dueAt: "2026-09-08T10:00:00+09:00",
    }),
    {
      title: "Apply",
      notes: null,
      dueAt: "2026-09-08T10:00:00+09:00",
      category: "career",
      priority: 80,
      estimatedMinutes: 45,
    },
  );
});

test("priority selection excludes deferred work and caps output at three", () => {
  const top = selectTopActions(
    [
      { id: "1", title: "Overdue", dueAt: "2026-09-04T00:00:00Z", deferUntil: null, priority: 60, estimatedMinutes: 30, category: null },
      { id: "2", title: "Today", dueAt: "2026-09-05T12:00:00Z", deferUntil: null, priority: 70, estimatedMinutes: 30, category: null },
      { id: "3", title: "Later", dueAt: "2026-09-20T00:00:00Z", deferUntil: null, priority: 95, estimatedMinutes: 30, category: null },
      { id: "4", title: "Deferred", dueAt: "2026-09-05T01:00:00Z", deferUntil: "2026-09-10T00:00:00Z", priority: 100, estimatedMinutes: 10, category: null },
      { id: "5", title: "Long", dueAt: null, deferUntil: null, priority: 90, estimatedMinutes: 180, category: null },
    ],
    NOW,
    20,
  );
  assert.equal(top.length, 3);
  assert.equal(top.some((task) => task.taskId === "4"), false);
  assert.equal(top[0]?.title, "Overdue");
});

test("deterministic brief surfaces no more than three actions and approvals", () => {
  const tasks = Array.from({ length: 11 }, (_, index) => ({
    id: String(index),
    title: `Task ${index}`,
    dueAt: index < 3 ? "2026-09-05T05:00:00Z" : null,
    deferUntil: index === 10 ? "2026-09-09T00:00:00Z" : null,
    priority: 50 + index,
    estimatedMinutes: 30,
    category: "career",
  }));
  const brief = buildCommandBrief({
    tasks,
    approvals: [{ id: "a1", title: "Create task", actionType: "CREATE_TASK", requestedAt: NOW.toISOString() }],
    now: NOW,
  });

  assert.equal(brief.topActions.length, 3);
  assert.equal(brief.preparedItems.length, 1);
  assert.equal(brief.postponedItems.length, 1);
  assert.equal(brief.warnings.some((warning) => warning.includes("10개")), true);
});
