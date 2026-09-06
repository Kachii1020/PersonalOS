import { calendarDate, CEFR, FACT_KEYS, isRecord, timestamp, validFactValue } from "./profile";
import type { Assessment, AssessmentInput, CareerRequirement, CareerTopAction, RankedOpportunity, RequirementResult } from "./types";

const DAY = 86_400_000;
const MAX_SOURCE_AGE = 8 * DAY;
const normalize = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim();
const equal = (a: unknown, b: unknown) => typeof a === "string" && typeof b === "string" ? normalize(a).toLocaleLowerCase("en") === normalize(b).toLocaleLowerCase("en") : a === b;

function current(value: unknown, now: number): boolean {
  const date = timestamp(value);
  return date !== null && Number.isFinite(now) && date <= now && now - date <= MAX_SOURCE_AGE;
}

function deadlineTime(value: string | null): number | null {
  // A date without a timezone cannot establish a safe application cutoff.
  return value === null ? null : timestamp(value);
}

function compare(requirement: CareerRequirement, value: unknown): boolean | null {
  const { field, operator, expected } = requirement;
  if (field === "languages") {
    if (!isRecord(value) || !isRecord(expected) || Object.keys(expected).length !== 2 || typeof expected.language !== "string" || typeof expected.minimum !== "string" || !CEFR.includes(expected.minimum) || !["gte", "eq"].includes(operator)) return null;
    const actual = value[expected.language];
    if (typeof actual !== "string" || !CEFR.includes(actual)) return null;
    return operator === "eq" ? actual === expected.minimum : CEFR.indexOf(actual) >= CEFR.indexOf(expected.minimum);
  }
  if (field === "work_authorization") {
    if (!isRecord(value) || !isRecord(expected) || Object.keys(expected).length !== 2 || typeof expected.country !== "string" || !/^[A-Z]{2}$/.test(expected.country) || !["unrestricted", "any"].includes(expected.level as string) || operator !== "eq") return null;
    const actual = value[expected.country];
    return typeof actual !== "string" || actual === "unknown" ? null : expected.level === "any" ? actual === "unrestricted" || actual === "restricted" : actual === "unrestricted";
  }
  if (field === "skills") {
    if (!Array.isArray(value) || !Array.isArray(expected) || !validFactValue("skills", expected)) return null;
    if (operator === "all_of") return expected.every((skill) => value.some((actual) => equal(actual, skill)));
    if (operator === "one_of") return expected.some((skill) => value.some((actual) => equal(actual, skill)));
    return null;
  }
  const dateField = ["graduation_date", "available_from", "available_until"].includes(field);
  const ordered = dateField || ["academic_year", "weekly_days"].includes(field);
  const scalar = (item: unknown): number | null => dateField ? calendarDate(item) : typeof item === "number" && validFactValue(field, item) ? item : null;
  if (operator === "eq") return validFactValue(field, expected) ? equal(value, expected) : null;
  if (operator === "one_of") return Array.isArray(expected) && expected.length > 0 && expected.length <= 100 && expected.every((item) => validFactValue(field, item)) ? expected.some((item) => equal(value, item)) : null;
  if (!ordered) return null;
  const actual = scalar(value);
  if (actual === null) return null;
  if (operator === "between") {
    if (!Array.isArray(expected) || expected.length !== 2) return null;
    const low = scalar(expected[0]); const high = scalar(expected[1]);
    return low === null || high === null || low > high ? null : actual >= low && actual <= high;
  }
  const target = scalar(expected);
  if (target === null) return null;
  return operator === "gte" ? actual >= target : operator === "lte" ? actual <= target : null;
}

function assessRequirement(requirement: CareerRequirement, input: AssessmentInput, sourceCurrent: boolean): RequirementResult {
  const unknown = (reason: string): RequirementResult => ({ requirementId: requirement.id, result: "unknown", reason });
  const source = input.source;
  if (!FACT_KEYS.includes(requirement.field)) return unknown("지원하지 않는 프로필 항목입니다.");
  if (!sourceCurrent || !source || requirement.reviewed !== true || requirement.sourceId !== source.id || typeof requirement.quote !== "string" || !normalize(requirement.quote) || !normalize(source.text).includes(normalize(requirement.quote))) return unknown("현재 공식 원문과 조건의 인용·검토를 확인해야 합니다.");
  if (requirement.operator === "not_required") return requirement.expected === null ? { requirementId: requirement.id, result: "not_applicable", reason: "공식 원문에서 해당 조건이 필요 없음을 확인했습니다." } : unknown("조건 없음의 값은 null이어야 합니다.");
  const fact = input.facts[requirement.field];
  const verified = timestamp(fact?.verifiedAt); const review = timestamp(fact?.reviewAt); const now = input.now.getTime();
  if (!fact || !validFactValue(requirement.field, fact.value) || verified === null || review === null || verified > now || review <= now || review <= verified || typeof fact.source !== "string" || !fact.source.trim()) return unknown("확인된 최신 프로필 사실이 필요합니다.");
  const matches = compare(requirement, fact.value);
  return matches === null ? unknown("지원하지 않거나 모호한 조건 형식입니다.") : { requirementId: requirement.id, result: matches ? "pass" : "fail", reason: matches ? "확인된 프로필이 공식 조건을 충족합니다." : "확인된 프로필이 공식 조건을 충족하지 않습니다." };
}

