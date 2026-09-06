import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assessOpportunity, rankOpportunities } from "@/lib/career/assessment";
import { FACT_KEYS, timestamp, validateCareerFacts } from "@/lib/career/profile";
import { canonicalizeCareerUrl, isOfficialCareerUrl } from "@/lib/career/url";
import type { CareerFacts, CareerRequirement, Lifecycle } from "@/lib/career/types";
import type { CareerCase, CareerCompany, CareerDashboard, CareerOpportunity, CareerReview } from "@/lib/career/view";

type Client = SupabaseClient<Database>;
type OpportunityRow = Database["public"]["Tables"]["opportunities"]["Row"];
const uuid = (id: string) => { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error("항목 ID가 올바르지 않습니다."); return id; };
function text(value: string, max: number, required = false): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new Error("입력 길이와 필수 항목을 확인하세요.");
  return value.trim();
}
function date(value: string | null): string | null {
  if (value !== null && timestamp(value) === null) throw new Error("시각은 시간대를 포함해야 합니다.");
  return value;
}
const json = (input: unknown) => input as Json;
const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();

// Do not silently drop older eligible opportunities or their organizations.
// PostgREST also caps rows per response, so use stable, explicit pagination.
async function allRows<T>(query: { range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }> }): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; offset < 10_000; offset += 200) {
    const page = await query.range(offset, offset + 199);
    if (page.error) throw new Error(`커리어 조회 실패: ${page.error.message}`);
    result.push(...(page.data ?? []));
    if (!page.data || page.data.length < 200) return result;
  }
  throw new Error("커리어 자료가 조회 한도를 넘었습니다. 일부 자료만으로 추천하지 않으니 보관 범위를 점검하세요.");
}
async function byIds<T>(ids: string[], query: (batch: string[]) => Parameters<typeof allRows<T>>[0]): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) result.push(...await allRows(query(ids.slice(offset, offset + 100))));
  return result;
}

async function readCareer(client: Client, opportunityId?: string): Promise<{ dashboard: CareerDashboard; rows: OpportunityRow[] }> {
  let query = client.from("opportunities").select("*").order("created_at", { ascending: false }).order("id");
  if (opportunityId) query = query.eq("id", uuid(opportunityId));
  let caseQuery = client.from("application_cases").select("*").order("created_at", { ascending: false }).order("id");
  if (opportunityId) caseQuery = caseQuery.eq("opportunity_id", opportunityId);
  const [profile, companyRows, rows, caseRows] = await Promise.all([
    client.from("career_profile").select("*").single(),
    allRows(client.from("company_watchlist").select("*").order("name").order("id")),
    allRows(query),
    allRows(caseQuery),
  ]);
  if (profile.error) throw new Error(`커리어 조회 실패: ${profile.error.message}`);
  if (!profile.data) throw new Error("커리어 프로필을 조회할 수 없습니다.");
  const facts = validateCareerFacts(profile.data.facts);
  const ids = rows.map((row) => row.id);
  const sourceIds = rows.flatMap((row) => row.current_source_id ? [row.current_source_id] : []);
  const [requirementRows, sourceRows] = await Promise.all([
    byIds(ids, (batch) => client.from("opportunity_requirements").select("*").in("opportunity_id", batch).order("id")),
    byIds(sourceIds, (batch) => client.from("opportunity_sources").select("*").in("id", batch).order("id")),
  ]);
  const companies: CareerCompany[] = companyRows.map((row) => ({
    id: row.id, name: row.name, reason: row.reason, officialPrefixes: Array.isArray(row.official_prefixes) ? row.official_prefixes.filter((value): value is string => typeof value === "string") : [],
    tier: row.tier as 1 | 2 | 3, enabled: row.enabled, windowStart: row.window_start, windowEnd: row.window_end,
  }));
  const now = new Date();
  const opportunities: CareerOpportunity[] = rows.map((row) => {
    const company = companies.find((item) => item.id === row.company_id);
    const snapshot = sourceRows.find((item) => item.id === row.current_source_id);
    const source = snapshot ? {
      id: snapshot.id, text: snapshot.content_text, checkedAt: row.last_checked_at, available: row.source_available,
      official: !!company && isOfficialCareerUrl(snapshot.source_url, company.officialPrefixes), reviewed: row.source_reviewed,
    } : null;
    const requirements: CareerRequirement[] = requirementRows.filter((item) => item.opportunity_id === row.id && item.source_id === row.current_source_id).map((item) => ({
      id: item.id, field: item.field as CareerRequirement["field"], operator: item.operator as CareerRequirement["operator"],
      expected: item.expected, hard: item.hard, quote: item.quote, sourceId: item.source_id, reviewed: item.reviewed,
    }));
    const lifecycle = row.lifecycle as Lifecycle;
    const assessment = assessOpportunity({ facts, requirements, source, lifecycle, deadline: row.deadline, requirementsComplete: row.requirements_complete, now });
    return {
      id: row.id, companyId: row.company_id, organization: company?.name ?? "조직 확인 필요", title: row.title,
      opportunityType: row.opportunity_type as CareerOpportunity["opportunityType"], sourceClass: row.source_class as CareerOpportunity["sourceClass"],
      canonicalUrl: row.canonical_url, lifecycle, deadline: row.deadline, location: row.location, workMode: row.work_mode,
      fit: row.fit, value: row.value, effort: row.effort, deliverableKey: row.deliverable_key,
      decision: row.decision as CareerOpportunity["decision"], decisionReason: row.decision_reason, deferUntil: row.defer_until,
      revision: row.revision, source, requirements, requirementsComplete: row.requirements_complete,
      assessment, lastError: row.last_error, nextCheckAt: row.next_check_at,
    };
  });
  const approvals = await byIds(caseRows.map((row) => `career:application:${row.id}:prepare:v1`),
    (batch) => client.from("approval_requests").select("id,idempotency_key").in("idempotency_key", batch).order("id"));
  const approvalIds = new Map(approvals.map((row) => [row.idempotency_key, row.id]));
  const cases: CareerCase[] = caseRows.map((row) => {
    return { id: row.id, opportunityId: row.opportunity_id, title: opportunities.find((item) => item.id === row.opportunity_id)?.title ?? "지원 준비",
      stage: row.stage, nextAction: row.next_action, dueAt: row.due_at, documents: row.documents, interviews: row.interviews,
      contact: row.contact, result: row.result, decisionReason: row.decision_reason, approvalId: approvalIds.get(`career:application:${row.id}:prepare:v1`) ?? null };
  });
  const topActions = rankOpportunities(opportunities.map((item) => ({
    id: item.id, title: item.title, organization: item.organization, eligibility: item.assessment.eligibility,
    lifecycle: item.assessment.lifecycle, deadline: item.deadline, verifiedAt: item.source?.checkedAt ?? null,
    fit: item.fit, value: item.value, effort: item.effort, decision: item.decision, deferUntil: item.deferUntil,
    decisionReason: item.decisionReason, deliverableKey: item.deliverableKey,
  })), now);
  return { dashboard: { facts, profileRevision: profile.data.revision, companies, opportunities, topActions, cases }, rows };
}

