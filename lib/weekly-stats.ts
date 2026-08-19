/**
 * 주간 리뷰 숫자 집계. SQL에서 가져온 행을 여기서 접는다.
 * AI는 이 숫자를 만들지 않는다 — UI와 게이트가 같은 함수를 쓴다.
 */

export type DomainCount = { domain: string; total: number; correct: number; accuracyPct: number | null };

export type WeeklyStats = {
  weekStart: string;
  weekEnd: string;
  quiz: { total: number; correct: number; accuracyPct: number | null; byDomain: DomainCount[] };
  tasks: { created: number; completed: number };
  commits: { total: number };
};

export function accuracyPct(correct: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((correct / total) * 1000) / 10;
}

export function summarizeQuizAttempts(
  attempts: Array<{ domain: string; isCorrect: boolean }>,
): WeeklyStats["quiz"] {
  const byDomain = new Map<string, { total: number; correct: number }>();
  let total = 0;
  let correct = 0;
  for (const row of attempts) {
    total += 1;
    if (row.isCorrect) correct += 1;
    const bucket = byDomain.get(row.domain) ?? { total: 0, correct: 0 };
    bucket.total += 1;
    if (row.isCorrect) bucket.correct += 1;
    byDomain.set(row.domain, bucket);
  }
  return {
    total,
    correct,
    accuracyPct: accuracyPct(correct, total),
    byDomain: [...byDomain.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([domain, n]) => ({
        domain,
        total: n.total,
        correct: n.correct,
        accuracyPct: accuracyPct(n.correct, n.total),
      })),
  };
}

export function summarizeCommits(days: Array<{ commitCount: number }>): { total: number } {
  return { total: days.reduce((sum, d) => sum + d.commitCount, 0) };
}

export function buildWeeklyStats(input: {
  weekStart: string;
  weekEnd: string;
  attempts: Array<{ domain: string; isCorrect: boolean }>;
  tasksCreated: number;
  tasksCompleted: number;
  commitDays: Array<{ commitCount: number }>;
}): WeeklyStats {
  return {
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    quiz: summarizeQuizAttempts(input.attempts),
    tasks: { created: input.tasksCreated, completed: input.tasksCompleted },
    commits: summarizeCommits(input.commitDays),
  };
}
