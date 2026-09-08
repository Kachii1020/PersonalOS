import test from "node:test";
import assert from "node:assert/strict";
import { canSendWorkAttention, effectiveAttentionDue, groundWorkIntent, reduceWorkContext, validateWorkInput, validateWorkIntent, type WorkIntent } from "../lib/jarvis/work-context";
import { buildWorkPrompt } from "../lib/ai/prompts/work-context";
import { groundDialogueIntent } from "../lib/jarvis/dialogue-grounding";
import type { WorkContext, WorkInput } from "../lib/jarvis/work-types";
import type { DialogueIntent, InputQuote } from "../lib/jarvis/dialogue-types";

const now = new Date("2030-01-12T09:00:00Z");
const input: WorkInput = { goal: "연구 초록 준비", progress: "자료 수집까지 했음", nextStep: "초록 작성", deadlineAt: null, reminderAt: null, deadlineReminder: false, resumeReminder: false };
const context: WorkContext = { ...input, id: "context-1", ownerId: "owner-1", revision: 3, status: "active", missingFields: [], sourceRefs: [{ id: "confirmed-note" }], lastProgressAt: "2030-01-01T00:00:00Z", createdAt: "2030-01-01T00:00:00Z", updatedAt: "2030-01-01T00:00:00Z", expiresAt: null, forgottenAt: null };
const quote = (text: string, messageIndex = 0): InputQuote => ({ text, messageIndex });
const intent = (patch: Partial<WorkIntent> = {}): WorkIntent => ({ operation: "preview", goal: null, progress: null, nextStep: null, deadline: null, reminder: null, deadlineReminder: null, resumeReminder: null, status: null, actions: [], ...patch });
const user = (content: string) => [{ role: "user" as const, content }];

test("work input accepts explicit structured fields and rejects owner or result injection", () => {
  assert.deepEqual(validateWorkInput(input), input);
  for (const raw of [{ ...input, ownerId: "other" }, { ...input, status: "completed" }, { ...input, executed: true }, { ...input, goal: " " }, { ...input, progress: "x".repeat(2001) }, { ...input, resumeReminder: "true" }, { ...input, deadlineReminder: true }, { ...input, reminderAt: "2030-01-13" }, { ...input, reminderAt: "2030-02-30T12:00:00Z" }, { ...input, reminderAt: "2030-01-13T12:00:00.000001Z" }]) assert.throws(() => validateWorkInput(raw));
  assert.equal(validateWorkInput({ ...input, reminderAt: "2030-01-13T19:00:00+09:00" }).reminderAt, "2030-01-13T10:00:00.000Z");
});

test("reducer applies CAS, preserves owner and never completes a work from action success", () => {
  const updated = reduceWorkContext(context, { type: "update", input: { ...input, progress: "초록 작성 완료" }, expectedRevision: 3, now });
  assert.equal(updated.revision, 4); assert.equal(updated.ownerId, context.ownerId); assert.equal(updated.status, "active");
  assert.equal(context.progress, input.progress); assert.equal(updated.lastProgressAt, now.toISOString());
  assert.throws(() => reduceWorkContext(context, { type: "update", input, expectedRevision: 2, now }));
  const completed = reduceWorkContext(context, { type: "status", status: "completed", expectedRevision: 3, now });
  assert.equal(completed.status, "completed"); assert.equal(completed.expiresAt, "2030-02-11T09:00:00.000Z");
  assert.throws(() => reduceWorkContext(completed, { type: "status", status: "active", expectedRevision: 4, now }));
});

test("forget scrubs recall fields without changing linked external records", () => {
  const forgotten = reduceWorkContext(context, { type: "forget", expectedRevision: 3, now });
  assert.equal(forgotten.forgottenAt, now.toISOString()); assert.equal(forgotten.goal, ""); assert.deepEqual(forgotten.sourceRefs, []);
  assert.deepEqual(context.sourceRefs, [{ id: "confirmed-note" }]);
  assert.throws(() => reduceWorkContext(forgotten, { type: "update", input, expectedRevision: 4, now }));
});

test("automatic due respects JST quiet hours while explicit requested times remain unchanged", () => {
  assert.equal(effectiveAttentionDue("deadline", "2030-01-12T22:00:00+09:00"), "2030-01-12T23:00:00.000Z");
  assert.equal(effectiveAttentionDue("resume", "2030-01-13T07:59:59+09:00"), "2030-01-12T23:00:00.000Z");
  assert.equal(effectiveAttentionDue("resume", "2030-01-13T08:00:00+09:00"), "2030-01-12T23:00:00.000Z");
  assert.equal(effectiveAttentionDue("explicit", "2030-01-12T23:00:00+09:00"), "2030-01-12T14:00:00.000Z");
});

