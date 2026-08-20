import { addDays, todayStart, ymd } from "@/lib/time";

/**
 * 연속 일수 계산 (1-A). 순수 함수 — UI와 테스트가 같은 로직을 쓴다.
 * 오늘 기록이 아직 없어도 어제까지 이어졌으면 끊긴 게 아니다 (오늘은 아직 기회가 있다).
 */
export function streakFrom(days: Set<string>, now: Date = new Date()): number {
  let cursor = todayStart(now);
  if (!days.has(ymd(cursor))) cursor = addDays(cursor, -1);

  let count = 0;
  while (days.has(ymd(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}