export async function getCareerDashboard(): Promise<CareerDashboard> {
  return (await readCareer(await createClient())).dashboard;
}
export async function getCareerWorkForJob(id: string) {
  const { dashboard, rows } = await readCareer(createAdminClient(), id);
  const opportunity = dashboard.opportunities[0];
  const row = rows[0];
  if (!opportunity || !row) throw new Error("공고가 없습니다.");
  const company = dashboard.companies.find((item) => item.id === opportunity.companyId);
  if (!company) throw new Error("공식 조직 설정이 없습니다.");
  return { opportunity, row, company, facts: dashboard.facts };
}
async function mutate(action: string, id: string | null, input: unknown): Promise<string> {
  const client = await createClient();
  const result = await client.rpc("career_mutate", { p_action: action, p_id: id ? uuid(id) : undefined, p_input: json(input) });
  if (result.error) throw new Error(`커리어 저장 실패: ${result.error.message}`);
  return result.data ?? "";
}
export async function saveCareerProfile(facts: CareerFacts): Promise<void> {
  await mutate("profile", null, { facts: validateCareerFacts(facts) });
}
export async function addCareerCompany(input: Omit<CareerCompany, "id" | "enabled">): Promise<string> {
  if (![1, 2, 3].includes(input.tier) || !Array.isArray(input.officialPrefixes) || !input.officialPrefixes.length || input.officialPrefixes.length > 10) throw new Error("공식 주소와 감시 주기를 확인하세요.");
  const officialPrefixes = [...new Set(input.officialPrefixes.map(canonicalizeCareerUrl))];
  if (officialPrefixes.some((url) => new URL(url).search)) throw new Error("공식 주소 범위에는 검색 매개변수 없는 경로를 입력하세요.");
  const windowStart = date(input.windowStart), windowEnd = date(input.windowEnd);
  if (input.tier === 3 && (!windowStart || !windowEnd || Date.parse(windowStart) >= Date.parse(windowEnd))) throw new Error("감시 시작·종료 시각을 확인하세요.");
  return mutate("company", null, { ...input, name: text(input.name, 160, true), reason: text(input.reason, 1000), officialPrefixes, windowStart, windowEnd });
}
export async function captureCareerOpportunity(input: { companyId: string; url: string; title: string; opportunityType?: CareerOpportunity["opportunityType"]; sourceClass?: CareerOpportunity["sourceClass"] }): Promise<string> {
  const client = await createClient();
  const company = await client.from("company_watchlist").select("official_prefixes").eq("id", uuid(input.companyId)).single();
  if (company.error) throw new Error("공식 조직을 먼저 등록하세요.");
  const url = canonicalizeCareerUrl(input.url);
  if (input.opportunityType && !["job", "internship", "program", "event", "other"].includes(input.opportunityType)) throw new Error("기회 종류를 확인하세요.");
  if (input.sourceClass && !["official_posting", "official_program", "official_faq"].includes(input.sourceClass)) throw new Error("공식 출처 종류를 확인하세요.");
  if (!isOfficialCareerUrl(url, company.data.official_prefixes as string[])) throw new Error("직접 확인한 공식 주소 범위의 공고만 등록할 수 있습니다.");
  return mutate("capture", null, { ...input, url, title: text(input.title, 300, true) });
}
export async function refreshCareerOpportunity(id: string): Promise<void> { await mutate("refresh", id, {}); }
export async function reviewCareerOpportunity(id: string, input: CareerReview): Promise<void> {
  const { dashboard } = await readCareer(await createClient(), id);
  const opportunity = dashboard.opportunities[0];
  if (!opportunity?.source?.official || !opportunity.source.available || opportunity.revision !== input.revision || !Number.isInteger(input.revision)) throw new Error("공식 원문이 변경되었습니다. 새로고침 후 검토하세요.");
  if (!["open", "upcoming", "closed", "unknown"].includes(input.lifecycle) || typeof input.complete !== "boolean") throw new Error("모집 상태와 조건 검토를 확인하세요.");
  for (const score of [input.fit, input.value, input.effort]) if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error("점수는 0~100 정수입니다.");
  if (!Array.isArray(input.requirements) || input.requirements.length > 50 || (input.complete && !input.requirements.length)) throw new Error("필수 조건 전체를 검토하세요.");
  for (const rule of input.requirements) {
    if (!FACT_KEYS.includes(rule.field) || !["eq", "one_of", "all_of", "gte", "lte", "between", "not_required", "unknown"].includes(rule.operator)
      || typeof rule.hard !== "boolean" || rule.reviewed !== true || rule.sourceId !== opportunity.source.id
      || !text(rule.quote, 4000, true) || !normalize(opportunity.source.text).includes(normalize(rule.quote))) throw new Error("각 조건의 정확한 공식 인용과 검토 표시가 필요합니다.");
  }
  await mutate("review", id, { ...input, title: text(input.title, 300, true), deadline: date(input.deadline),
    location: input.location === null ? null : text(input.location, 300), workMode: input.workMode === null ? null : text(input.workMode, 100),
    deliverableKey: input.deliverableKey === null ? null : text(input.deliverableKey, 200) });
}
export async function decideCareerOpportunity(id: string, input: { decision: "none" | "reject" | "defer"; reason: string; deferUntil: string | null }): Promise<void> {
  if (!["none", "reject", "defer"].includes(input.decision)) throw new Error("결정을 확인하세요.");
  await mutate("decision", id, { ...input, reason: text(input.reason, 1000, input.decision !== "none"), deferUntil: date(input.deferUntil) });
}
export async function startCareerApplication(id: string, input: { nextAction: string; dueAt: string | null }): Promise<string> {
  const { dashboard } = await readCareer(await createClient(), id);
  const opportunity = dashboard.opportunities[0];
  if (!opportunity || opportunity.assessment.status !== "act_now" || opportunity.decision !== "none") throw new Error("지원 자격과 현재 공식 공고를 먼저 확인하세요.");
  return mutate("case", id, { nextAction: text(input.nextAction, 300, true), dueAt: date(input.dueAt) });
}
export async function updateCareerCase(id: string, input: Omit<CareerCase, "id" | "opportunityId" | "title" | "approvalId">): Promise<void> {
  if (!["preparing", "submitted", "interview", "offer", "rejected", "withdrawn"].includes(input.stage)) throw new Error("지원 단계를 확인하세요.");
  await mutate("case_update", id, { ...input, nextAction: text(input.nextAction, 300, true), dueAt: date(input.dueAt),
    documents: text(input.documents, 5000), interviews: text(input.interviews, 5000), contact: text(input.contact, 1000),
    result: text(input.result, 2000), decisionReason: text(input.decisionReason, 1000) });
}

