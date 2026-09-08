/** pivot 스타터 숫자. 생성 스크립트와 채점이 같은 함수를 쓴다. */

export const PIVOT_REGIONS = ["서울", "부산", "대구"] as const;
export const PIVOT_PRODUCTS = ["알파", "베타", "감마"] as const;
export const PIVOT_MONTHS = 24;
export const PIVOT_ROWS_PER_MONTH = 5;
export const PIVOT_ROWS = PIVOT_MONTHS * PIVOT_ROWS_PER_MONTH;
export const PIVOT_COGS_RATE = 0.6;

export type PivotSale = {
  year: number;
  month: number;
  day: number;
  dateSerial: number;
  region: (typeof PIVOT_REGIONS)[number];
  product: (typeof PIVOT_PRODUCTS)[number];
  amount: number;
};

/** Excel 1900 날짜 체계 (1899-12-30 원점). */
export function excelSerial(year: number, month: number, day: number): number {
  const utc = Date.UTC(year, month - 1, day);
  const epoch = Date.UTC(1899, 11, 30);
  return Math.round((utc - epoch) / 86400000);
}

export function pivotSales(): PivotSale[] {
  const rows: PivotSale[] = [];
  for (let m = 0; m < PIVOT_MONTHS; m++) {
    const year = 2023 + Math.floor(m / 12);
    const month = (m % 12) + 1;
    for (let j = 0; j < PIVOT_ROWS_PER_MONTH; j++) {
      const day = 1 + j * 5;
      rows.push({
        year,
        month,
        day,
        dateSerial: excelSerial(year, month, day),
        region: PIVOT_REGIONS[j % PIVOT_REGIONS.length],
        product: PIVOT_PRODUCTS[(m + j) % PIVOT_PRODUCTS.length],
        amount: ((m * 13 + j * 7 + 11) % 900) + 100,
      });
    }
  }
  return rows;
}

export function pivotSeoulQ1(): number {
  return pivotSales()
    .filter((row) => row.region === "서울" && row.year === 2023 && row.month <= 3)
    .reduce((sum, row) => sum + row.amount, 0);
}

/** 서울 2023 연간 원가. 계산 필드 금액×0.6과 같다. */
export function pivotSeoulCogs(): number {
  return pivotSales()
    .filter((row) => row.region === "서울" && row.year === 2023)
    .reduce((sum, row) => sum + row.amount * PIVOT_COGS_RATE, 0);
}
