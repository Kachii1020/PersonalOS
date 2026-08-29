import test from "node:test";
import assert from "node:assert/strict";
import { SheetEngine } from "@/lib/spreadsheet/engine";
import {
  cellsBetween,
  insertRangeRef,
  isFormulaPointing,
  lockToAxis,
  rangeAddress,
  splitFormulaRef,
} from "@/lib/spreadsheet/formula-edit";
import { getExerciseById } from "@/lib/spreadsheet/exercises";

test("insertRangeRef — =SUM( 뒤에 범위", () => {
  assert.equal(insertRangeRef("=SUM(", "B2:B4"), "=SUM(B2:B4");
});

test("insertRangeRef — 닫는 괄호가 있으면 범위만 교체", () => {
  assert.equal(insertRangeRef("=SUM(B2:B4)", "C2:C4"), "=SUM(C2:C4)");
  assert.equal(insertRangeRef("=SUM(B2:B4", "C2:C4"), "=SUM(C2:C4");
});

test("insertRangeRef — 연산자 뒤 마지막 참조 교체", () => {
  assert.equal(insertRangeRef("=A2*", "B2"), "=A2*B2");
  assert.equal(insertRangeRef("=A2*B2", "C2"), "=A2*C2");
});

test("insertRangeRef — = 만 있으면 단일 셀", () => {
  assert.equal(insertRangeRef("=", "B2"), "=B2");
});

test("splitFormulaRef — 함수명만 있으면 통째로 prefix", () => {
  assert.deepEqual(splitFormulaRef("=SUM"), { prefix: "=SUM", suffix: "" });
  assert.equal(insertRangeRef("=SUM", "B2"), "=SUMB2");
});

test("rangeAddress — 방향과 무관하게 좌상:우하", () => {
  assert.equal(rangeAddress({ row: 1, col: 1 }, { row: 3, col: 1 }), "B2:B4");
  assert.equal(rangeAddress({ row: 3, col: 1 }, { row: 1, col: 1 }), "B2:B4");
  assert.equal(rangeAddress({ row: 1, col: 1 }, { row: 1, col: 1 }), "B2");
  assert.equal(rangeAddress({ row: 1, col: 1 }, { row: 3, col: 3 }), "B2:D4");
});

test("lockToAxis — 더 긴 축으로 고정", () => {
  assert.deepEqual(lockToAxis({ row: 4, col: 1 }, { row: 4, col: 3 }), { row: 4, col: 3 });
  assert.deepEqual(lockToAxis({ row: 4, col: 1 }, { row: 1, col: 2 }), { row: 1, col: 1 });
});

test("cellsBetween — 축 구간", () => {
  assert.deepEqual(cellsBetween({ row: 4, col: 1 }, { row: 4, col: 3 }), [
    { row: 4, col: 1 },
    { row: 4, col: 2 },
    { row: 4, col: 3 },
  ]);
});

test("isFormulaPointing — = 로 시작하고 수식바에 포커스일 때만", () => {
  assert.equal(isFormulaPointing("=SUM(", true), true);
  assert.equal(isFormulaPointing("=SUM(", false), false);
  assert.equal(isFormulaPointing("", true), false);
  assert.equal(isFormulaPointing("4300", true), false);
});

test("fill — SUM을 B5에서 C5:D5로 끌면 상대참조", () => {
  const ex = getExerciseById("basic-fn-sum");
  assert.ok(ex);
  const engine = new SheetEngine(ex);
  engine.setInput(4, 1, "=SUM(B2:B4)");
  engine.fill({ row: 4, col: 1 }, [
    { row: 4, col: 2 },
    { row: 4, col: 3 },
  ]);
  assert.equal(engine.getCell(4, 2).formula, "=SUM(C2:C4)");
  assert.equal(engine.getCell(4, 3).formula, "=SUM(D2:D4)");
  const results = engine.validate(ex.validations);
  assert.equal(results.every((r) => r.passed), true);
  engine.destroy();
});

test("fill — $C$1 절대참조는 유지", () => {
  const ex = getExerciseById("basic-fn-mixed-ref");
  assert.ok(ex);
  const engine = new SheetEngine(ex);
  engine.setInput(2, 2, "=B3*$C$1");
  engine.fill({ row: 2, col: 2 }, [{ row: 3, col: 2 }]);
  assert.equal(engine.getCell(3, 2).formula, "=B4*$C$1");
  const results = engine.validate(ex.validations);
  assert.equal(results.every((r) => r.passed), true);
  engine.destroy();
});
