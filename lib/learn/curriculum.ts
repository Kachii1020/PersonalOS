import { PHASE1 } from "./phase1";
import { PHASE2 } from "./phase2";
import { PHASE3 } from "./phase3";
import type { Concept, Module, Phase, PhaseResources } from "./types";

export type { Concept, ConceptKind, Module, Phase, PhaseResources, Quiz, ResourceLink } from "./types";

export const CURRICULUM: Phase[] = [PHASE1, PHASE2, PHASE3];

export const RESOURCES: PhaseResources[] = [
  {
    phase: 1,
    links: [
      {
        name: "Excel Practice Online",
        url: "https://excel-practice-online.com/",
        note: "브라우저에서 바로 연습",
      },
      {
        name: "LogicExcel 95 Exercises",
        url: "https://logicexcel.com/practice/excel-exercises",
        note: "함수별 무료 연습문제",
      },
    ],
  },
  {
    phase: 2,
    links: [
      {
        name: "CFI Excel Fundamentals",
        url: "https://corporatefinanceinstitute.com/course/excel-fundamentals-formulas-for-finance/",
        note: "재무용 엑셀 기초 (무료)",
      },
    ],
  },
  {
    phase: 3,
    links: [
      {
        name: "Damodaran Corporate Finance",
        url: "https://www.youtube.com/playlist?list=PLUkh9m2BorqlJsEfix7R9jtSXClFZhGvC",
        note: "재무 개념 (YouTube, 무료)",
      },
      {
        name: "CFI 3-Statement Model",
        url: "https://corporatefinanceinstitute.com/course/3-statement-modeling/",
        note: "모델 구축 (무료)",
      },
      {
        name: "Macabacus Tutorials",
        url: "https://macabacus.com/learn",
        note: "IB 엑셀 컨벤션",
      },
    ],
  },
];

export function allModules(): Module[] {
  return CURRICULUM.flatMap((phase) => phase.modules);
}

export function allConcepts(): Concept[] {
  return allModules().flatMap((mod) => mod.concepts);
}

export function allQuizzes() {
  return allModules().flatMap((mod) => mod.quizzes);
}
