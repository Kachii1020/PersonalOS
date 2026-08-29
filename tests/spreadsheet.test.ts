import test from "node:test";
import assert from "node:assert/strict";
import { SheetEngine } from "@/lib/spreadsheet/engine";
import { ALL_LAB_EXERCISES, getExercisesForModule } from "@/lib/spreadsheet/exercises";
import { getExerciseById } from "@/lib/spreadsheet/exercises";

const MODULE_SLUGS = [
  "nav",
  "basic-fn",
  "logic",
  "lookup",
  "pivot",
  "data-clean",
  "fin-fn",
  "model-structure",
  "three-stmt",
  "dcf-intro",
] as const;

const SOLUTIONS: Record<string, { row: number; col: number; formula: string }[]> = {
  "nav-cell-ref": [{ row: 1, col: 2, formula: "=A2*B2" }],
  "basic-fn-sum": [
    { row: 4, col: 1, formula: "=SUM(B2:B4)" },
    { row: 4, col: 2, formula: "=SUM(C2:C4)" },
    { row: 4, col: 3, formula: "=SUM(D2:D4)" },
  ],
  "basic-fn-average": [
    { row: 4, col: 1, formula: "=AVERAGE(B2:B4)" },
    { row: 4, col: 2, formula: "=AVERAGE(C2:C4)" },
    { row: 4, col: 3, formula: "=AVERAGE(D2:D4)" },
  ],
  "basic-fn-count": [
    { row: 6, col: 1, formula: "=COUNT(B2:B6)" },
    { row: 7, col: 1, formula: "=COUNTA(B2:B6)" },
  ],
  "basic-fn-large": [
    { row: 5, col: 1, formula: "=LARGE(B2:B5,1)" },
    { row: 6, col: 1, formula: "=LARGE(B2:B5,2)" },
  ],
  "basic-fn-mixed-ref": [
    { row: 2, col: 2, formula: "=B3*$C$1" },
    { row: 3, col: 2, formula: "=B4*$C$1" },
  ],
  "logic-if": [
    { row: 1, col: 2, formula: '=IF(B2>=70,"합격","불합격")' },
    { row: 2, col: 2, formula: '=IF(B3>=70,"합격","불합격")' },
    { row: 3, col: 2, formula: '=IF(B4>=70,"합격","불합격")' },
    { row: 4, col: 2, formula: '=IF(B5>=70,"합격","불합격")' },
  ],
  "logic-nested-if": [
    { row: 1, col: 2, formula: '=IF(B2>=90,"A",IF(B2>=70,"B",IF(B2>=50,"C","F")))' },
    { row: 2, col: 2, formula: '=IF(B3>=90,"A",IF(B3>=70,"B",IF(B3>=50,"C","F")))' },
    { row: 3, col: 2, formula: '=IF(B4>=90,"A",IF(B4>=70,"B",IF(B4>=50,"C","F")))' },
    { row: 4, col: 2, formula: '=IF(B5>=90,"A",IF(B5>=70,"B",IF(B5>=50,"C","F")))' },
  ],
  "logic-iferror": [{ row: 4, col: 1, formula: '=IFERROR(VLOOKUP(B4,A2:B3,2,0),"없음")' }],
  "logic-sumif": [{ row: 5, col: 1, formula: '=SUMIF(A2:A5,"서울",B2:B5)' }],
  "logic-countifs": [{ row: 5, col: 1, formula: '=COUNTIFS(A2:A5,"서울",B2:B5,"제품")' }],
  "lookup-vlookup": [
    { row: 5, col: 1, formula: "=VLOOKUP(B5,A2:C4,2,0)" },
    { row: 6, col: 1, formula: "=VLOOKUP(B5,A2:C4,3,0)" },
  ],
  "lookup-match": [{ row: 5, col: 1, formula: "=MATCH(B5,A2:A4,0)" }],
  "lookup-index-match": [{ row: 5, col: 1, formula: "=INDEX(C2:C4,MATCH(B5,A2:A4,0))" }],
  "lookup-2d": [
    { row: 6, col: 1, formula: "=INDEX(B2:D4,MATCH(B5,A2:A4,0),MATCH(B6,B1:D1,0))" },
  ],
  "pivot-aggregate": [
    { row: 5, col: 2, formula: '=SUMIFS(C2:C5,A2:A5,"서울",B2:B5,"노트북")' },
  ],
  "clean-trim": [{ row: 1, col: 1, formula: "=TRIM(A2)" }],
  "clean-extract": [
    { row: 2, col: 1, formula: '=LEFT(A2,FIND("-",A2)-1)' },
    { row: 3, col: 1, formula: '=MID(A2,FIND("-",A2)+1,4)' },
    { row: 4, col: 1, formula: "=RIGHT(A2,2)" },
  ],
  "clean-substitute": [{ row: 1, col: 1, formula: '=SUBSTITUTE(A2," Co.","")' }],
  "fin-npv": [{ row: 6, col: 1, formula: "=NPV(B1,B3:B6)" }],
  "fin-irr": [{ row: 5, col: 1, formula: "=IRR(B2:B5)" }],
  "fin-pmt": [{ row: 4, col: 1, formula: "=PMT(B3/12,B4*12,-B2)" }],
  "fin-pvfv": [
    { row: 4, col: 1, formula: "=PV(B3,B4,0,-B2)" },
    { row: 6, col: 1, formula: "=FV(B3/12,B4*12,-B6)" },
  ],
  "fin-rate": [{ row: 4, col: 1, formula: "=RATE(B3,0,-B2,B4)" }],
  "model-assumptions": [
    { row: 4, col: 1, formula: "=B4*(1+B2)" },
    { row: 5, col: 1, formula: "=B5*B3" },
  ],
  "model-balance-check": [
    { row: 4, col: 1, formula: "=B2-B3-B4" },
    { row: 4, col: 2, formula: "=C2-C3-C4" },
  ],
  "stmt-net-income": [{ row: 5, col: 1, formula: "=(B1-B2-B3-B4)*(1-B5)" }],
  "stmt-cf-addback": [{ row: 2, col: 1, formula: "=B1+B2" }],
  "stmt-working-cap": [{ row: 4, col: 1, formula: "=(C2+C3-C4)-(B2+B3-B4)" }],
  "dcf-fcf": [{ row: 2, col: 1, formula: "=B1-B2" }],
  "dcf-discount": [
    { row: 3, col: 1, formula: "=1/(1+B1)^B2" },
    { row: 4, col: 1, formula: "=B3*B4" },
  ],
  "dcf-ev-equity": [{ row: 2, col: 1, formula: "=B1-B2" }],
};

