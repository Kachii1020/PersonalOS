// app/(dashboard)/learn/page.tsx
// Curriculum tracker + quiz interface.

import { Suspense } from "react";
import { LearnDashboard } from "@/components/widgets/LearnDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getLabCompletions,
  listLearnAttempts,
  listLearnCurricula,
  listLearnQuestionIdMap,
  listLearnQuizzes,
} from "@/lib/repos/learn";
import type { Quiz } from "@/lib/learn/curriculum";

export const metadata = { title: "Learn — Personal OS" };

async function LearnData() {
  const [questionIdMap, tracks, quizRows, labRows] = await Promise.all([
    listLearnQuestionIdMap(),
    listLearnCurricula(),
    listLearnQuizzes(),
    getLabCompletions(),
  ]);
  const allIds = Object.values(questionIdMap).flat();
  const existingAttempts = await listLearnAttempts(allIds);

  const dbQuizzes: Record<string, Quiz[]> = {};
  for (const row of quizRows) {
    if (!dbQuizzes[row.moduleSlug]) dbQuizzes[row.moduleSlug] = [];
    dbQuizzes[row.moduleSlug].push({
      id: row.id,
      q: row.question,
      options: row.choices,
      answer: row.answerIndex,
      explain: row.explanation,
    });
  }

  return (
    <LearnDashboard
      questionIdMap={questionIdMap}
      existingAttempts={existingAttempts}
      labCompletions={labRows.map((row) => row.exercise_id)}
      tracks={tracks}
      dbQuizzes={dbQuizzes}
    />
  );
}

export default function LearnPage() {
  return (
    <Suspense fallback={<LearnSkeleton />}>
      <LearnData />
    </Suspense>
  );
}

function LearnSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-2 w-full rounded" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
