import test from "node:test";
import assert from "node:assert/strict";
import { getXlsxTask } from "@/lib/learn/xlsx-tasks";
import { canSubmitTask, canSubmitXlsx } from "@/lib/learn/xlsx-unlock";

test("슬라이스 1은 always만 연다", () => {
  assert.equal(canSubmitXlsx("always"), true);
  assert.equal(canSubmitXlsx("after-phase1-cores"), false);
  assert.equal(canSubmitXlsx("after-phase2-cores"), false);
  assert.equal(canSubmitXlsx("after-packs"), false);
});

test("hands는 바로 제출할 수 있다", () => {
  const hands = getXlsxTask("hands");
  assert.ok(hands);
  assert.equal(hands.unlock, "always");
  assert.equal(canSubmitTask(hands), true);
});
