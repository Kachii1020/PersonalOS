import type { Json } from "@/lib/types/database";

export type FactKey = "graduation_date" | "academic_year" | "degree" | "major" | "university" | "residence" | "work_authorization" | "languages" | "available_from" | "available_until" | "weekly_days" | "skills";
export type CareerFact = { value: Json; verifiedAt: string; reviewAt: string; source: string };
export type CareerFacts = Partial<Record<FactKey, CareerFact>>;
export type RequirementOperator = "eq" | "one_of" | "all_of" | "gte" | "lte" | "between" | "not_required" | "unknown";
export type CareerRequirement = {
  id: string;
  field: FactKey;
  operator: RequirementOperator;
  expected: Json;
  hard: boolean;
  quote: string;
  sourceId: string;
  reviewed: boolean;
};
export type RequirementResult = { requirementId: string; result: "pass" | "fail" | "unknown" | "not_applicable"; reason: string };
export type Eligibility = "confirmed_eligible" | "possibly_eligible" | "not_eligible" | "next_cycle";
export type Lifecycle = "open" | "upcoming" | "closed" | "unknown";
export type CareerDecision = "none" | "reject" | "defer";
export type SourceEvidence = { id: string; text: string; checkedAt: string | null; available: boolean; official: boolean; reviewed: boolean };
export type AssessmentInput = {
  facts: CareerFacts;
  requirements: CareerRequirement[];
  source: SourceEvidence | null;
  lifecycle: Lifecycle;
  deadline: string | null;
  requirementsComplete: boolean;
  now: Date;
};
export type Assessment = { eligibility: Eligibility; lifecycle: Lifecycle; status: "act_now" | "learn" | "monitor" | "archive"; results: RequirementResult[]; reasons: string[] };
export type RankedOpportunity = {
  id: string; title: string; organization: string; eligibility: Eligibility; lifecycle: Lifecycle;
  deadline: string | null; verifiedAt: string | null; fit: number; value: number; effort: number;
  decision: CareerDecision; deferUntil: string | null; decisionReason: string | null;
  deliverableKey?: string | null;
};
export type CareerTopAction = RankedOpportunity & { score: number; reason: string };
