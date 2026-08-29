"use server";

import { revalidatePath } from "next/cache";
import { recordAttempt } from "@/lib/repos/quiz";
import { recordLabCompletion } from "@/lib/repos/learn";
import { getExercisesForModule } from "@/lib/spreadsheet/exercises";
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

export async function submitLabCompletion(
  exerciseId: string,
  moduleSlug: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!exerciseId || !moduleSlug) {
    return { ok: false, error: "실습 ID가 없습니다." };
  }

  const recorded = await recordLabCompletion(exerciseId, moduleSlug);
  if (!recorded.ok) return recorded;

  await syncModuleProgress(moduleSlug, getExercisesForModule(moduleSlug).length);
  revalidatePath("/learn");
  return { ok: true };
}

/**
 * 모듈의 전체 문제를 풀었으면 learn_progress를 complete로 업데이트.
 * 일부만 풀었으면 in_progress.
 * totalLabCount를 넘기면 MCQ + 실습을 합산한다. 생략하면 기존 MCQ-only 판정.
 */
async function syncModuleProgress(
  moduleSlug: string,
  totalLabCount?: number,
): Promise<void> {
  const supabase = await createClient();

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id")
    .eq("domain", "excel_finance")
    .eq("module_slug", moduleSlug);

  const qIds = (questions ?? []).map((q) => q.id);
  const totalCount = qIds.length;

  let answeredCount = 0;
  if (qIds.length > 0) {
    const { data: attempts } = await supabase
      .from("quiz_attempts")
      .select("question_id")
      .in("question_id", qIds);
    answeredCount = new Set((attempts ?? []).map((a) => a.question_id)).size;
  }

  const { data: mod } = await supabase
    .from("learn_modules")
    .select("id")
    .eq("slug", moduleSlug)
    .maybeSingle();

  if (!mod) return;

  let status: "complete" | "in_progress";
  if (totalLabCount === undefined) {
    if (!totalCount) return;
    status = answeredCount >= totalCount ? "complete" : "in_progress";
  } else {
    const { count: labsDone } = await supabase
      .from("lab_completions")
      .select("id", { count: "exact", head: true })
      .eq("module_slug", moduleSlug);
    const labComplete = (labsDone ?? 0) >= totalLabCount;
    const mcqComplete = totalCount === 0 || answeredCount >= totalCount;
    status = labComplete && mcqComplete ? "complete" : "in_progress";
  }

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
