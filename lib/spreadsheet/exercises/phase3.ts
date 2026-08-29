import type { CellDef, LabExerciseDef } from "../types";

function c(value: string | number | null): CellDef {
  return { value };
}

export const PHASE3: LabExerciseDef[] = [
  {
    id: "model-assumptions",
    moduleSlug: "model-structure",
    title: "Assumptions 참조로 내년 실적",
    instruction:
      "B5에 내년 매출, B6에 내년 원가를 구하세요. 성장률·원가율은 Assumptions(B2, B3)를 참조하고 1.15처럼 하드코딩하지 마세요.",
    columnCount: 2,
    rowCount: 6,
    initialGrid: [
      [c("Assumptions"), c("")],
      [c("매출성장률"), c(0.15)],
      [c("원가율"), c(0.6)],
      [c("올해 매출"), c(1000)],
      [c("내년 매출"), c(null)],
      [c("내년 원가"), c(null)],
    ],
    editableCells: [
      { row: 4, col: 1 },
      { row: 5, col: 1 },
    ],
    validations: [
      {
        cell: { row: 4, col: 1 },
        expectedValue: 1150,
        acceptFormula: /B2/,
        successMessage: "내년 매출이 Assumptions를 참조합니다.",
      },
      {
        cell: { row: 5, col: 1 },
        expectedValue: 690,
        acceptFormula: /B3/,
        successMessage: "내년 원가가 원가율을 참조합니다.",
      },
    ],
    hints: ["가정은 셀 참조로만 가져옵니다", "=B4*(1+B2) 그리고 =B5*B3"],
    difficulty: 2,
  },
  {
    id: "model-balance-check",
    moduleSlug: "model-structure",
    title: "BS 밸런스 체크",
    instruction: "B5와 C5에 자산-부채-자본을 넣어 0이 되는지 확인하세요.",
    columnCount: 3,
    rowCount: 5,
    initialGrid: [
      [c("항목"), c(2023), c(2024)],
      [c("자산"), c(500), c(520)],
      [c("부채"), c(200), c(210)],
      [c("자본"), c(300), c(310)],
      [c("체크"), c(null), c(null)],
    ],
    editableCells: [
      { row: 4, col: 1 },
      { row: 4, col: 2 },
    ],
    validations: [
      {
        cell: { row: 4, col: 1 },
        expectedValue: 0,
        acceptFormula: /^=/,
        successMessage: "2023 밸런스가 맞습니다.",
      },
      {
        cell: { row: 4, col: 2 },
        expectedValue: 0,
        acceptFormula: /^=/,
        successMessage: "2024 밸런스가 맞습니다.",
      },
    ],
    hints: ["자산 − 부채 − 자본 = 0", "=B2-B3-B4"],
    difficulty: 1,
  },
  {
    id: "stmt-net-income",
    moduleSlug: "three-stmt",
    title: "IS 순이익",
    instruction:
      "B6에 순이익을 구하세요. (매출-COGS-판관비-이자)×(1-세율)입니다.",
    columnCount: 2,
    rowCount: 6,
    initialGrid: [
      [c("매출"), c(1000)],
      [c("COGS"), c(600)],
      [c("판관비"), c(150)],
      [c("이자"), c(20)],
      [c("세율"), c(0.25)],
      [c("순이익"), c(null)],
    ],
    editableCells: [{ row: 5, col: 1 }],
    validations: [
      {
        cell: { row: 5, col: 1 },
        expectedValue: 172.5,
        acceptFormula: /^=/,
        successMessage: "순이익 172.5가 맞습니다.",
      },
    ],
    hints: ["세전이익에 (1-세율)을 곱합니다", "=(B1-B2-B3-B4)*(1-B5)"],
    difficulty: 2,
  },
  {
    id: "stmt-cf-addback",
    moduleSlug: "three-stmt",
    title: "CF 감가상각 가산",
    instruction:
      "B3에 간접법 영업CF의 출발점(순이익+감가상각)을 구하세요. 감가상각은 현금유출이 아닙니다.",
    columnCount: 2,
    rowCount: 3,
    initialGrid: [
      [c("순이익"), c(172.5)],
      [c("감가상각"), c(40)],
      [c("영업CF"), c(null)],
    ],
    editableCells: [{ row: 2, col: 1 }],
    validations: [
      {
        cell: { row: 2, col: 1 },
        expectedValue: 212.5,
        acceptFormula: /^=/,
        successMessage: "감가상각 가산이 맞습니다.",
      },
    ],
    hints: ["IS에서 빠진 비현금 비용을 더합니다", "=B1+B2"],
    difficulty: 1,
  },
  {
    id: "stmt-working-cap",
    moduleSlug: "three-stmt",
    title: "운전자본 변동",
    instruction:
      "B5에 ΔNWC = (당년 매출채권+재고-매입채무) − (전년 동일)을 구하세요. 증가분은 영업CF에서 차감됩니다.",
    columnCount: 3,
    rowCount: 5,
    initialGrid: [
      [c("항목"), c("전년"), c("당년")],
      [c("매출채권"), c(100), c(130)],
      [c("재고"), c(80), c(70)],
      [c("매입채무"), c(50), c(60)],
      [c("ΔNWC"), c(null), c("")],
    ],
    editableCells: [{ row: 4, col: 1 }],
    validations: [
      {
        cell: { row: 4, col: 1 },
        expectedValue: 10,
        acceptFormula: /^=/,
        successMessage: "운전자본 증가 10이 맞습니다.",
      },
    ],
    hints: [
      "NWC = 매출채권 + 재고 − 매입채무",
      "=(C2+C3-C4)-(B2+B3-B4)",
    ],
    difficulty: 2,
  },
  {
    id: "dcf-fcf",
    moduleSlug: "dcf-intro",
    title: "FCF 계산",
    instruction: "B3에 잉여현금흐름(영업CF − Capex)을 구하세요.",
    columnCount: 2,
    rowCount: 3,
    initialGrid: [
      [c("영업CF"), c(200)],
      [c("Capex"), c(50)],
      [c("FCF"), c(null)],
    ],
    editableCells: [{ row: 2, col: 1 }],
    validations: [
      {
        cell: { row: 2, col: 1 },
        expectedValue: 150,
        acceptFormula: /^=/,
        successMessage: "FCF 150이 맞습니다.",
      },
    ],
    hints: ["FCF = 영업CF − Capex", "=B1-B2"],
    difficulty: 1,
  },
  {
    id: "dcf-discount",
    moduleSlug: "dcf-intro",
    title: "할인계수와 현재가치",
    instruction: "B4에 1년차 할인계수 1/(1+WACC)^n, B5에 FCF의 현재가치를 구하세요.",
    columnCount: 2,
    rowCount: 5,
    initialGrid: [
      [c("WACC"), c(0.1)],
      [c("연도"), c(1)],
      [c("FCF"), c(150)],
      [c("할인계수"), c(null)],
      [c("PV(FCF)"), c(null)],
    ],
    editableCells: [
      { row: 3, col: 1 },
      { row: 4, col: 1 },
    ],
    validations: [
      {
        cell: { row: 3, col: 1 },
        expectedValue: 0.909090909,
        acceptFormula: /^=/,
        tolerance: 0.001,
        successMessage: "할인계수가 맞습니다.",
      },
      {
        cell: { row: 4, col: 1 },
        expectedValue: 136.363636,
        acceptFormula: /^=/,
        tolerance: 0.01,
        successMessage: "FCF 현재가치가 맞습니다.",
      },
    ],
    hints: ["할인계수 = 1/(1+WACC)^연도", "=1/(1+B1)^B2 그리고 =B3*B4"],
    difficulty: 2,
  },
  {
    id: "dcf-ev-equity",
    moduleSlug: "dcf-intro",
    title: "EV에서 Equity Value",
    instruction: "B3에 Equity Value = EV − 순차입금을 구하세요.",
    columnCount: 2,
    rowCount: 3,
    initialGrid: [
      [c("Enterprise Value"), c(5000)],
      [c("순차입금"), c(1200)],
      [c("Equity Value"), c(null)],
    ],
    editableCells: [{ row: 2, col: 1 }],
    validations: [
      {
        cell: { row: 2, col: 1 },
        expectedValue: 3800,
        acceptFormula: /^=/,
        successMessage: "Equity Value 3800이 맞습니다.",
      },
    ],
    hints: ["주주 몫은 EV에서 순부채를 뺍니다", "=B1-B2"],
    difficulty: 1,
  },
];
