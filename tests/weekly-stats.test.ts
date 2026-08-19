import test from "node:test";
import assert from "node:assert/strict";
import { accuracyPct, buildWeeklyStats, summarizeQuizAttempts } from "@/lib/weekly-stats";

test("정답률 — 3/5 = 60.0, 2/3 = 66.7, 0회는 null", () => {
  assert.equal(accuracyPct(3, 5), 60);
  assert.equal(accuracyPct(2, 3), 66.7);
  assert.equal(accuracyPct(0, 0), null);
});

test("주간 집계 — 퀴즈·태스크·커밋이 수기 계산과 일치", () => {
  const stats = buildWeeklyStats({
    weekStart: "2026-08-10",
    weekEnd: "2026-08-17",
    attempts: [
      { domain: "ib", isCorrect: true },
      { domain: "ib", isCorrect: false },
      { domain: "macro", isCorrect: true },
      { domain: "macro", isCorrect: true },
      { domain: "macro", isCorrect: false },
    ],
    tasksCreated: 4,
    tasksCompleted: 2,
    commitDays: [{ commitCount: 3 }, { commitCount: 1 }, { commitCount: 0 }],
  });

  // 수기: 3/5 = 60, ib 1/2 = 50, macro 2/3 = 66.7, 커밋 3+1+0 = 4
  assert.equal(stats.quiz.total, 5);
  assert.equal(stats.quiz.correct, 3);
  assert.equal(stats.quiz.accuracyPct, 60);
  assert.equal(stats.tasks.created, 4);
  assert.equal(stats.tasks.completed, 2);
  assert.equal(stats.commits.total, 4);

  const ib = stats.quiz.byDomain.find((d) => d.domain === "ib");
  const macro = stats.quiz.byDomain.find((d) => d.domain === "macro");
  assert.equal(ib?.accuracyPct, 50);
  assert.equal(macro?.accuracyPct, 66.7);
});

test("도메인별 정렬은 이름순", () => {
  const quiz = summarizeQuizAttempts([
    { domain: "system_design", isCorrect: true },
    { domain: "ai_ml", isCorrect: false },
  ]);
  assert.deepEqual(
    quiz.byDomain.map((d) => d.domain),
    ["ai_ml", "system_design"],
  );
});
