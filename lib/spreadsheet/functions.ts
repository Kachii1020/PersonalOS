export type LabFunction = {
  name: string;
  syntax: string;
  hint: string;
};

/** HyperFormula이 계산하고 커리큘럼에서 쓰는 함수만. AVERAGEIFS는 엔진에 없다. */
export const LAB_FUNCTIONS: LabFunction[] = [
  { name: "ABS", syntax: "ABS(number)", hint: "절댓값" },
  { name: "AND", syntax: "AND(logical1, [logical2], …)", hint: "모두 참이면 TRUE" },
  { name: "AVERAGE", syntax: "AVERAGE(number1, [number2], …)", hint: "평균" },
  { name: "AVERAGEIF", syntax: "AVERAGEIF(range, criteria, [average_range])", hint: "조건 평균" },
  { name: "CLEAN", syntax: "CLEAN(text)", hint: "인쇄 불가 문자 제거" },
  { name: "COUNT", syntax: "COUNT(value1, [value2], …)", hint: "숫자 개수" },
  { name: "COUNTA", syntax: "COUNTA(value1, [value2], …)", hint: "비어 있지 않은 셀" },
  { name: "COUNTBLANK", syntax: "COUNTBLANK(range)", hint: "빈 셀 개수" },
  { name: "COUNTIF", syntax: "COUNTIF(range, criteria)", hint: "조건 개수" },
  { name: "COUNTIFS", syntax: "COUNTIFS(range1, criteria1, …)", hint: "복수 조건 개수" },
  { name: "FIND", syntax: "FIND(find_text, within_text, [start])", hint: "문자열 위치" },
  { name: "FV", syntax: "FV(rate, nper, pmt, [pv], [type])", hint: "미래가치" },
  { name: "HLOOKUP", syntax: "HLOOKUP(lookup, table, row_index, [range_lookup])", hint: "가로 조회" },
  { name: "IF", syntax: "IF(logical_test, value_if_true, [value_if_false])", hint: "조건 분기" },
  { name: "IFERROR", syntax: "IFERROR(value, value_if_error)", hint: "에러 대체" },
  { name: "IFNA", syntax: "IFNA(value, value_if_na)", hint: "#N/A 대체" },
  { name: "IFS", syntax: "IFS(test1, value1, [test2, value2], …)", hint: "여러 조건" },
  { name: "INDEX", syntax: "INDEX(array, row_num, [column_num])", hint: "위치의 값" },
  { name: "IPMT", syntax: "IPMT(rate, per, nper, pv, [fv], [type])", hint: "이자 상환분" },
  { name: "IRR", syntax: "IRR(values, [guess])", hint: "내부수익률" },
  { name: "LARGE", syntax: "LARGE(array, k)", hint: "k번째로 큰 값" },
  { name: "LEFT", syntax: "LEFT(text, [num_chars])", hint: "왼쪽 문자" },
  { name: "LEN", syntax: "LEN(text)", hint: "문자 수" },
  { name: "MATCH", syntax: "MATCH(lookup_value, lookup_array, [match_type])", hint: "위치 찾기" },
  { name: "MAX", syntax: "MAX(number1, [number2], …)", hint: "최댓값" },
  { name: "MID", syntax: "MID(text, start_num, num_chars)", hint: "중간 문자" },
  { name: "MIN", syntax: "MIN(number1, [number2], …)", hint: "최솟값" },
  { name: "NOT", syntax: "NOT(logical)", hint: "논리 반전" },
  { name: "NPER", syntax: "NPER(rate, pmt, pv, [fv], [type])", hint: "기간 수" },
  { name: "NPV", syntax: "NPV(rate, value1, [value2], …)", hint: "순현재가치" },
  { name: "OR", syntax: "OR(logical1, [logical2], …)", hint: "하나라도 참이면 TRUE" },
  { name: "PMT", syntax: "PMT(rate, nper, pv, [fv], [type])", hint: "상환액" },
  { name: "PPMT", syntax: "PPMT(rate, per, nper, pv, [fv], [type])", hint: "원금 상환분" },
  { name: "PV", syntax: "PV(rate, nper, pmt, [fv], [type])", hint: "현재가치" },
  { name: "RATE", syntax: "RATE(nper, pmt, pv, [fv], [type], [guess])", hint: "이율" },
  { name: "RIGHT", syntax: "RIGHT(text, [num_chars])", hint: "오른쪽 문자" },
  { name: "ROUND", syntax: "ROUND(number, num_digits)", hint: "반올림" },
  { name: "SMALL", syntax: "SMALL(array, k)", hint: "k번째로 작은 값" },
  { name: "SUBSTITUTE", syntax: "SUBSTITUTE(text, old, new, [instance])", hint: "문자열 치환" },
  { name: "SUM", syntax: "SUM(number1, [number2], …)", hint: "합계" },
  { name: "SUMIF", syntax: "SUMIF(range, criteria, [sum_range])", hint: "조건 합계" },
  { name: "SUMIFS", syntax: "SUMIFS(sum_range, range1, criteria1, …)", hint: "복수 조건 합계" },
  { name: "SUMPRODUCT", syntax: "SUMPRODUCT(array1, [array2], …)", hint: "곱의 합" },
  { name: "TRIM", syntax: "TRIM(text)", hint: "여분 공백 제거" },
  { name: "VLOOKUP", syntax: "VLOOKUP(lookup, table, col_index, [range_lookup])", hint: "세로 조회" },
  { name: "XIRR", syntax: "XIRR(values, dates, [guess])", hint: "날짜 기반 IRR" },
  { name: "XLOOKUP", syntax: "XLOOKUP(lookup, lookup_array, return_array, …)", hint: "양방향 조회" },
  { name: "XNPV", syntax: "XNPV(rate, values, dates)", hint: "날짜 기반 NPV" },
];

