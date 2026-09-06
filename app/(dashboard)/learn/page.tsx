// app/(dashboard)/learn/page.tsx
// Curriculum tracker + quiz interface for Excel for Finance track.

import { Suspense } from "react";
import { LearnDashboard } from "@/components/widgets/LearnDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { getLabCompletions } from "@/lib/repos/learn";
import { listWorkbookSubmissions } from "@/lib/repos/learn-workbooks";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Learn — Personal OS" };

/** quiz_questions → module_slug별 question ID 배열 (concept_hint 순). */
async function fetchQuestionIdMap(): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quiz_questions")
    .select("id, module_slug, concept_hint")
    .eq("domain", "excel_finance")
    .not("module_slug", "is", null)
    .order("module_slug")
    .order("concept_hint");

  if (!data?.length) return {};

  const map: Record<string, string[]> = {};
  for (const row of data) {
    if (!row.module_slug) continue;
    if (!map[row.module_slug]) map[row.module_slug] = [];
    map[row.module_slug].push(row.id);
  }
  return map;
}

/** 기존 응시 기록에서 문항별 최신 응답을 가져온다. */
async function fetchExistingAttempts(
  questionIds: string[],
): Promise<Record<string, { chosenIndex: number; isCorrect: boolean }>> {
  if (questionIds.length === 0) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("quiz_attempts")
    .select("question_id, chosen_index, is_correct")
    .in("question_id", questionIds)
    .order("attempted_at", { ascending: false });

  const map: Record<string, { chosenIndex: number; isCorrect: boolean }> = {};
  for (const row of data ?? []) {
    if (!map[row.question_id]) {
      map[row.question_id] = { chosenIndex: row.chosen_index, isCorrect: row.is_correct };
    }
  }
  return map;
}

async function LearnData() {
  const questionIdMap = await fetchQuestionIdMap();
  const allIds = Object.values(questionIdMap).flat();
  const existingAttempts = await fetchExistingAttempts(allIds);
  const [labRows, workbookSubmissions] = await Promise.all([
    getLabCompletions(),
    listWorkbookSubmissions(),
  ]);

  return (
    <LearnDashboard
      questionIdMap={questionIdMap}
      existingAttempts={existingAttempts}
      labCompletions={labRows.map((row) => row.exercise_id)}
      workbookSubmissions={workbookSubmissions}
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
