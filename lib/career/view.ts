import type { Assessment, CareerFacts, CareerRequirement, CareerTopAction, Lifecycle, SourceEvidence } from "./types";

export type CareerCompany = {
  id: string; name: string; reason: string; officialPrefixes: string[]; tier: 1 | 2 | 3;
  enabled: boolean; windowStart: string | null; windowEnd: string | null;
};
export type CareerOpportunity = {
  id: string; companyId: string; organization: string; title: string; canonicalUrl: string;
  opportunityType: "job" | "internship" | "program" | "event" | "other";
  sourceClass: "official_posting" | "official_program" | "official_faq";
  lifecycle: Lifecycle; deadline: string | null; location: string | null; workMode: string | null;
  fit: number; value: number; effort: number; deliverableKey: string | null;
  decision: "none" | "reject" | "defer"; decisionReason: string | null; deferUntil: string | null;
  revision: number; source: SourceEvidence | null; requirements: CareerRequirement[];
  requirementsComplete: boolean; assessment: Assessment; lastError: string | null;
  nextCheckAt: string | null;
};
export type CareerCase = {
  id: string; opportunityId: string; title: string; stage: string; nextAction: string;
  dueAt: string | null; documents: string; interviews: string; contact: string;
  result: string; decisionReason: string; approvalId: string | null;
};
export type CareerDashboard = {
  facts: CareerFacts; profileRevision: number; companies: CareerCompany[];
  opportunities: CareerOpportunity[]; topActions: CareerTopAction[]; cases: CareerCase[];
};
export type CareerReview = {
  revision: number; title: string; lifecycle: Lifecycle; deadline: string | null;
  location: string | null; workMode: string | null; fit: number; value: number; effort: number;
  deliverableKey: string | null; requirements: CareerRequirement[]; complete: boolean;
};
