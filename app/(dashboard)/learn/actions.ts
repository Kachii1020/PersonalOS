"use server";

import { revalidatePath } from "next/cache";
import { recordAttempt } from "@/lib/repos/quiz";
import { createClient } from "@/lib/supabase/server";

export type LearnAnswerResult = {
  questionId: string;
  isCorrect: boolean;
} | null;

/**
 * /learn 퀴즈 응시 → quiz_attempts + quiz_review_queue 연동.
 * questionId가 없으면(DB 미시드) 기록하지 않고 null 반환.
 */
export async function submitLearnAnswer(
  questionId: string,
  chosenIndex: number,
  moduleSlug: string,
): Promise<LearnAnswerResult> {
  if (!questionId || !Number.isInteger(chosenIndex)) return null;

  const { isCorrect } = await recordAttempt(questionId, chosenIndex);

  // 모듈 전체 완료 여부 확인 → learn_progress 업데이트
  await syncModuleProgress(moduleSlug);

  revalidatePath("/learn");
  return { questionId, isCorrect };
}

/**
 * 모듈의 전체 문제를 풀었으면 learn_progress를 complete로 업데이트.
 * 일부만 풀었으면 in_progress.
 */
async function syncModuleProgress(moduleSlug: string): Promise<void> {
  const supabase = await createClient();

  // 해당 모듈의 문제 수
  const { count: totalCount } = await supabase
    .from("quiz_questions")
    .select("id", { count: "exact", head: true })
    .eq("domain", "excel_finance")
    .eq("module_slug", moduleSlug);

  if (!totalCount) return;

  // 해당 모듈의 응시된 문제 수 (distinct question_id)
  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id")
    .eq("domain", "excel_finance")
    .eq("module_slug", moduleSlug);

  if (!questions?.length) return;

  const qIds = questions.map((q) => q.id);
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("question_id")
    .in("question_id", qIds);

  const answeredIds = new Set((attempts ?? []).map((a) => a.question_id));

  // learn_modules에서 module_id 조회
  const { data: mod } = await supabase
    .from("learn_modules")
    .select("id")
    .eq("slug", moduleSlug)
    .maybeSingle();

  if (!mod) return;

  const status = answeredIds.size >= totalCount ? "complete" : "in_progress";
  const now = new Date().toISOString();

  await supabase.from("learn_progress").upsert(
    {
      module_id: mod.id,
      status,
      completed_at: status === "complete" ? now : null,
      updated_at: now,
    },
    { onConflict: "module_id" },
  );
}
