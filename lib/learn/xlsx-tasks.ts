import type { Module, XlsxTask } from "./types";
import { handsFillValue, handsSum } from "./xlsx-hands";
import { pivotSeoulCogs, pivotSeoulQ1 } from "./xlsx-pivot";
import { pqAppendSum, pqCleanRowCount, pqFirst2023 } from "./xlsx-pq";

export const HANDS_CONCEPTS = [
  "nav-ctrl-arrow",
  "nav-ctrl-shift",
  "nav-space",
  "nav-alt-ribbon",
  "nav-f2",
  "nav-format",
  "nav-fill-keys",
  "basic-fn-names",
] as const;

export const PIVOT_CONCEPTS = [
  "pivot-create",
  "pivot-areas",
  "pivot-value",
  "pivot-group",
  "pivot-slicer",
  "pivot-chart",
  "pivot-calc",
] as const;

export const PQ_CONCEPTS = [
  "clean-text-to-columns",
  "clean-dedupe",
  "clean-pq",
  "clean-unpivot",
  "clean-merge-append",
] as const;

export const XLSX_TASKS: XlsxTask[] = [
  {
    id: "hands",
    title: "손: 이동·선택·이름",
    file: "/learn/xlsx/hands-starter.xlsx",
    conceptIds: [...HANDS_CONCEPTS],
    unlock: "always",
    instruction:
      "스타터를 엑셀에서 연다. Ctrl+↓로 Data 마지막 행을 찾고, Ctrl+Shift+↓로 금액을 잡아 SUM 한다. Data!E1을 TaxRate로 이름 정의한 뒤 Output 칸을 채운다. C2에 =B2*$E$1을 넣고 Ctrl+D로 C6까지 채운다. 계산 후 저장해서 제출한다. 단축키를 썼는지는 파일이 증명하지 않는다.",
    checks: [
      { id: "hands-data", kind: "sheet-exists", name: "Data" },
      { id: "hands-last-row", kind: "cell-value", sheet: "Output", addr: "B2", expected: 501 },
      {
        id: "hands-sum",
        kind: "cell-value",
        sheet: "Output",
        addr: "B3",
        expected: handsSum(),
      },
      { id: "hands-sum-formula", kind: "cell-formula", sheet: "Output", addr: "B3", pattern: "SUM" },
      { id: "hands-name", kind: "named-range", name: "TaxRate" },
      { id: "hands-tax-formula", kind: "cell-formula", sheet: "Output", addr: "B4", pattern: "TaxRate" },
      {
        id: "hands-tax-value",
        kind: "cell-value",
        sheet: "Output",
        addr: "B4",
        expected: 90,
      },
      {
        id: "hands-fill",
        kind: "cell-value",
        sheet: "Output",
        addr: "B5",
        expected: handsFillValue(),
        tolerance: 0.005,
      },
    ],
  },
  {
    id: "pivot",
    title: "피벗 한 테이블",
    file: "/learn/xlsx/pivot-starter.xlsx",
    conceptIds: [...PIVOT_CONCEPTS],
    unlock: "after-phase1-cores",
    instruction:
      "스타터를 엑셀에서 연다. Sales로 피벗 테이블을 만들고(Alt+N+V) 새 시트 이름은 Pivot. 행=지역, 열=분기(날짜 그룹), 값=금액 합계. 계산 필드 원가율은 금액×0.6. 피벗 차트 1개를 넣는다. Output B2에 서울 2023Q1 매출, B4에 서울 2023 연간 원가(계산 필드). 슬라이서 상태는 채점하지 않는다. 계산 후 저장해서 제출한다.",
    checks: [
      { id: "pivot-seoul-q1", kind: "cell-value", sheet: "Output", addr: "B2", expected: pivotSeoulQ1() },
      {
        id: "pivot-cogs",
        kind: "cell-value",
        sheet: "Output",
        addr: "B4",
        expected: pivotSeoulCogs(),
        tolerance: 0.005,
      },
      { id: "pivot-sheet", kind: "sheet-exists", name: "Pivot" },
      { id: "pivot-part", kind: "part-exists", part: "pivot" },
      { id: "pivot-chart", kind: "part-exists", part: "chart" },
    ],
  },
  {
    id: "pq",
    title: "정리 + PQ",
    file: "/learn/xlsx/pq-starter.xlsx",
    conceptIds: [...PQ_CONCEPTS],
    unlock: "after-phase1-cores",
    instruction:
      "스타터를 데스크톱 엑셀에서 연다. Raw 이름은 공백을 정리하고 코드-연도는 나눠 중복 1행을 뺀 뒤 연도 열을 Unpivot 한다. Jan과 Feb를 Append 한다. 결과는 Clean 시트. Output B2에 Clean 데이터 행 수(헤더 제외), B3에 첫 키의 2023 값, B4에 Append 합계. 쿼리 없이 숫자만 맞추면 실패한다. Excel Online은 지원하지 않는다.",
    checks: [
      { id: "pq-rows", kind: "cell-value", sheet: "Output", addr: "B2", expected: pqCleanRowCount() },
      { id: "pq-first-2023", kind: "cell-value", sheet: "Output", addr: "B3", expected: pqFirst2023() },
      { id: "pq-append-sum", kind: "cell-value", sheet: "Output", addr: "B4", expected: pqAppendSum() },
      { id: "pq-query", kind: "part-exists", part: "query" },
    ],
  },
];

export function getXlsxTask(id: string): XlsxTask | undefined {
  return XLSX_TASKS.find((task) => task.id === id);
}

export function tasksForModule(mod: Module): XlsxTask[] {
  const ids = new Set(
    mod.concepts.map((concept) => concept.xlsxTaskId).filter((id): id is string => Boolean(id)),
  );
  return XLSX_TASKS.filter((task) => ids.has(task.id));
}