test("attention policy checks current consent status expiry revision cap and explicit exception", () => {
  const sample = { context: { ...context, resumeReminder: true }, kind: "resume" as const, dueAt: "2030-01-12T08:00:00+09:00", now, automaticSentToday: 2, sourceRevision: 3 };
  assert.equal(canSendWorkAttention(sample), true);
  for (const override of [{ automaticSentToday: 3 }, { sourceRevision: 2 }, { context: { ...sample.context, status: "cancelled" as const } }, { context: { ...sample.context, forgottenAt: now.toISOString() } }, { context: { ...sample.context, expiresAt: now.toISOString() } }, { now: new Date("2030-01-12T14:00:00Z") }]) assert.equal(canSendWorkAttention({ ...sample, ...override }), false);
  const reminderAt = "2030-01-12T23:00:00+09:00";
  assert.equal(canSendWorkAttention({ context: { ...context, reminderAt }, kind: "explicit", dueAt: reminderAt, now: new Date(reminderAt), automaticSentToday: 99 }), true);
});

test("preview grounds only latest user fields and resolves explicit reminder time in JST", () => {
  const content = "연구 초록 준비를 업무로 저장해. 자료 수집까지 했음. 다음은 초록 작성. 내일 19:00에 알려줘";
  const raw = intent({ goal: quote("연구 초록 준비"), progress: quote("자료 수집까지 했음"), nextStep: quote("초록 작성"), reminder: quote("내일 19:00") });
  const grounded = groundWorkIntent(raw, user(content), null, now);
  assert.equal(grounded.operation, "preview"); assert.equal(grounded.input?.reminderAt, "2030-01-13T10:00:00.000Z");
  assert.equal(grounded.input?.resumeReminder, false);
  assert.equal(groundWorkIntent(raw, [{ role: "assistant", content }, { role: "user", content: "저장해" }], null, now).operation, "clarify");
  assert.equal(groundWorkIntent(intent({ goal: quote("연구 초록 준비") }), user("연구 초록 준비 업무로 저장하지 마"), null, now).operation, "clarify");
});

test("ambiguous clock and inferred opt-in remain clarification", () => {
  assert.equal(groundWorkIntent(intent({ goal: quote("실험"), reminder: quote("내일 7시") }), user("실험 업무로 저장해 내일 7시 알려줘"), null, now).operation, "clarify");
  assert.equal(groundWorkIntent(intent({ goal: quote("실험"), resumeReminder: true }), user("실험 업무로 저장해"), null, now).operation, "clarify");
  assert.equal(groundWorkIntent(intent({ goal: quote("실험"), resumeReminder: true }), user("실험 업무로 저장해 재개 알림 켜줘"), null, now).input?.resumeReminder, true);
  assert.equal(groundWorkIntent(intent({ goal: quote("실험"), reminder: quote("내일 19:00") }), user("실험 업무로 저장해 내일 19:00에 시작할게"), null, now).operation, "clarify");
  assert.equal(groundWorkIntent(intent({ goal: quote("실험"), resumeReminder: true }), user("실험 업무로 저장해 재개 알림 꺼줘. 마감 알림 켜줘"), null, now).operation, "clarify");
});

test("work reminder supports unambiguous 24-hour Korean clocks but not bare 1–12", () => {
  for (const [clock, expected] of [["19시", "2030-01-13T10:00:00.000Z"], ["0시", "2030-01-12T15:00:00.000Z"], ["23시 45분", "2030-01-13T14:45:00.000Z"]]) {
    const phrase = `내일${clock}`;
    const result = groundWorkIntent(intent({ goal: quote("문서 수정"), reminder: quote(phrase) }), user(`문서 수정 업무로 저장해 ${phrase}에 알려줘`), null, now);
    assert.equal(result.operation, "preview"); assert.equal(result.input?.reminderAt, expected);
  }
  for (const clock of ["1시", "7시", "12시", "24시", "19시 60분"]) {
    const phrase = `내일 ${clock}`;
    assert.equal(groundWorkIntent(intent({ goal: quote("문서 수정"), reminder: quote(phrase) }), user(`문서 수정 업무로 저장해 ${phrase} 알려줘`), null, now).operation, "clarify");
  }
});

test("new work cannot silently replace a selected goal; progress edits keep other fields", () => {
  assert.equal(groundWorkIntent(intent({ operation: "update", goal: quote("다른 연구"), progress: quote("실험 완료") }), user("다른 연구 실험 완료"), context, now).operation, "clarify");
  const updated = groundWorkIntent(intent({ operation: "update", progress: quote("실험 완료") }), user("오늘 실험 완료"), context, now);
  assert.equal(updated.input?.goal, context.goal); assert.equal(updated.input?.nextStep, context.nextStep); assert.equal(updated.input?.progress, "실험 완료");
});

