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
  "basic-fn-min": [{ row: 5, col: 1, formula: "=MIN(B2:B5)" }],
  "basic-fn-max": [{ row: 5, col: 1, formula: "=MAX(B2:B5)" }],
  "basic-fn-small": [
    { row: 5, col: 1, formula: "=SMALL(B2:B5,1)" },
    { row: 6, col: 1, formula: "=SMALL(B2:B5,2)" },
  ],
  "basic-fn-small-k3": [{ row: 5, col: 1, formula: "=SMALL(B2:B5,3)" }],
  "basic-fn-countblank": [{ row: 6, col: 1, formula: "=COUNTBLANK(B2:B6)" }],
  "basic-fn-countblank-mixed": [{ row: 5, col: 1, formula: "=COUNTBLANK(A1:A5)" }],
  "logic-and": [
    { row: 1, col: 2, formula: '=IF(AND(A2="서울",B2>=100),"승인","보류")' },
    { row: 2, col: 2, formula: '=IF(AND(A3="서울",B3>=100),"승인","보류")' },
    { row: 3, col: 2, formula: '=IF(AND(A4="서울",B4>=100),"승인","보류")' },
  ],
  "logic-or": [
    { row: 1, col: 2, formula: '=IF(OR(A2="서울",B2>=100),"검토","대기")' },
    { row: 2, col: 2, formula: '=IF(OR(A3="서울",B3>=100),"검토","대기")' },
    { row: 3, col: 2, formula: '=IF(OR(A4="서울",B4>=100),"검토","대기")' },
  ],
  "logic-and-or": [
    { row: 1, col: 2, formula: '=IF(AND(OR(A2="서울",A2="부산"),B2>=100),"승인","보류")' },
    { row: 2, col: 2, formula: '=IF(AND(OR(A3="서울",A3="부산"),B3>=100),"승인","보류")' },
    { row: 3, col: 2, formula: '=IF(AND(OR(A4="서울",A4="부산"),B4>=100),"승인","보류")' },
  ],
  "logic-not": [
    { row: 1, col: 2, formula: '=IF(NOT(B2="N"),"진행","중단")' },
    { row: 2, col: 2, formula: '=IF(NOT(B3="N"),"진행","중단")' },
    { row: 3, col: 2, formula: '=IF(NOT(B4="N"),"진행","중단")' },
  ],
  "logic-and-3": [
    { row: 1, col: 3, formula: '=IF(AND(A2="서울",B2="제품",C2>=100),"통과","보류")' },
    { row: 2, col: 3, formula: '=IF(AND(A3="서울",B3="제품",C3>=100),"통과","보류")' },
  ],
  "logic-or-3": [
    { row: 1, col: 2, formula: '=IF(OR(A2="서울",A2="부산",A2="인천"),"권역","기타")' },
    { row: 2, col: 2, formula: '=IF(OR(A3="서울",A3="부산",A3="인천"),"권역","기타")' },
    { row: 3, col: 2, formula: '=IF(OR(A4="서울",A4="부산",A4="인천"),"권역","기타")' },
  ],
  "logic-ifs": [
    { row: 1, col: 2, formula: '=IFS(B2>=90,"A",B2>=70,"B",B2>=50,"C",B2>=0,"F")' },
    { row: 2, col: 2, formula: '=IFS(B3>=90,"A",B3>=70,"B",B3>=50,"C",B3>=0,"F")' },
    { row: 3, col: 2, formula: '=IFS(B4>=90,"A",B4>=70,"B",B4>=50,"C",B4>=0,"F")' },
    { row: 4, col: 2, formula: '=IFS(B5>=90,"A",B5>=70,"B",B5>=50,"C",B5>=0,"F")' },
  ],
  "logic-ifs-flag": [
    { row: 1, col: 2, formula: '=IFS(B2>=0.2,"Upside",B2>=0,"Base",B2<0,"Down")' },
    { row: 2, col: 2, formula: '=IFS(B3>=0.2,"Upside",B3>=0,"Base",B3<0,"Down")' },
    { row: 3, col: 2, formula: '=IFS(B4>=0.2,"Upside",B4>=0,"Base",B4<0,"Down")' },
  ],
  "logic-ifs-pass": [{ row: 4, col: 1, formula: '=IFS(B4>=70,"합격",B4>=0,"불합격")' }],
  "logic-ifna": [{ row: 4, col: 1, formula: '=IFNA(VLOOKUP(B4,A2:B3,2,0),"없음")' }],
  "logic-ifna-hit": [{ row: 4, col: 1, formula: '=IFNA(VLOOKUP(B4,A2:B3,2,0),"없음")' }],
  "logic-sumifs": [{ row: 5, col: 2, formula: '=SUMIFS(C2:C5,A2:A5,"서울",B2:B5,"제품")' }],
  "logic-sumifs-3": [{ row: 5, col: 3, formula: '=SUMIFS(D2:D5,A2:A5,"서울",B2:B5,"노트북",C2:C5,2024)' }],
  "logic-sumifs-gte": [{ row: 5, col: 2, formula: '=SUMIFS(C2:C5,A2:A5,"서울",C2:C5,">="&100)' }],
  "logic-averageif": [{ row: 5, col: 1, formula: '=AVERAGEIF(A2:A5,"서울",B2:B5)' }],
  "logic-averageif-gte": [{ row: 5, col: 1, formula: '=AVERAGEIF(A2:A5,">=100")' }],
  "logic-sumproduct": [{ row: 4, col: 1, formula: "=SUMPRODUCT(A2:A4,B2:B4)" }],
  "logic-sumproduct-qty": [{ row: 5, col: 1, formula: "=SUMPRODUCT(A2:A5,B2:B5)" }],
  "logic-countif": [{ row: 5, col: 1, formula: '=COUNTIF(A2:A5,"서울")' }],
  "lookup-xlookup": [{ row: 5, col: 1, formula: "=XLOOKUP(B5,A2:A4,C2:C4)" }],
  "lookup-xlookup-left": [{ row: 5, col: 1, formula: "=XLOOKUP(B5,B2:B4,A2:A4)" }],
  "lookup-xlookup-missing": [{ row: 5, col: 1, formula: '=XLOOKUP(B5,A2:A4,B2:B4,"없음")' }],
  "fin-xnpv": [{ row: 6, col: 1, formula: "=XNPV(B1,A3:A6,B3:B6)" }],
  "fin-xnpv-uneven": [{ row: 6, col: 1, formula: "=XNPV(B1,A3:A6,B3:B6)" }],
  "fin-xnpv-12": [{ row: 6, col: 1, formula: "=XNPV(B1,A3:A6,B3:B6)" }],
  "fin-xirr": [{ row: 6, col: 1, formula: "=XIRR(A3:A6,B3:B6)" }],
  "fin-xirr-uneven": [{ row: 5, col: 1, formula: "=XIRR(A2:A5,B2:B5)" }],
  "fin-ipmt": [{ row: 4, col: 1, formula: "=IPMT(B3/12,1,B4*12,-B2)" }],
  "fin-ipmt-12": [{ row: 4, col: 1, formula: "=IPMT(B3/12,12,B4*12,-B2)" }],
  "fin-ipmt-last": [{ row: 4, col: 1, formula: "=IPMT(B3/12,360,B4*12,-B2)" }],
  "fin-ppmt": [{ row: 4, col: 1, formula: "=PPMT(B3/12,1,B4*12,-B2)" }],
  "fin-ppmt-12": [{ row: 4, col: 1, formula: "=PPMT(B3/12,12,B4*12,-B2)" }],
  "fin-nper": [{ row: 4, col: 1, formula: "=NPER(B3,0,-B2,B4)" }],
  "fin-nper-pmt": [{ row: 4, col: 1, formula: "=NPER(B3/12,-B2,0,B4)" }],
};

test("registry — 72개 실습, 피벗·PQ lab은 늘리지 않음", () => {
  assert.equal(ALL_LAB_EXERCISES.length, 72);
  const ids = new Set(ALL_LAB_EXERCISES.map((e) => e.id));
  assert.equal(ids.size, 72);
  for (const slug of MODULE_SLUGS) {
    assert.ok(getExercisesForModule(slug).length > 0, `missing labs for ${slug}`);
  }
  assert.equal(getExercisesForModule("nav").length, 1);
  assert.equal(getExercisesForModule("basic-fn").length, 11);
  assert.equal(getExercisesForModule("logic").length, 24);
  assert.equal(getExercisesForModule("lookup").length, 7);
  assert.equal(getExercisesForModule("pivot").length, 1);
  assert.equal(getExercisesForModule("data-clean").length, 3);
  assert.equal(getExercisesForModule("fin-fn").length, 17);
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
