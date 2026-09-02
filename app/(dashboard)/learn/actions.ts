"use server";

import { revalidatePath } from "next/cache";
import { recordAttempt } from "@/lib/repos/quiz";
import { getLabCompletions, recordLabCompletion } from "@/lib/repos/learn";
import { listWorkbookSubmissions, recordWorkbookSubmission } from "@/lib/repos/learn-workbooks";
import { coreLabsForModule } from "@/lib/learn/core-track";
import { allModules } from "@/lib/learn/curriculum";
import { getXlsxTask, tasksForModule } from "@/lib/learn/xlsx-tasks";
import { canSubmitXlsx } from "@/lib/learn/xlsx-unlock";
import { gradeWorkbook } from "@/lib/integrations/xlsx/grade";
import { createClient } from "@/lib/supabase/server";
import type { XlsxCheckResult } from "@/lib/learn/types";

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

  await syncModuleProgress(moduleSlug, coreLabsForModule(moduleSlug).map((ex) => ex.id));

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

  await syncModuleProgress(moduleSlug, coreLabsForModule(moduleSlug).map((ex) => ex.id));
  revalidatePath("/learn");
  return { ok: true };
}

/**
 * 모듈의 전체 문제를 풀었으면 learn_progress를 complete로 업데이트.
 * 일부만 풀었으면 in_progress.
 * coreLabIds를 넘기면 MCQ + 핵심 실습을 합산한다. extra는 세지 않는다.
 * 생략하면 기존 MCQ-only 판정.
 */
async function syncModuleProgress(
  moduleSlug: string,
  coreLabIds?: string[],
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

  const mcqComplete = totalCount === 0 || answeredCount >= totalCount;
  if (coreLabIds === undefined) {
    if (!totalCount) return;
    const now = new Date().toISOString();
    await supabase.from("learn_progress").upsert(
      {
        module_id: mod.id,
        status: mcqComplete ? "complete" : "in_progress",
        completed_at: mcqComplete ? now : null,
        updated_at: now,
      },
      { onConflict: "module_id" },
    );
    return;
  }

  let labComplete = coreLabIds.length === 0;
  if (coreLabIds.length > 0) {
    const { count: labsDone } = await supabase
      .from("lab_completions")
      .select("id", { count: "exact", head: true })
      .eq("module_slug", moduleSlug)
      .in("exercise_id", coreLabIds);
    labComplete = (labsDone ?? 0) >= coreLabIds.length;
  }

  const packMod = allModules().find((m) => m.id === moduleSlug);
  const packIds = packMod ? tasksForModule(packMod).map((task) => task.id) : [];
  let packComplete = packIds.length === 0;
  if (packIds.length > 0) {
    const { data: packs, error: packError } = await supabase
      .from("workbook_submissions")
      .select("task_id, status")
      .in("task_id", packIds);
    if (packError) {
      if (packError.code !== "42P01") {
        throw new Error(`엑셀 과제 진행 조회 실패: ${packError.message}`);
      }
      packComplete = false;
    } else {
      packComplete = packIds.every((id) =>
        (packs ?? []).some((row) => row.task_id === id && row.status === "passed"),
      );
    }
  }

  const status = labComplete && mcqComplete && packComplete ? "complete" : "in_progress";
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

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLSX_MAX = 5 * 1024 * 1024;

export async function submitWorkbook(
  taskId: string,
  formData: FormData,
): Promise<
  | { ok: true; status: "passed" | "failed"; results: XlsxCheckResult[] }
  | { ok: false; error: string }
> {
  const task = getXlsxTask(taskId);
  if (!task) return { ok: false, error: "없는 과제입니다." };
  const [labRows, submissions] = await Promise.all([
    getLabCompletions(),
    listWorkbookSubmissions(),
  ]);
  if (!canSubmitXlsx(task, labRows.map((row) => row.exercise_id), submissions)) {
    return { ok: false, error: "핵심 실습을 더 끝내면 제출할 수 있습니다." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "파일이 없습니다." };
  if (file.size === 0 || file.size > XLSX_MAX) {
    return { ok: false, error: "파일은 5MB 이하의 xlsx여야 합니다." };
  }
  const nameOk = file.name.toLowerCase().endsWith(".xlsx");
  const mimeOk = file.type === XLSX_MIME || file.type === "application/zip" || file.type === "";
  if (!nameOk || !mimeOk) {
    return { ok: false, error: "xlsx 파일만 받습니다." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const graded = gradeWorkbook(task, bytes);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const saved = await recordWorkbookSubmission({
    userId: user.id,
    taskId,
    bytes,
    status: graded.status,
    results: graded.results,
  });
  if (!saved.ok) return saved;

  for (const mod of allModules()) {
    if (tasksForModule(mod).some((item) => item.id === taskId)) {
      await syncModuleProgress(mod.id, coreLabsForModule(mod.id).map((ex) => ex.id));
    }
  }

  revalidatePath("/learn");
  return { ok: true, status: graded.status, results: graded.results };
}
