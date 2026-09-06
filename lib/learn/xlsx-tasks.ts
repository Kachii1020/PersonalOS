import type { Module, XlsxTask } from "./types";
import { handsFillValue, handsSum } from "./xlsx-hands";

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
