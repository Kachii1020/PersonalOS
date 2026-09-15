import type { QuizDomain } from "@/lib/ai/prompts/quiz";

export type IbEngQuestion = {
  /** 안정 키. DB module_slug 는 `ib_eng/${id}`. 힌트 문장은 hint → concept_hint. */
  id: string;
  domain: QuizDomain;
  difficulty: 1 | 2 | 3;
  question: string;
  choices: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  explanation: string;
  hint: string;
};

export type IbEngLesson = {
  domain: QuizDomain;
  title: string;
  content: string;
  keyTerms: string[];
};

export type IbEngDomainMeta = {
  id: QuizDomain;
  title: string;
  blurb: string;
};
