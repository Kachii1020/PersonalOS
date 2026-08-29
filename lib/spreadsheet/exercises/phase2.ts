import type { CellDef, LabExerciseDef } from "../types";

function c(value: string | number | null): CellDef {
  return { value };
}

export const PHASE2: LabExerciseDef[] = [
  {
    id: "pivot-aggregate",
    moduleSlug: "pivot",
    title: "SUMIFS로 피벗 결과 재현",
    instruction:
      "C6에 서울·노트북 매출 합계를 SUMIFS로 구하세요. 피벗의 교차 집계와 같은 결과입니다.",
    columnCount: 3,
    rowCount: 6,
    initialGrid: [
      [c("지역"), c("제품"), c("매출")],
      [c("서울"), c("노트북"), c(100)],
      [c("부산"), c("노트북"), c(80)],
      [c("서울"), c("폰"), c(120)],
      [c("서울"), c("노트북"), c(50)],
      [c("서울노트북"), c(""), c(null)],
    ],
    editableCells: [{ row: 5, col: 2 }],
    validations: [
      {
        cell: { row: 5, col: 2 },
        expectedValue: 150,
        acceptFormula: /^=SUMIFS\(/i,
        successMessage: "서울 노트북 150이 맞습니다.",
      },
    ],
    hints: [
      "SUMIFS(합산범위, 조건범위1, 조건1, ...)",
      '=SUMIFS(C2:C5,A2:A5,"서울",B2:B5,"노트북")',
    ],
    difficulty: 2,
  },
  {
    id: "clean-trim",
    moduleSlug: "data-clean",
    title: "TRIM으로 공백 정리",
    instruction: "B2에 A2의 앞뒤·연속 공백을 TRIM으로 정리하세요.",
    columnCount: 2,
    rowCount: 2,
    initialGrid: [
      [c("원본"), c("정리")],
      [c("  Samsung Electronics  "), c(null)],
    ],
    editableCells: [{ row: 1, col: 1 }],
    validations: [
      {
        cell: { row: 1, col: 1 },
        expectedValue: "Samsung Electronics",
        acceptFormula: /^=TRIM\(/i,
        successMessage: "공백이 정리됐습니다.",
      },
    ],
    hints: ["TRIM은 앞뒤 공백과 중간 연속 공백을 정리합니다", "=TRIM(A2)"],
    difficulty: 1,
  },
  {
    id: "clean-extract",
    moduleSlug: "data-clean",
    title: "LEFT / MID / RIGHT로 코드 분해",
    instruction:
      "B3에 티커, B4에 연도, B5에 분기를 LEFT·MID·RIGHT와 FIND로 추출하세요.",
    columnCount: 2,
    rowCount: 5,
    initialGrid: [
      [c("코드"), c("")],
      [c("AAPL-2024-Q3"), c("")],
      [c("티커"), c(null)],
      [c("연도"), c(null)],
      [c("분기"), c(null)],
    ],
    editableCells: [
      { row: 2, col: 1 },
      { row: 3, col: 1 },
      { row: 4, col: 1 },
    ],
    validations: [
      {
        cell: { row: 2, col: 1 },
        expectedValue: "AAPL",
        acceptFormula: /^=LEFT\(/i,
        successMessage: "티커 AAPL이 맞습니다.",
      },
      {
        cell: { row: 3, col: 1 },
        expectedValue: "2024",
        acceptFormula: /^=MID\(/i,
        successMessage: "연도 2024가 맞습니다.",
      },
      {
        cell: { row: 4, col: 1 },
        expectedValue: "Q3",
        acceptFormula: /^=RIGHT\(/i,
        successMessage: "분기 Q3가 맞습니다.",
      },
    ],
    hints: [
      "FIND(\"-\",A2)로 구분 위치를 찾습니다",
      '=LEFT(A2,FIND("-",A2)-1), =MID(A2,FIND("-",A2)+1,4), =RIGHT(A2,2)',
    ],
    difficulty: 2,
  },
  {
    id: "clean-substitute",
    moduleSlug: "data-clean",
    title: "SUBSTITUTE로 접미어 제거",
    instruction: "B2에 \" Co.\"를 제거한 회사명을 SUBSTITUTE로 만드세요.",
    columnCount: 2,
    rowCount: 2,
    initialGrid: [
      [c("원본"), c("정리")],
      [c("Samsung Electronics Co."), c(null)],
    ],
    editableCells: [{ row: 1, col: 1 }],
    validations: [
      {
        cell: { row: 1, col: 1 },
        expectedValue: "Samsung Electronics",
        acceptFormula: /^=SUBSTITUTE\(/i,
        successMessage: "접미어가 제거됐습니다.",
      },
    ],
    hints: ["SUBSTITUTE(텍스트, 찾을값, 바꿀값)", '=SUBSTITUTE(A2," Co.","")'],
    difficulty: 1,
  },
  {
    id: "fin-npv",
    moduleSlug: "fin-fn",
    title: "NPV로 현금흐름 현재가치",
    instruction:
      "B7에 할인율 B1과 1~4년 CF(B3:B6)로 NPV를 구하세요. 초기 투자는 이미 제외된 등간격 CF입니다.",
    columnCount: 2,
    rowCount: 7,
    initialGrid: [
      [c("할인율"), c(0.1)],
      [c("연도"), c("CF")],
      [c(1), c(100)],
      [c(2), c(100)],
      [c(3), c(100)],
      [c(4), c(100)],
      [c("NPV"), c(null)],
    ],
    editableCells: [{ row: 6, col: 1 }],
    validations: [
      {
        cell: { row: 6, col: 1 },
        expectedValue: 316.98654463,
        acceptFormula: /^=NPV\(/i,
        tolerance: 0.01,
        successMessage: "NPV가 맞습니다.",
      },
    ],
    hints: ["NPV(할인율, 현금흐름범위)", "=NPV(B1,B3:B6)"],
    difficulty: 2,
  },
  {
    id: "fin-irr",
    moduleSlug: "fin-fn",
    title: "IRR로 내부수익률",
    instruction: "B6에 B2:B5 현금흐름의 IRR을 구하세요. 결과는 소수(0.097 근처)입니다.",
    columnCount: 2,
    rowCount: 6,
    initialGrid: [
      [c("항목"), c("CF")],
      [c("초기투자"), c(-1000)],
      [c("1년"), c(400)],
      [c("2년"), c(400)],
      [c("3년"), c(400)],
      [c("IRR"), c(null)],
    ],
    editableCells: [{ row: 5, col: 1 }],
    validations: [
      {
        cell: { row: 5, col: 1 },
        expectedValue: 0.097010257403,
        acceptFormula: /^=IRR\(/i,
        tolerance: 0.001,
        successMessage: "IRR이 맞습니다.",
      },
    ],
    hints: ["IRR(현금흐름범위)", "=IRR(B2:B5)"],
    difficulty: 2,
  },
  {
    id: "fin-pmt",
    moduleSlug: "fin-fn",
    title: "PMT로 월 상환액",
    instruction:
      "B5에 월 상환액을 PMT로 구하세요. 월이율=연이율/12, 기간수=년*12, 원금은 부호 규칙상 음수입니다.",
    columnCount: 2,
    rowCount: 5,
    initialGrid: [
      [c("항목"), c("값")],
      [c("대출 원금"), c(500000000)],
      [c("연 이자율"), c(0.05)],
      [c("기간(년)"), c(30)],
      [c("월 상환액"), c(null)],
    ],
    editableCells: [{ row: 4, col: 1 }],
    validations: [
      {
        cell: { row: 4, col: 1 },
        expectedValue: 2684108.4,
        acceptFormula: /^=PMT\(/i,
        tolerance: 1.0,
        successMessage: "월 상환액이 맞습니다.",
      },
    ],
    hints: ["PMT(월이율, 기간수, 현재가치)", "=PMT(B3/12, B4*12, -B2)"],
    difficulty: 2,
  },
  {
    id: "fin-pvfv",
    moduleSlug: "fin-fn",
    title: "PV와 FV",
    instruction:
      "B5에 10년 후 1천만 원의 현재가치(PV), B7에 월 10만 원 적립의 10년 후 미래가치(FV)를 구하세요.",
    columnCount: 2,
    rowCount: 7,
    initialGrid: [
      [c("항목"), c("값")],
      [c("미래가치"), c(10000000)],
      [c("연 이자율"), c(0.05)],
      [c("기간(년)"), c(10)],
      [c("현재가치"), c(null)],
      [c("월 적립"), c(100000)],
      [c("10년 FV"), c(null)],
    ],
    editableCells: [
      { row: 4, col: 1 },
      { row: 6, col: 1 },
    ],
    validations: [
      {
        cell: { row: 4, col: 1 },
        expectedValue: 6139132.5354,
        acceptFormula: /^=PV\(/i,
        tolerance: 1.0,
        successMessage: "현재가치가 맞습니다.",
      },
      {
        cell: { row: 6, col: 1 },
        expectedValue: 15528227.945,
        acceptFormula: /^=FV\(/i,
        tolerance: 1.0,
        successMessage: "미래가치가 맞습니다.",
      },
    ],
    hints: [
      "PV(이율, 기간, 납입, -미래가치)",
      "=PV(B3,B4,0,-B2) 그리고 =FV(B3/12,B4*12,-B6)",
    ],
    difficulty: 3,
  },
  {
    id: "fin-rate",
    moduleSlug: "fin-fn",
    title: "RATE로 연 수익률",
    instruction: "B5에 5년 만에 1천만 원이 12,762,816원이 되는 연 수익률을 RATE로 구하세요.",
    columnCount: 2,
    rowCount: 5,
    initialGrid: [
      [c("항목"), c("값")],
      [c("현재가치"), c(10000000)],
      [c("기간(년)"), c(5)],
      [c("미래가치"), c(12762816)],
      [c("연 수익률"), c(null)],
    ],
    editableCells: [{ row: 4, col: 1 }],
    validations: [
      {
        cell: { row: 4, col: 1 },
        expectedValue: 0.05,
        acceptFormula: /^=RATE\(/i,
        tolerance: 0.0001,
        successMessage: "연 5%가 맞습니다.",
      },
    ],
    hints: ["RATE(기간, 납입, -현재가치, 미래가치)", "=RATE(B3,0,-B2,B4)"],
    difficulty: 2,
  },
];
