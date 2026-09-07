"use server";

import { revalidatePath } from "next/cache";
import { calendarDate, FACT_KEYS, validateCareerFacts } from "@/lib/career/profile";
import type { CareerFacts, CareerRequirement, FactKey, Lifecycle, RequirementOperator } from "@/lib/career/types";
import type { CareerOpportunity } from "@/lib/career/view";
import type { Json } from "@/lib/types/database";
import { ymd } from "@/lib/time";
import { addCareerCompany, captureCareerOpportunity, decideCareerOpportunity, getCareerDashboard, refreshCareerOpportunity, reviewCareerOpportunity, saveCareerProfile, startCareerApplication, updateCareerCase } from "@/lib/repos/career";

export type CareerFormState = { error?: string; message?: string; href?: string };
const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const optional = (data: FormData, key: string) => text(data, key) || null;
function jstTime(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("날짜와 시각을 모두 입력해 주세요.");
  if (calendarDate(value.slice(0, 10)) === null || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59) throw new Error("실제 달력 날짜와 시각을 확인해 주세요.");
  const parsed = new Date(`${value}:00+09:00`);
  if (!Number.isFinite(parsed.getTime())) throw new Error("날짜와 시각을 확인해 주세요.");
  return parsed.toISOString();
}
function refreshPages(id?: string) {
  for (const path of ["/career", "/career/profile", "/opportunities", "/today", "/approvals"]) revalidatePath(path);
  if (id) revalidatePath(`/opportunities/${id}`);
}
async function submit(work: () => Promise<CareerFormState>): Promise<CareerFormState> {
  try { return await work(); }
  catch (error) { return { error: error instanceof Error ? error.message : "저장하지 못했습니다. 입력값을 확인하고 다시 시도해 주세요." }; }
}
function pairs(value: string): Record<string, string> {
  const entries = value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean).map((item) => {
    const parts = item.split(":").map((part) => part.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("항목:값 형식으로 입력해 주세요. 예: ja:C1");
    return parts as [string, string];
  });
  if (new Set(entries.map(([key]) => key)).size !== entries.length) throw new Error("같은 국가나 언어를 두 번 입력할 수 없습니다.");
  return Object.fromEntries(entries);
}
function factValue(field: FactKey, raw: string): Json {
  if (field === "academic_year" || field === "weekly_days") return Number(raw);
  if (field === "languages" || field === "work_authorization") return pairs(raw);
  if (field === "skills") return raw.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
  return raw;
}

export async function submitCareerProfile(_state: CareerFormState, data: FormData): Promise<CareerFormState> {
  return submit(async () => {
    if (data.get("confirmed") !== "on") throw new Error("직접 확인한 사실인지 체크해 주세요.");
    const { facts: previous } = await getCareerDashboard();
    const facts: CareerFacts = {};
    for (const field of FACT_KEYS) {
      const raw = text(data, `${field}.value`);
      if (!raw) continue;
      const value = factValue(field, raw);
      const source = text(data, `${field}.source`);
      const verifiedDate = text(data, `${field}.verified`);
      const reviewDate = text(data, `${field}.review`);
      if (!verifiedDate || !reviewDate || !source) throw new Error("입력한 사실마다 확인일·재검토일·근거를 입력해 주세요.");
      const old = previous[field];
      const unchanged = old && JSON.stringify(old.value) === JSON.stringify(value) && old.source === source;
      facts[field] = {
        value, source,
        verifiedAt: unchanged && ymd(new Date(old.verifiedAt)) === verifiedDate ? old.verifiedAt : jstTime(`${verifiedDate}T00:00`)!,
        reviewAt: old && ymd(new Date(old.reviewAt)) === reviewDate ? old.reviewAt : jstTime(`${reviewDate}T00:00`)!,
      };
    }
    await saveCareerProfile(validateCareerFacts(facts));
    refreshPages();
    return { message: "확인한 사실을 저장했습니다. 비워 둔 항목은 미확인으로 남습니다." };
  });
}

export async function submitCareerCompany(_state: CareerFormState, data: FormData): Promise<CareerFormState> {
  return submit(async () => {
    if (data.get("officialConfirmed") !== "on") throw new Error("기관이 직접 운영하는 공식 주소인지 확인해 주세요.");
    await addCareerCompany({ name: text(data, "name"), reason: text(data, "reason"), officialPrefixes: text(data, "prefixes").split(/\n/).map((item) => item.trim()).filter(Boolean), tier: Number(text(data, "tier")) as 1 | 2 | 3, windowStart: jstTime(text(data, "windowStart")), windowEnd: jstTime(text(data, "windowEnd")) });
    refreshPages();
    return { message: "관심 기관을 추가했습니다. 이제 공식 공고를 저장할 수 있습니다." };
  });
}

