import { buildCareerPrompt, CAREER_SCHEMA, CAREER_SOURCE_LIMIT, CAREER_SYSTEM } from "@/lib/ai/prompts/career";
import { calendarDate, CEFR, FACT_KEYS, isRecord, timestamp, validFactValue } from "./profile";
import type { CareerRequirement, FactKey, Lifecycle, RequirementOperator } from "./types";

export type CareerExtraction = { title: string; lifecycle: Lifecycle; deadline: string | null; requirements: CareerRequirement[]; requirementsComplete: false; warnings: string[] };
const normalize = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim();
const quoted = (quote: unknown, text: string): quote is string => typeof quote === "string" && quote.length <= 4_000 && normalize(quote).length > 0 && normalize(text).includes(normalize(quote));

function validExpected(field: FactKey, operator: unknown, expected: unknown): boolean {
  if (operator === "unknown") return expected === null;
  if (operator === "not_required") return expected === null;
  if (field === "languages") return ["gte", "eq"].includes(operator as string) && isRecord(expected) && Object.keys(expected).length === 2 && typeof expected.language === "string" && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(expected.language) && typeof expected.minimum === "string" && CEFR.includes(expected.minimum);
  if (field === "work_authorization") return operator === "eq" && isRecord(expected) && Object.keys(expected).length === 2 && typeof expected.country === "string" && /^[A-Z]{2}$/.test(expected.country) && ["unrestricted", "any"].includes(expected.level as string);
  if (field === "skills") return ["all_of", "one_of"].includes(operator as string) && validFactValue(field, expected);
  if (operator === "eq") return validFactValue(field, expected);
  if (operator === "one_of") return Array.isArray(expected) && expected.length > 0 && expected.length <= 100 && expected.every((value) => validFactValue(field, value));
  const dateField = ["graduation_date", "available_from", "available_until"].includes(field);
  if (!dateField && !["academic_year", "weekly_days"].includes(field)) return false;
  if (operator === "gte" || operator === "lte") return validFactValue(field, expected);
  if (operator !== "between" || !Array.isArray(expected) || expected.length !== 2 || !expected.every((value) => validFactValue(field, value))) return false;
  return dateField ? calendarDate(expected[0])! <= calendarDate(expected[1])! : (expected[0] as number) <= (expected[1] as number);
}

/** Candidate validation only: the caller must persist source/rule review as false. */
export function validateCareerExtraction(raw: unknown, text: string, sourceId: string): CareerExtraction {
  if (!sourceId.trim() || sourceId.length > 200 || !text.trim()) throw new Error("공식 원문과 출처 ID가 필요합니다.");
  if (!isRecord(raw) || !Array.isArray(raw.requirements) || raw.requirements.length > 50) throw new Error("공고 조건 응답 형식 또는 개수 제한을 확인해 주세요.");
  const boundedText = text.slice(0, CAREER_SOURCE_LIMIT);
  const warnings = ["AI 추출은 미검토 후보이며 전체 필수 조건의 완전성은 확인되지 않았습니다."];
  if (text.length > CAREER_SOURCE_LIMIT) warnings.push("원문이 60,000자로 제한되었습니다. 전체 공식 원문을 검토해야 합니다.");
  const requirements = raw.requirements.map((candidate, index): CareerRequirement => {
    const row = isRecord(candidate) ? candidate : {};
    const field = FACT_KEYS.includes(row.field as FactKey) ? row.field as FactKey : "skills";
    const valid = FACT_KEYS.includes(row.field as FactKey) && typeof row.hard === "boolean" && row.sourceId === sourceId && quoted(row.quote, boundedText) && validExpected(field, row.operator, row.expected);
    if (!valid || row.operator === "unknown") warnings.push(`조건 ${index + 1}은 표현 또는 근거가 불명확하여 필수·미확인으로 유지했습니다.`);
    return {
      id: `${sourceId}:requirement:${index + 1}`, field,
      operator: valid ? row.operator as RequirementOperator : "unknown",
      expected: valid ? structuredClone(row.expected) as CareerRequirement["expected"] : null,
      hard: !valid || row.operator === "unknown" ? true : row.hard as boolean,
      quote: typeof row.quote === "string" ? row.quote.slice(0, 4_000) : "",
      sourceId, reviewed: false,
    };
  });
  if (requirements.length === 0) {
    requirements.push({ id: `${sourceId}:requirement:unknown`, field: "skills", operator: "unknown", expected: null, hard: true, quote: "", sourceId, reviewed: false });
    warnings.push("추출된 조건이 없어 필수·미확인 항목을 남겼습니다.");
  }
  const deadline = timestamp(raw.deadline) !== null && quoted(raw.deadlineQuote, boundedText) && normalize(raw.deadlineQuote).includes(raw.deadline as string) ? raw.deadline as string : null;
  if (raw.deadline !== null && deadline === null) warnings.push("마감 시각의 원문·시간대 근거가 없어 확정하지 않았습니다.");
  return { title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 300) : "공고 검토 필요", lifecycle: "unknown", deadline, requirements, requirementsComplete: false, warnings };
}

export async function extractCareerRequirements(text: string, sourceId: string, sourceUrl: string): Promise<CareerExtraction> {
  if (!text.trim() || !sourceId.trim() || sourceId.length > 200) throw new Error("추출할 공개 원문과 출처 ID가 필요합니다.");
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:" || url.username || url.password || sourceUrl.length > 2_048) throw new Error("공개 HTTPS 출처 URL이 필요합니다.");
  const { callStructured } = await import("@/lib/ai/client");
  const result = await callStructured<unknown>({ purpose: "career_extraction", system: CAREER_SYSTEM, userMessage: buildCareerPrompt(text, sourceId, sourceUrl), schema: CAREER_SCHEMA, maxTokens: 10_000, effort: "low", retries: 0, timeoutMs: 45_000 });
  return validateCareerExtraction(result.data, text, sourceId);
}
