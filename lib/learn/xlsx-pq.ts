/** pq 스타터 숫자. 생성 스크립트와 채점이 같은 함수를 쓴다. */

export type PqRawRow = {
  name: string;
  codeYear: string;
  y2022: number;
  y2023: number;
  y2024: number;
};

export type PqMonthRow = {
  name: string;
  amount: number;
};

export const PQ_YEARS = [2022, 2023, 2024] as const;
export const PQ_MONTH_ROWS = 10;

/** 앞뒤 공백이 있는 이름. 마지막에 첫 행을 한 번 더 붙여 중복 1행을 만든다. */
export const PQ_RAW_UNIQUE: readonly PqRawRow[] = [
  { name: "  Alpha  ", codeYear: "K01-X", y2022: 10, y2023: 20, y2024: 30 },
  { name: " Beta", codeYear: "K02-X", y2022: 11, y2023: 21, y2024: 31 },
  { name: "Gamma  ", codeYear: "K03-X", y2022: 12, y2023: 22, y2024: 32 },
  { name: "  Delta", codeYear: "K04-X", y2022: 13, y2023: 23, y2024: 33 },
  { name: " Epsilon ", codeYear: "K05-X", y2022: 14, y2023: 24, y2024: 34 },
  { name: "Zeta", codeYear: "K06-X", y2022: 15, y2023: 25, y2024: 35 },
];

export function pqRawRows(): PqRawRow[] {
  return [...PQ_RAW_UNIQUE, PQ_RAW_UNIQUE[0]];
}

export function pqTrimName(name: string): string {
  return name.trim();
}

export function pqSplitCode(codeYear: string): { code: string; suffix: string } {
  const [code, suffix = ""] = codeYear.split("-");
  return { code, suffix };
}

/** 중복 1행 제거 후 연도 Unpivot. 헤더 제외. */
export function pqCleanRowCount(): number {
  return PQ_RAW_UNIQUE.length * PQ_YEARS.length;
}

/** Raw 첫 키(공백 제거 후)의 2023 값. */
export function pqFirst2023(): number {
  return PQ_RAW_UNIQUE[0].y2023;
}

export function pqJanRows(): PqMonthRow[] {
  return Array.from({ length: PQ_MONTH_ROWS }, (_, i) => ({
    name: `J${String(i + 1).padStart(2, "0")}`,
    amount: (i + 1) * 10,
  }));
}

export function pqFebRows(): PqMonthRow[] {
  return Array.from({ length: PQ_MONTH_ROWS }, (_, i) => ({
    name: `F${String(i + 1).padStart(2, "0")}`,
    amount: (i + 1) * 7,
  }));
}

export function pqAppendSum(): number {
  const jan = pqJanRows().reduce((sum, row) => sum + row.amount, 0);
  const feb = pqFebRows().reduce((sum, row) => sum + row.amount, 0);
  return jan + feb;
}

export function pqCleanRows(): {
  name: string;
  code: string;
  suffix: string;
  year: number;
  value: number;
}[] {
  return PQ_RAW_UNIQUE.flatMap((row) => {
    const { code, suffix } = pqSplitCode(row.codeYear);
    const name = pqTrimName(row.name);
    return [
      { name, code, suffix, year: 2022, value: row.y2022 },
      { name, code, suffix, year: 2023, value: row.y2023 },
      { name, code, suffix, year: 2024, value: row.y2024 },
    ];
  });
}