test("registry — 32개 실습, 모듈 10개 전부 커버", () => {
  assert.equal(ALL_LAB_EXERCISES.length, 32);
  const ids = new Set(ALL_LAB_EXERCISES.map((e) => e.id));
  assert.equal(ids.size, 32);
  for (const slug of MODULE_SLUGS) {
    assert.ok(getExercisesForModule(slug).length > 0, `missing labs for ${slug}`);
  }
  assert.equal(getExercisesForModule("nav").length, 1);
  assert.equal(getExercisesForModule("basic-fn").length, 5);
  assert.equal(getExercisesForModule("logic").length, 5);
  assert.equal(getExercisesForModule("lookup").length, 4);
  assert.equal(getExercisesForModule("pivot").length, 1);
  assert.equal(getExercisesForModule("data-clean").length, 3);
  assert.equal(getExercisesForModule("fin-fn").length, 5);
  assert.equal(getExercisesForModule("model-structure").length, 2);
  assert.equal(getExercisesForModule("three-stmt").length, 3);
  assert.equal(getExercisesForModule("dcf-intro").length, 3);
});

test("SUM — =SUM(B2:B4) → 4300", () => {
  const ex = getExerciseById("basic-fn-sum");
  assert.ok(ex);
  const engine = new SheetEngine(ex);
  engine.setInput(4, 1, "=SUM(B2:B4)");
  const cell = engine.getCell(4, 1);
  assert.equal(cell.error, null);
  assert.equal(cell.value, 4300);
  const results = engine.validate(ex.validations.filter((v) => v.cell.col === 1));
  assert.equal(results[0]?.passed, true);
  engine.destroy();
});

test("IF — =IF(B2>=70,\"합격\",\"불합격\") → 합격", () => {
  const ex = getExerciseById("logic-if");
  assert.ok(ex);
  const engine = new SheetEngine(ex);
  engine.setInput(1, 2, '=IF(B2>=70,"합격","불합격")');
  const cell = engine.getCell(1, 2);
  assert.equal(cell.value, "합격");
  engine.destroy();
});

test("PMT — ≈ 2684108", () => {
  const ex = getExerciseById("fin-pmt");
  assert.ok(ex);
  const engine = new SheetEngine(ex);
  engine.setInput(4, 1, "=PMT(B3/12,B4*12,-B2)");
  const cell = engine.getCell(4, 1);
  assert.equal(typeof cell.value, "number");
  assert.ok(Math.abs((cell.value as number) - 2684108.4) <= 1.0);
  const results = engine.validate(ex.validations);
  assert.equal(results[0]?.passed, true);
  engine.destroy();
});

test("값만 입력하면 acceptFormula 실패", () => {
  const ex = getExerciseById("basic-fn-sum");
  assert.ok(ex);
  const engine = new SheetEngine(ex);
  engine.setInput(4, 1, "4300");
  const results = engine.validate(ex.validations.filter((v) => v.cell.col === 1));
  assert.equal(results[0]?.passed, false);
  assert.equal(results[0]?.reason, "formula");
  engine.destroy();
});

for (const ex of ALL_LAB_EXERCISES) {
  test(`정답 수식 통과 — ${ex.id}`, () => {
    const steps = SOLUTIONS[ex.id];
    assert.ok(steps, `missing solution for ${ex.id}`);
    const engine = new SheetEngine(ex);
    for (const step of steps) {
      const computed = engine.setInput(step.row, step.col, step.formula);
      assert.equal(computed.error, null, `${ex.id} ${step.formula} → ${computed.error}`);
    }
    const results = engine.validate(ex.validations);
    const failed = results.filter((r) => !r.passed);
    assert.equal(
      failed.length,
      0,
      failed.map((f) => `${f.cell.row},${f.cell.col} actual=${String(f.actual)} ${f.message}`).join("; "),
    );
    engine.destroy();
  });
}
