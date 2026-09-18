export type ConceptKind = "grid" | "excel-only";

export type XlsxUnlock = "always" | "after-phase1-cores" | "after-phase2-cores" | "after-packs";

export type XlsxCheck =
  | { id: string; kind: "sheet-exists"; name: string }
  | { id: string; kind: "sheet-order"; names: string[] }
  | { id: string; kind: "cell-value"; sheet: string; addr: string; expected: number | string; tolerance?: number }
  | { id: string; kind: "cell-formula"; sheet: string; addr: string; pattern: string }
  | { id: string; kind: "named-range"; name: string }
  | { id: string; kind: "font-theme"; sheet: string; addr: string; role: "input" | "formula" | "link" }
  | { id: string; kind: "part-exists"; part: "pivot" | "query" | "chart" | "iteration" };

export type XlsxTask = {
  id: string;
  title: string;
  file: string;
  conceptIds: string[];
  unlock: XlsxUnlock;
  instruction: string;
  checks: XlsxCheck[];
};

export type XlsxCheckResult = {
  id: string;
  passed: boolean;
  message: string;
};

export type WorkbookSubmission = {
  taskId: string;
  status: "passed" | "failed";
  results: XlsxCheckResult[];
  submittedAt: string;
};

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
  xlsxTaskId?: string;
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
};

export type ResourceLink = { name: string; url: string; note: string };

export type PhaseResources = {
  phase: number;
  links: ResourceLink[];
};
