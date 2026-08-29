import test from "node:test";
import assert from "node:assert/strict";
import { HyperFormula } from "hyperformula";
import {
  LAB_FUNCTIONS,
  completeFunction,
  formulaFunctionQuery,
  innermostFunction,
  suggestFunctions,
} from "@/lib/spreadsheet/functions";

test("catalog — 모든 이름이 HyperFormula enGB에 있다", () => {
  const registered = new Set(HyperFormula.getRegisteredFunctionNames("enGB"));
  const missing = LAB_FUNCTIONS.map((fn) => fn.name).filter((name) => !registered.has(name));
  assert.deepEqual(missing, []);
  assert.equal(LAB_FUNCTIONS.some((fn) => fn.name === "AVERAGEIFS"), false);
  const names = LAB_FUNCTIONS.map((fn) => fn.name);
  assert.equal(new Set(names).size, names.length);
});

test("formulaFunctionQuery — =su 는 입력 중, =SUM( 는 목록 숨김", () => {
  assert.deepEqual(formulaFunctionQuery("=su"), { query: "su", start: 1 });
  assert.deepEqual(formulaFunctionQuery("=SUM"), { query: "SUM", start: 1 });
  assert.equal(formulaFunctionQuery("=SUM("), null);
  assert.deepEqual(formulaFunctionQuery("="), { query: "", start: 1 });
  assert.deepEqual(formulaFunctionQuery("=IF(su"), { query: "su", start: 4 });
  assert.equal(formulaFunctionQuery("4300"), null);
});

test("suggestFunctions — su 접두면 SUM 계열", () => {
  const names = suggestFunctions("su").map((fn) => fn.name);
  assert.deepEqual(names, ["SUM", "SUMIF", "SUMIFS", "SUBSTITUTE", "SUMPRODUCT"]);
  assert.equal(suggestFunctions("SUM")[0]?.name, "SUM");
});

test("completeFunction — 토큰을 NAME( 로 교체", () => {
  assert.equal(completeFunction("=su", "SUM"), "=SUM(");
  assert.equal(completeFunction("=IF(su", "SUMIF"), "=IF(SUMIF(");
  assert.equal(completeFunction("=", "IF"), "=IF(");
});

test("innermostFunction — 열린 괄호의 안쪽 함수", () => {
  assert.equal(innermostFunction("=SUM("), "SUM");
  assert.equal(innermostFunction("=IF(SUM("), "SUM");
  assert.equal(innermostFunction("=IF(SUM(B2:B4)"), "IF");
  assert.equal(innermostFunction("="), null);
});
