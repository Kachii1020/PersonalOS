"use server";

import { revalidatePath } from "next/cache";
import { createTask, setTaskStatus, updateTaskCategory } from "@/lib/repos/tasks";

export type TaskFormState = { ok: boolean; message: string } | null;

const JST = "+09:00";

export async function addTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("dueDate") ?? "");
  const time = String(formData.get("dueTime") ?? "");
  const category = String(formData.get("category") ?? "").trim();

  if (!title) return { ok: false, message: "할 일 제목을 입력하세요." };

  let dueAt: string | null = null;
  if (date) {
    const parsed = new Date(`${date}T${time || "23:59"}:00${JST}`);
    if (Number.isNaN(parsed.getTime())) return { ok: false, message: "마감 형식이 올바르지 않습니다." };
    dueAt = parsed.toISOString();
  }

  try {
    await createTask({ title, dueAt, category: category || null, notes: null });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/tasks");
  revalidatePath("/");
  return { ok: true, message: `'${title}'를 추가했습니다.` };
}

/** 완료 처리. 목록에서 사라지고 completed_at이 채워진다. */
export async function completeTask(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await setTaskStatus(id, "done");
  revalidatePath("/tasks");
  revalidatePath("/");
}

const CATEGORIES = new Set(["school", "career", "study", "invest", "etc"]);

/** 칸반 드래그 (2-B). 알 수 없는 분류가 오면 저장하지 않는다. */
export async function moveTaskCategory(
  id: string,
  category: string | null,
): Promise<{ ok: boolean; message: string }> {
  if (!id) return { ok: false, message: "태스크 ID가 없습니다." };
  if (category !== null && !CATEGORIES.has(category)) {
    return { ok: false, message: `알 수 없는 분류입니다: ${category}` };
  }

  try {
    await updateTaskCategory(id, category);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/tasks");
  return { ok: true, message: "분류를 옮겼습니다." };
}
