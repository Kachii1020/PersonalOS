import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gradeWorkbook } from "@/lib/integrations/xlsx/grade";
import { getXlsxTask } from "@/lib/learn/xlsx-tasks";
import { handsSum } from "@/lib/learn/xlsx-hands";

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
