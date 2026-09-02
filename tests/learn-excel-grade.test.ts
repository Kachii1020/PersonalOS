import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gradeWorkbook } from "@/lib/integrations/xlsx/grade";
import { getXlsxTask } from "@/lib/learn/xlsx-tasks";
import { handsSum } from "@/lib/learn/xlsx-hands";
import { pivotSeoulCogs, pivotSeoulQ1 } from "@/lib/learn/xlsx-pivot";
import { pqAppendSum, pqCleanRowCount, pqFirst2023 } from "@/lib/learn/xlsx-pq";

const hands = getXlsxTask("hands");
assert.ok(hands);

test("hands pass 픽스처는 전부 통과한다", () => {
  const bytes = new Uint8Array(readFileSync("tests/fixtures/learn/hands-pass.xlsx"));
  const graded = gradeWorkbook(hands, bytes);
  assert.equal(graded.status, "passed");
  assert.ok(graded.results.length >= 1);
  assert.ok(graded.results.every((row) => row.passed));
  const sum = graded.results.find((row) => row.id === "hands-sum");
  assert.ok(sum?.passed);
  const sumCheck = hands.checks.find((c) => c.id === "hands-sum");
  assert.ok(sumCheck && sumCheck.kind === "cell-value");
  assert.equal(sumCheck.expected, handsSum());
});

test("hands 합이 틀린 파일은 hands-sum만 실패한다", () => {
  const bytes = new Uint8Array(readFileSync("tests/fixtures/learn/hands-fail-sum.xlsx"));
  const graded = gradeWorkbook(hands, bytes);
  assert.equal(graded.status, "failed");
  const byId = new Map(graded.results.map((row) => [row.id, row]));
  assert.equal(byId.get("hands-sum")?.passed, false);
  assert.equal(byId.get("hands-sum-formula")?.passed, true);
  assert.equal(byId.get("hands-data")?.passed, true);
  assert.equal(byId.get("hands-last-row")?.passed, true);
  assert.equal(byId.get("hands-name")?.passed, true);
});

test("깨진 바이트는 parse 한 줄로 실패한다", () => {
  const graded = gradeWorkbook(hands, new Uint8Array([1, 2, 3]));
  assert.equal(graded.status, "failed");
  assert.equal(graded.results.length, 1);
  assert.equal(graded.results[0].id, "parse");
  assert.equal(graded.results[0].passed, false);
});

const pivot = getXlsxTask("pivot");
assert.ok(pivot);

test("pivot pass 픽스처는 전부 통과한다", () => {
  const bytes = new Uint8Array(readFileSync("tests/fixtures/learn/pivot-pass.xlsx"));
  const graded = gradeWorkbook(pivot, bytes);
  assert.equal(graded.status, "passed");
  assert.ok(graded.results.every((row) => row.passed));
  const q1 = pivot.checks.find((c) => c.id === "pivot-seoul-q1");
  const cogs = pivot.checks.find((c) => c.id === "pivot-cogs");
  assert.ok(q1 && q1.kind === "cell-value");
  assert.ok(cogs && cogs.kind === "cell-value");
  assert.equal(q1.expected, pivotSeoulQ1());
  assert.equal(cogs.expected, pivotSeoulCogs());
});

test("피벗 파트가 없으면 pivot-part만 실패한다", () => {
  const bytes = new Uint8Array(readFileSync("tests/fixtures/learn/pivot-fail-part.xlsx"));
  const graded = gradeWorkbook(pivot, bytes);
  assert.equal(graded.status, "failed");
  const byId = new Map(graded.results.map((row) => [row.id, row]));
  assert.equal(byId.get("pivot-part")?.passed, false);
  assert.equal(byId.get("pivot-seoul-q1")?.passed, true);
  assert.equal(byId.get("pivot-cogs")?.passed, true);
  assert.equal(byId.get("pivot-sheet")?.passed, true);
  assert.equal(byId.get("pivot-chart")?.passed, true);
});

const pq = getXlsxTask("pq");
assert.ok(pq);

test("pq pass 픽스처는 전부 통과한다", () => {
  const bytes = new Uint8Array(readFileSync("tests/fixtures/learn/pq-pass.xlsx"));
  const graded = gradeWorkbook(pq, bytes);
  assert.equal(graded.status, "passed");
  assert.ok(graded.results.every((row) => row.passed));
  const rows = pq.checks.find((c) => c.id === "pq-rows");
  const first = pq.checks.find((c) => c.id === "pq-first-2023");
  const append = pq.checks.find((c) => c.id === "pq-append-sum");
  assert.ok(rows && rows.kind === "cell-value");
  assert.ok(first && first.kind === "cell-value");
  assert.ok(append && append.kind === "cell-value");
  assert.equal(rows.expected, pqCleanRowCount());
  assert.equal(first.expected, pqFirst2023());
  assert.equal(append.expected, pqAppendSum());
});

test("쿼리 없는 pq 파일은 pq-query만 실패한다", () => {
  const bytes = new Uint8Array(readFileSync("tests/fixtures/learn/pq-fail-query.xlsx"));
  const graded = gradeWorkbook(pq, bytes);
  assert.equal(graded.status, "failed");
  const byId = new Map(graded.results.map((row) => [row.id, row]));
  assert.equal(byId.get("pq-query")?.passed, false);
  assert.equal(byId.get("pq-rows")?.passed, true);
  assert.equal(byId.get("pq-first-2023")?.passed, true);
  assert.equal(byId.get("pq-append-sum")?.passed, true);
});