export async function commitCareerStepForJob(input: { runId: string; workerId: string; opportunityId: string; revision: number; kind: "source" | "extraction"; data: unknown }): Promise<boolean> {
  const result = await createAdminClient().rpc("commit_career_step", {
    p_run_id: input.runId, p_worker_id: input.workerId, p_opportunity_id: input.opportunityId,
    p_revision: input.revision, p_kind: input.kind, p_data: json(input.data),
  });
  if (result.error) throw new Error(`공고 작업 저장 실패: ${result.error.message}`);
  return result.data;
}
export async function queueDueCareerSourcesForJob(): Promise<number> {
  const result = await createAdminClient().rpc("queue_due_career_sources", { p_limit: 10 });
  if (result.error) throw new Error(`공고 감시 예약 실패: ${result.error.message}`);
  return result.data;
}
export async function getCareerCaseForJob(id: string) {
  const result = await createAdminClient().from("application_cases").select("*").eq("id", uuid(id)).single();
  if (result.error) throw new Error(`지원 케이스 조회 실패: ${result.error.message}`);
  return result.data;
}
export async function recordCareerFailureForJob(id: string, revision: number, message: string): Promise<void> {
  const result = await createAdminClient().from("opportunities").update({ last_error: message.slice(0, 1000) }).eq("id", id).eq("revision", revision);
  if (result.error) console.error("[career] 실패 표시 저장 실패:", result.error.message);
}
