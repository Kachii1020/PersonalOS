import { getExercisesForModule } from "@/lib/spreadsheet/exercises";
import type { LabExerciseDef } from "@/lib/spreadsheet/types";
import type { Concept } from "./types";

/** 기본 경로. 순서가 경로다. 새 ID를 넣지 않는다. */
export const CORE_LAB_IDS = [
  "nav-cell-ref",
  "basic-fn-sum",
  "basic-fn-mixed-ref",
  "logic-if",
  "logic-iferror",
  "logic-sumifs",
  "lookup-index-match",
  "lookup-2d",
  "lookup-xlookup",
  "clean-trim",
  "clean-extract",
  "fin-npv",
  "fin-xnpv",
  "fin-pmt",
  "model-assumptions",
  "model-balance-check",
  "stmt-net-income",
  "stmt-cf-addback",
  "dcf-fcf",
  "dcf-ev-equity",
] as const;

export type CoreLabId = (typeof CORE_LAB_IDS)[number];

const CORE_LAB_ID_SET = new Set<string>(CORE_LAB_IDS);

export function isCoreLab(id: string): boolean {
  return CORE_LAB_ID_SET.has(id);
}

/** 모듈 핵심 목록. 순서는 CORE_LAB_IDS 부분열. */
export function coreLabsForModule(slug: string): LabExerciseDef[] {
  const byId = new Map(getExercisesForModule(slug).map((ex) => [ex.id, ex]));
  return CORE_LAB_IDS.flatMap((id) => {
    const ex = byId.get(id);
    return ex ? [ex] : [];
  });
}

export function extraLabsForModule(slug: string): LabExerciseDef[] {
  return getExercisesForModule(slug).filter((ex) => !isCoreLab(ex.id));
}

/** 개념 카드 「실습으로」 대상. 핵심이 있으면 그 중 첫 labId, 없으면 첫 extra. */
export function practiceLabId(concept: Concept): string | undefined {
  const coreId = concept.labIds.find((id) => isCoreLab(id));
  if (coreId) return coreId;
  return concept.labIds[0];
}

export function practiceOpensExtra(concept: Concept): boolean {
  const id = practiceLabId(concept);
  return Boolean(id && !isCoreLab(id));
}