test("work status requires explicit domain intent; cancel or completed subaction is not work completion", () => {
  assert.equal(groundWorkIntent(intent({ operation: "status", status: "cancelled" }), user("취소"), context, now).operation, "clarify");
  assert.equal(groundWorkIntent(intent({ operation: "status", status: "completed" }), user("일정 생성 완료"), context, now).operation, "clarify");
  assert.equal(groundWorkIntent(intent({ operation: "status", status: "completed" }), user("업무에 연결된 일정 생성 완료"), context, now).operation, "clarify");
  assert.equal(groundWorkIntent(intent({ operation: "status", status: "completed" }), user("업무 완료는 아니야"), context, now).operation, "clarify");
  assert.equal(groundWorkIntent(intent({ operation: "status", status: "cancelled" }), user("이 업무 취소해"), context, now).status, "cancelled");
});

test("independent action clauses preserve quotes and remap to separately grounded requests", () => {
  const first = "성과 수치 정리 할 일"; const second = "내일 20:00부터 30분 준비 일정";
  const content = `이어하자. ${first}과 ${second} 만들어줘`;
  const task: DialogueIntent = { kind: "create_task", sourceId: null, title: quote("성과 수치 정리"), date: null, time: null, duration: null };
  const calendar: DialogueIntent = { kind: "create_calendar", sourceId: null, title: quote("준비"), date: quote("내일"), time: quote("20:00"), duration: quote("30분") };
  const raw = intent({ operation: "actions", actions: [{ request: quote(first), intent: task }, { request: quote(second), intent: calendar }] });
  const grounded = groundWorkIntent(raw, user(content), context, now);
  assert.equal(grounded.operation, "actions"); assert.equal(grounded.actions?.length, 2);
  for (const action of grounded.actions!) assert.equal(groundDialogueIntent(action.intent, user(action.text), now, []).needsClarification, false);
  assert.equal(context.status, "active");
  assert.equal(groundWorkIntent(raw, user(content + " 첫 행동이 끝나면 다음을 실행해"), context, now).operation, "clarify");
  assert.equal(groundWorkIntent(raw, user(content + " 이메일도 보내"), context, now).operation, "clarify");
  assert.equal(groundWorkIntent({ ...raw, actions: [raw.actions[0], raw.actions[0]] }, user(content), context, now).operation, "clarify");
});

test("compound action normalizes only a verified unambiguous Korean time clause", () => {
  const first = "성과수치정리할일"; const second = "내일20시부터30분준비일정";
  const task: DialogueIntent = { kind: "create_task", sourceId: null, title: quote("성과수치정리"), date: null, time: null, duration: null };
  const calendar: DialogueIntent = { kind: "create_calendar", sourceId: null, title: quote("준비"), date: quote("내일"), time: quote("20시"), duration: quote("30분") };
  const raw = intent({ operation: "actions", actions: [{ request: quote(first), intent: task }, { request: quote(second), intent: calendar }] });
  const result = groundWorkIntent(raw, user(`${first}과 ${second}만들어줘`), context, now);
  assert.equal(result.operation, "actions");
  assert.equal(result.actions?.[1].text, "내일20:00부터30분준비일정 추가해");
  assert.equal(result.actions?.[1].intent.time?.text, "20:00");
  assert.equal(raw.actions[1].intent.time?.text, "20시");
  for (const action of result.actions!) assert.equal(groundDialogueIntent(action.intent, user(action.text), now, []).needsClarification, false);
  const ambiguousClause = "내일7시부터30분준비일정";
  const ambiguous = groundWorkIntent(intent({ operation: "actions", actions: [{ request: quote(ambiguousClause), intent: { ...calendar, time: quote("7시") } }] }), user(ambiguousClause + "만들어줘"), context, now);
  assert.equal(ambiguous.operation, "clarify");
});

test("work intent rejects unknown owner/result fields and too many actions", () => {
  assert.throws(() => validateWorkIntent({ ...intent(), ownerId: "other" }));
  assert.throws(() => validateWorkIntent({ ...intent(), executed: true }));
  assert.throws(() => validateWorkIntent({ ...intent(), actions: [null, null, null, null] }));
});

test("prompt projection excludes owner, source references and arbitrary private fields", () => {
  const privateContext = { ...context, secret: "private-marker" };
  const prompt = buildWorkPrompt(user("진행 내용을 알려줘"), privateContext, now);
  assert.equal(prompt.includes("private-marker"), false); assert.equal(prompt.includes("owner-1"), false); assert.equal(prompt.includes("confirmed-note"), false);
  assert.equal(JSON.parse(prompt).context.goal, context.goal);
});
