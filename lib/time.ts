/**
 * 이 앱의 기준 시간대는 Asia/Tokyo다. JST는 서머타임이 없어서 +09:00 고정으로 다뤄도 정확하다.
 * 날짜 경계(오늘/이번 주/이번 달)는 전부 여기를 지난다 — 위젯마다 따로 계산하면 어긋난다.
 */
export const APP_TZ = "Asia/Tokyo";
const OFFSET = "+09:00";

const YMD = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ });

/** JST 기준 YYYY-MM-DD. */
export function ymd(date: Date): string {
  return YMD.format(date);
}

/** JST 자정의 실제 시각. */
export function midnight(dateString: string): Date {
  return new Date(`${dateString}T00:00:00${OFFSET}`);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** JST 기준 오늘 자정. */
export function todayStart(now: Date = new Date()): Date {
  return midnight(ymd(now));
}

/** JST 기준 이번 달 1일 자정과 다음 달 1일 자정. */
export function monthRange(now: Date = new Date()): { start: Date; end: Date; year: number; month: number } {
  const [y, m] = ymd(now).split("-").map(Number) as [number, number, number];
  const start = midnight(`${y}-${String(m).padStart(2, "0")}-01`);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = midnight(`${nextY}-${String(nextM).padStart(2, "0")}-01`);
  return { start, end, year: y, month: m };
}

/** JST 기준 요일 (0=일). */
export function weekday(date: Date): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

const TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: APP_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function hhmm(iso: string): string {
  return TIME.format(new Date(iso));
}

const WEEKDAY_FMT = new Intl.DateTimeFormat("ko-KR", { timeZone: APP_TZ, weekday: "short" });

/**
 * "8/5 (수)".
 * ko-KR의 numeric 포맷은 "8. 5."처럼 마침표가 붙어 표에서 자릿수가 흔들린다.
 */
export function monthDayWeekday(iso: string): string {
  const date = new Date(iso);
  const [, month, day] = ymd(date).split("-") as [string, string, string];
  return `${Number(month)}/${Number(day)} (${WEEKDAY_FMT.format(date)})`;
}