const NAME_SET = new Set(LAB_FUNCTIONS.map((fn) => fn.name));

const AFTER_BOUNDARY = /[=(\,\+\-\*\/\&]$/;

export function getLabFunction(name: string): LabFunction | undefined {
  return LAB_FUNCTIONS.find((fn) => fn.name === name.toUpperCase());
}

/** 수식 끝에서 입력 중인 함수명. `=SUM(`처럼 괄호가 열리면 null(목록 숨김). */
export function formulaFunctionQuery(formula: string): { query: string; start: number } | null {
  if (!formula.startsWith("=")) return null;
  if (formula.endsWith("(")) return null;

  const token = formula.match(/([A-Za-z][A-Za-z0-9]*)$/);
  if (token && token.index !== undefined) {
    const before = formula.slice(0, token.index);
    if (before === "" || AFTER_BOUNDARY.test(before)) {
      return { query: token[1], start: token.index };
    }
    return null;
  }

  if (formula === "=" || AFTER_BOUNDARY.test(formula)) {
    return { query: "", start: formula.length };
  }
  return null;
}

export function suggestFunctions(query: string): LabFunction[] {
  const q = query.toUpperCase();
  return LAB_FUNCTIONS.filter((fn) => fn.name.startsWith(q)).sort((a, b) => {
    if (a.name === q) return -1;
    if (b.name === q) return 1;
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return a.name.localeCompare(b.name);
  });
}

export function completeFunction(formula: string, name: string): string {
  const canon = name.toUpperCase();
  if (!NAME_SET.has(canon)) return formula;
  const q = formulaFunctionQuery(formula);
  if (!q) return formula;
  return `${formula.slice(0, q.start)}${canon}(`;
}

export function innermostFunction(formula: string): string | null {
  const stack: string[] = [];
  let i = 0;
  while (i < formula.length) {
    const match = formula.slice(i).match(/^([A-Za-z][A-Za-z0-9]*)\(/);
    if (match) {
      stack.push(match[1].toUpperCase());
      i += match[0].length;
      continue;
    }
    if (formula[i] === ")") stack.pop();
    i += 1;
  }
  return stack[stack.length - 1] ?? null;
}
