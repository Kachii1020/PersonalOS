import test from "node:test";
import assert from "node:assert/strict";
import { CORE_LAB_IDS } from "@/lib/learn/core-track";
import { getXlsxTask } from "@/lib/learn/xlsx-tasks";
import {
  PACK_TASK_IDS,
  PHASE1_CORE_LAB_IDS,
  PHASE2_CORE_LAB_IDS,
  canSubmitXlsx,
} from "@/lib/learn/xlsx-unlock";
import type { XlsxTask } from "@/lib/learn/types";

const emptySubs: { taskId: string; status: "passed" | "failed" }[] = [];

function fakeTask(unlock: XlsxTask["unlock"]): XlsxTask {
  return {
    id: "fake",
    title: "fake",
    file: "/x.xlsx",
    conceptIds: [],
    unlock,
    instruction: "",
    checks: [],
  };
}

test("phase1 핵심은 9개, phase2 핵심은 5개", () => {
  assert.deepEqual(PHASE1_CORE_LAB_IDS, [
    "nav-cell-ref",
    "basic-fn-sum",
    "basic-fn-mixed-ref",
    "logic-if",
    "logic-iferror",
    "logic-sumifs",
    "lookup-index-match",
    "lookup-2d",
    "lookup-xlookup",
  ]);
  assert.deepEqual(PHASE2_CORE_LAB_IDS, [
    "clean-trim",
    "clean-extract",
    "fin-npv",
    "fin-xnpv",
    "fin-pmt",
  ]);
  assert.equal(PHASE1_CORE_LAB_IDS.length + PHASE2_CORE_LAB_IDS.length, 14);
  assert.equal(CORE_LAB_IDS.length, 20);
});

test("hands는 핵심 없이 제출할 수 있다", () => {
  const hands = getXlsxTask("hands");
  assert.ok(hands);
  assert.equal(hands.unlock, "always");
  assert.equal(canSubmitXlsx(hands, [], emptySubs), true);
});

test("pivot과 pq는 phase1 핵심을 다 채운 뒤에만 연다", () => {
  const pivot = getXlsxTask("pivot");
  const pq = getXlsxTask("pq");
  assert.ok(pivot);
  assert.ok(pq);
  assert.equal(pivot.unlock, "after-phase1-cores");
  assert.equal(pq.unlock, "after-phase1-cores");

  assert.equal(canSubmitXlsx(pivot, [], emptySubs), false);
  assert.equal(canSubmitXlsx(pq, PHASE1_CORE_LAB_IDS.slice(0, 8), emptySubs), false);
  assert.equal(canSubmitXlsx(pivot, PHASE1_CORE_LAB_IDS, emptySubs), true);
  assert.equal(canSubmitXlsx(pq, PHASE1_CORE_LAB_IDS, emptySubs), true);
});

test("after-phase2-cores는 phase1+phase2 핵심이 필요하다", () => {
  const task = fakeTask("after-phase2-cores");
  assert.equal(canSubmitXlsx(task, PHASE1_CORE_LAB_IDS, emptySubs), false);
  assert.equal(canSubmitXlsx(task, [...PHASE1_CORE_LAB_IDS, ...PHASE2_CORE_LAB_IDS], emptySubs), true);
});

test("after-packs는 핵심 20과 다섯 팩 passed가 필요하다", () => {
  const task = fakeTask("after-packs");
  const packs = PACK_TASK_IDS.map((taskId) => ({ taskId, status: "passed" as const }));
  assert.equal(canSubmitXlsx(task, CORE_LAB_IDS, emptySubs), false);
  assert.equal(canSubmitXlsx(task, PHASE1_CORE_LAB_IDS, packs), false);
  assert.equal(canSubmitXlsx(task, CORE_LAB_IDS, packs), true);
});
