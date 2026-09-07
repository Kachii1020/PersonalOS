import type { CareerFacts, FactKey } from "./types";

export const FACT_KEYS: FactKey[] = ["graduation_date", "academic_year", "degree", "major", "university", "residence", "work_authorization", "languages", "available_from", "available_until", "weekly_days", "skills"];
export const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"];
const AUTHORIZATION = ["unrestricted", "restricted", "none", "unknown"];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export function calendarDate(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

export function timestamp(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || calendarDate(value.slice(0, 10)) === null) return null;
  if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return null;
  const time = Date.parse(value);
  // Date.parse truncates sub-milliseconds; preserve PostgreSQL microseconds so
  // a source checked just after `now` cannot be accepted as already checked.
  const fraction = /\.(\d+)/.exec(value)?.[1] ?? "";
  const subMilliseconds = fraction.length > 3 ? Number(`0.${fraction.slice(3)}`) : 0;
  return Number.isFinite(time) ? time + subMilliseconds : null;
}

function shortText(value: unknown, max = 160): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max && !Array.from(value).some((character) => character.charCodeAt(0) < 32);
}

export function validFactValue(field: FactKey, value: unknown): boolean {
  switch (field) {
    case "graduation_date": case "available_from": case "available_until": return calendarDate(value) !== null;
    case "academic_year": return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12;
    case "weekly_days": return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 7;
    case "degree": case "major": case "university": case "residence": return shortText(value);
    case "skills": return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every((item) => shortText(item, 80));
    case "languages": return isRecord(value) && Object.keys(value).length > 0 && Object.keys(value).length <= 30 && Object.entries(value).every(([language, level]) => /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language) && typeof level === "string" && CEFR.includes(level));
    case "work_authorization": return isRecord(value) && Object.keys(value).length > 0 && Object.keys(value).length <= 30 && Object.entries(value).every(([country, status]) => /^[A-Z]{2}$/.test(country) && typeof status === "string" && AUTHORIZATION.includes(status));
    default: return false;
  }
}

export function validateCareerFacts(input: unknown): CareerFacts {
  if (!isRecord(input) || Object.keys(input).some((key) => !FACT_KEYS.includes(key as FactKey))) throw new Error("프로필에는 지원하는 사실 항목만 저장할 수 있습니다.");
  const result: CareerFacts = {};
  for (const [key, fact] of Object.entries(input)) {
    const field = key as FactKey;
    if (!isRecord(fact) || Object.keys(fact).some((name) => !["value", "verifiedAt", "reviewAt", "source"].includes(name)) || !validFactValue(field, fact.value)) throw new Error(`${field}: 사실 값 형식이 올바르지 않습니다.`);
    const verified = timestamp(fact.verifiedAt);
    const review = timestamp(fact.reviewAt);
    if (verified === null || review === null || review <= verified || !shortText(fact.source, 500)) throw new Error(`${field}: 확인일, 재검토일, 출처를 확인해 주세요.`);
    result[field] = { value: structuredClone(fact.value) as NonNullable<CareerFacts[FactKey]>["value"], verifiedAt: fact.verifiedAt as string, reviewAt: fact.reviewAt as string, source: (fact.source as string).trim() };
  }
  if (result.available_from && result.available_until && calendarDate(result.available_from.value)! > calendarDate(result.available_until.value)!) throw new Error("활동 가능 종료일은 시작일 이후여야 합니다.");
  return result;
}