export function assessOpportunity(input: AssessmentInput): Assessment {
  const now = input.now.getTime(); const source = input.source;
  const sourceCurrent = !!source && source.available === true && source.official === true && source.reviewed === true && typeof source.text === "string" && current(source.checkedAt, now);
  const results = input.requirements.map((requirement) => assessRequirement(requirement, input, sourceCurrent));
  const hard = results.filter((_, index) => input.requirements[index].hard === true);
  const reasons: string[] = [];
  let eligibility: Assessment["eligibility"] = "possibly_eligible";
  if (!sourceCurrent) reasons.push("공식 출처가 없거나 미검토·만료 상태입니다.");
  if (!input.requirementsComplete) reasons.push("필수 조건 추출이 완전한지 검토해야 합니다.");
  if (!hard.length) reasons.push("검토된 필수 조건이 없어 지원 가능 여부를 확정할 수 없습니다.");
  if (hard.some((result) => result.result === "fail")) eligibility = "not_eligible";
  else if (sourceCurrent && input.requirementsComplete === true && hard.length > 0 && hard.every((result) => result.result === "pass" || result.result === "not_applicable") && input.requirements.every((requirement) => typeof requirement.hard === "boolean" && requirement.reviewed === true) && results.every((result) => result.result !== "unknown")) eligibility = "confirmed_eligible";
  const deadline = deadlineTime(input.deadline);
  const expired = deadline !== null && deadline <= now;
  const lifecycle = expired ? "closed" : input.lifecycle;
  if (expired) reasons.push("지원 마감이 지났습니다.");
  if (input.deadline !== null && deadline === null) reasons.push("마감 시각과 시간대를 확인해야 합니다.");
  const status: Assessment["status"] = lifecycle === "closed" || eligibility === "not_eligible" ? "archive" : lifecycle === "open" && eligibility === "confirmed_eligible" && (input.deadline === null || deadline !== null) ? "act_now" : "monitor";
  if (!reasons.length) reasons.push(eligibility === "confirmed_eligible" ? "검토한 공식 필수 조건을 모두 충족합니다." : eligibility === "not_eligible" ? "충족하지 못한 필수 조건이 있습니다." : "확인이 필요한 필수 조건이 있습니다.");
  return { eligibility, lifecycle, status, results, reasons };
}

export function rankOpportunities(items: RankedOpportunity[], now: Date, limit = 3): CareerTopAction[] {
  const clock = now.getTime();
  if (!Number.isFinite(clock)) return [];
  const seen = new Set<string>();
  const bounded = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return items.filter((item) => {
    if (item.eligibility !== "confirmed_eligible" || item.lifecycle !== "open" || item.decision !== "none" || !current(item.verifiedAt, clock)) return false;
    if (item.deadline !== null && (deadlineTime(item.deadline) === null || deadlineTime(item.deadline)! <= clock)) return false;
    if (item.deferUntil !== null && (timestamp(item.deferUntil) === null || timestamp(item.deferUntil)! > clock)) return false;
    return true;
  }).map((item): CareerTopAction => {
    const due = deadlineTime(item.deadline);
    const urgency = due === null ? 0 : Math.max(0, 20 * (1 - (due - clock) / (30 * DAY)));
    const score = Math.round((bounded(item.fit) * 0.45 + bounded(item.value) * 0.35 + urgency - (Number.isFinite(item.effort) ? bounded(item.effort) : 100) * 0.2) * 100) / 100;
    return { ...item, score, reason: `공식 필수 조건 확인 · 적합도 ${bounded(item.fit)} · 가치 ${bounded(item.value)} · 준비 부담 ${Number.isFinite(item.effort) ? bounded(item.effort) : 100}${item.decisionReason ? ` · 이전 결정: ${item.decisionReason}` : ""}` };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).filter((item) => {
    const key = item.deliverableKey?.trim() ? `deliverable:${item.deliverableKey.trim()}` : `id:${item.id}`;
    if (seen.has(key) || seen.has(`id:${item.id}`)) return false;
    seen.add(key); seen.add(`id:${item.id}`); return true;
  }).slice(0, Number.isFinite(limit) ? Math.min(3, Math.max(0, Math.floor(limit))) : 3);
}
