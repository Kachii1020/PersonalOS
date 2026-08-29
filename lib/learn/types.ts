export type ConceptKind = "grid" | "excel-only";

export type Quiz = {
  id: string;
  q: string;
  options: string[];
  answer: number;
  explain: string;
};

export type Concept = {
  id: string;
  title: string;
  kind: ConceptKind;
  why: string;
  syntax?: string;
  trap: string;
  ib: string;
  labIds: string[];
  quizIds: string[];
};

export type Module = {
  id: string;
  title: string;
  concepts: Concept[];
  quizzes: Quiz[];
};

export type Phase = {
  phase: number;
  title: string;
  weeks: string;
  desc: string;
  modules: Module[];
  practiceFile?: { name: string; href: string };
};

export type ResourceLink = { name: string; url: string; note: string };

export type PhaseResources = {
  phase: number;
  links: ResourceLink[];
};
