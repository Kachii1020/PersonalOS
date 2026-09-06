import { CONCURRENCY_QUESTIONS } from "./concurrency";
import { DATA_QUESTIONS } from "./data";
import { DS_QUESTIONS } from "./ds";
import { LATENCY_QUESTIONS } from "./latency";
import { MARKETS_QUESTIONS } from "./markets";
import { SYSTEMS_QUESTIONS } from "./systems";
import type { IbEngQuestion } from "./types";

export { IB_ENG_DOMAINS, IB_ENG_LESSONS, lessonFor } from "./catalog";
export type { IbEngDomainMeta, IbEngLesson, IbEngQuestion } from "./types";

export const IB_ENG_QUESTIONS: IbEngQuestion[] = [
  ...MARKETS_QUESTIONS,
  ...LATENCY_QUESTIONS,
  ...CONCURRENCY_QUESTIONS,
  ...DATA_QUESTIONS,
  ...SYSTEMS_QUESTIONS,
  ...DS_QUESTIONS,
];

export const IB_ENG_PER_DOMAIN = 15;

/** 시드·런타임 upsert 공통 키. `ib_eng_` 도메인 id 와 겹치지 않게 슬래시를 둔다. */
export function ibEngModuleSlug(id: string): string {
  return `ib_eng/${id}`;
}
