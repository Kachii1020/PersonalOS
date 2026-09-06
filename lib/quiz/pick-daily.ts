import { QUIZ_DOMAINS } from "@/lib/ai/prompts/quiz";

export type DailyCandidate = {
  id: string;
  domain: string;
  curated: boolean;
};

const DOMAIN_SET = new Set<string>(QUIZ_DOMAINS);

export function isIbEngDomain(domain: string): boolean {
  return DOMAIN_SET.has(domain);
}

/**
 * 오늘 5칸. 복습 → 미응시(시드 우선) → 이미 푼 것.
 * 가능한 한 도메인을 돌아가며 집어 2종 이상이 나오게 한다.
 */
export function pickDailySet(input: {
  size: number;
  dueIds: readonly string[];
  questions: readonly DailyCandidate[];
  attemptedIds: ReadonlySet<string>;
  domain?: string;
}): string[] {
  const allowed = input.questions.filter((q) => isIbEngDomain(q.domain));
  const pool = input.domain ? allowed.filter((q) => q.domain === input.domain) : allowed;
  const byId = new Map(pool.map((q) => [q.id, q]));

  const picked: string[] = [];
  const seen = new Set<string>();

  for (const id of input.dueIds) {
    if (picked.length >= input.size) break;
    if (!byId.has(id) || seen.has(id)) continue;
    picked.push(id);
    seen.add(id);
  }

  const rest = pool.filter((q) => !seen.has(q.id));
  const unansweredCurated = rest.filter((q) => q.curated && !input.attemptedIds.has(q.id));
  const unansweredOther = rest.filter((q) => !q.curated && !input.attemptedIds.has(q.id));
  const answered = rest.filter((q) => input.attemptedIds.has(q.id));

  for (const group of [unansweredCurated, unansweredOther, answered]) {
    for (const id of rotateDomains(group)) {
      if (picked.length >= input.size) return picked;
      if (seen.has(id)) continue;
      picked.push(id);
      seen.add(id);
    }
  }

  return picked;
}

function rotateDomains(rows: readonly DailyCandidate[]): string[] {
  const buckets = new Map<string, DailyCandidate[]>();
  for (const row of rows) {
    const list = buckets.get(row.domain) ?? [];
    list.push(row);
    buckets.set(row.domain, list);
  }
  const domains = [...buckets.keys()].sort();
  const out: string[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const domain of domains) {
      const next = buckets.get(domain)?.shift();
      if (!next) continue;
      out.push(next.id);
      added = true;
    }
  }
  return out;
}
