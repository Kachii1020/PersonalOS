/** hands 스타터 숫자. 생성 스크립트와 채점이 같은 함수를 쓴다. */

export const HANDS_DATA_ROWS = 500;
export const HANDS_LAST_ROW = 501;
export const HANDS_TAX_RATE = 0.1;
export const HANDS_TAX_AFTER = 90;
export const HANDS_FILL_ROW = 6;

export function handsAmount(dataIndex: number): number {
  return ((dataIndex * 17 + 3) % 1000) + 1;
}

export function handsSum(): number {
  let sum = 0;
  for (let i = 0; i < HANDS_DATA_ROWS; i++) sum += handsAmount(i);
  return sum;
}

export function handsFillValue(): number {
  return handsAmount(HANDS_FILL_ROW - 2) * HANDS_TAX_RATE;
}