export async function submitCareerCapture(_state: CareerFormState, data: FormData): Promise<CareerFormState> {
  return submit(async () => {
    const id = await captureCareerOpportunity({ companyId: text(data, "companyId"), url: text(data, "url"), title: text(data, "title"), opportunityType: (text(data, "opportunityType") || "job") as CareerOpportunity["opportunityType"], sourceClass: (text(data, "sourceClass") || "official_posting") as CareerOpportunity["sourceClass"] });
    refreshPages(id);
    return { message: "공고를 저장했습니다. 원문 확인과 조건 정리는 자동 처리 대기 중입니다.", href: `/opportunities/${id}` };
  });
}

export async function submitCareerRefresh(_state: CareerFormState, data: FormData): Promise<CareerFormState> {
  return submit(async () => {
    const id = text(data, "id");
    await refreshCareerOpportunity(id); refreshPages(id);
    return { message: "원문 재확인을 요청했습니다. 자동 처리 후 페이지를 새로고침해 주세요." };
  });
}

function expectedValue(field: FactKey, operator: RequirementOperator, raw: string): Json {
  if (operator === "unknown" || operator === "not_required") return null;
  if (!raw) return null;
  if (field === "languages" || field === "work_authorization") {
    const entries = Object.entries(pairs(raw));
    if (entries.length !== 1) throw new Error("각 조건에는 언어나 국가를 한 개씩 입력해 주세요.");
    const [key, value] = entries[0];
    return field === "languages" ? { language: key, minimum: value } : { country: key, level: value };
  }
  const scalar = (item: string) => field === "academic_year" || field === "weekly_days" ? Number(item) : item;
  if (["one_of", "all_of", "between"].includes(operator) || field === "skills") return raw.split(",").map((item) => scalar(item.trim()));
  return scalar(raw);
}

export async function submitCareerReview(_state: CareerFormState, data: FormData): Promise<CareerFormState> {
  return submit(async () => {
    if (data.get("sourceReviewed") !== "on") throw new Error("공식 원문을 직접 확인한 뒤 체크해 주세요.");
    const id = text(data, "id");
    const opportunity = (await getCareerDashboard()).opportunities.find((item) => item.id === id);
    if (!opportunity?.source) throw new Error("원문 확인이 완료된 뒤 검토할 수 있습니다.");
    const count = Number(text(data, "requirementCount"));
    if (!Number.isInteger(count) || count < 0 || count > 50) throw new Error("조건은 최대 50개까지 저장할 수 있습니다.");
    const requirements: CareerRequirement[] = Array.from({ length: count }, (_, index) => {
      const field = text(data, `rule.${index}.field`) as FactKey;
      const operator = text(data, `rule.${index}.operator`) as RequirementOperator;
      return { id: text(data, `rule.${index}.id`) || crypto.randomUUID(), field, operator, expected: expectedValue(field, operator, text(data, `rule.${index}.expected`)), hard: data.get(`rule.${index}.hard`) === "on", quote: text(data, `rule.${index}.quote`), sourceId: opportunity.source!.id, reviewed: data.get(`rule.${index}.reviewed`) === "on" };
    });
    await reviewCareerOpportunity(id, { revision: Number(text(data, "revision")), title: text(data, "title"), lifecycle: text(data, "lifecycle") as Lifecycle, deadline: jstTime(text(data, "deadline")), location: optional(data, "location"), workMode: optional(data, "workMode"), fit: Number(text(data, "fit")), value: Number(text(data, "value")), effort: Number(text(data, "effort")), deliverableKey: optional(data, "deliverableKey"), requirements, complete: data.get("complete") === "on" });
    refreshPages(id);
    return { message: "원문과 조건 검토를 저장했습니다. 최신 프로필을 바탕으로 판정을 갱신했습니다." };
  });
}

export async function submitCareerDecision(_state: CareerFormState, data: FormData): Promise<CareerFormState> {
  return submit(async () => {
    const id = text(data, "id");
    await decideCareerOpportunity(id, { decision: text(data, "decision") as "none" | "reject" | "defer", reason: text(data, "reason"), deferUntil: jstTime(text(data, "deferUntil")) });
    refreshPages(id); return { message: "선택과 이유를 저장했습니다. 다음 추천에 반영됩니다." };
  });
}

export async function submitCareerApplication(_state: CareerFormState, data: FormData): Promise<CareerFormState> {
  return submit(async () => {
    const id = text(data, "id");
    await startCareerApplication(id, { nextAction: text(data, "nextAction"), dueAt: jstTime(text(data, "dueAt")) });
    refreshPages(id); return { message: "지원 준비 기록을 저장했습니다. 준비 할 일 생성 요청은 처리 대기 중이며, 처리 후 승인함에 표시됩니다.", href: "/approvals" };
  });
}

export async function submitCareerCase(_state: CareerFormState, data: FormData): Promise<CareerFormState> {
  return submit(async () => {
    await updateCareerCase(text(data, "id"), { stage: text(data, "stage"), nextAction: text(data, "nextAction"), dueAt: jstTime(text(data, "dueAt")), documents: text(data, "documents"), interviews: text(data, "interviews"), contact: text(data, "contact"), result: text(data, "result"), decisionReason: text(data, "decisionReason") });
    refreshPages(); return { message: "지원 진행 기록을 저장했습니다." };
  });
}
