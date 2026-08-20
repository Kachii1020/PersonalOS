import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  status: "open" | "done" | "dropped";
  category: string | null;
};

/** 마감이 기간 안에 있는 열린 태스크. 마감 이른 순. */
export async function listOpenTasksDueBetween(fromIso: string, toIso: string): Promise<TaskRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, notes, due_at, status, category")
    .eq("status", "open")
    .not("due_at", "is", null)
    .gte("due_at", fromIso)
    .lt("due_at", toIso)
    .order("due_at", { ascending: true });

  if (error) throw new Error(`태스크 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    notes: r.notes,
    dueAt: r.due_at,
    status: r.status as TaskRow["status"],
    category: r.category,
  }));
}

/** 열린 태스크 전부. 마감 없는 것은 뒤로 보낸다. */
export async function listOpenTasks(): Promise<TaskRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, notes, due_at, status, category")
    .eq("status", "open")
    .order("due_at", { ascending: true, nullsFirst: false });

  if (error) throw new Error(`태스크 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    notes: r.notes,
    dueAt: r.due_at,
    status: r.status as TaskRow["status"],
    category: r.category,
  }));
}

export type TaskFilters = {
  status: "open" | "done" | "all";
  category: string | null;
  sort: "due" | "created";
};

/** 필터 목록 (2-B). 리스트·칸반 뷰가 같은 쿼리를 쓴다. */
export async function listTasksFiltered(filters: TaskFilters): Promise<TaskRow[]> {
  const supabase = await createClient();
  let query = supabase.from("tasks").select("id, title, notes, due_at, status, category");

  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);

  query =
    filters.sort === "created"
      ? query.order("created_at", { ascending: false })
      : query.order("due_at", { ascending: true, nullsFirst: false });

  const { data, error } = await query;
  if (error) throw new Error(`태스크 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    notes: r.notes,
    dueAt: r.due_at,
    status: r.status as TaskRow["status"],
    category: r.category,
  }));
}

/** 칸반 드래그 (2-B). 카테고리만 바꾼다. */
export async function updateTaskCategory(id: string, category: string | null): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ category }).eq("id", id);
  if (error) throw new Error(`분류 변경 실패: ${error.message}`);
}

/** 태스크 생성. 마감은 선택이다 — 마감 없는 할 일도 목록에 남는다. */
export async function createTask(input: {
  title: string;
  dueAt: string | null;
  category: string | null;
  notes: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    title: input.title,
    due_at: input.dueAt,
    category: input.category,
    notes: input.notes,
  });
  if (error) throw new Error(`태스크 생성 실패: ${error.message}`);
}

/**
 * 잡 전용 (2-C 마감 임박 알림): due_at이 [from, to) 안인 열린 태스크.
 * sync-calendar가 매시 정각에 돌므로 [now, now+1h)를 주면 태스크당 대략 한 번 알림이 간다.
 */
export async function listTasksDueBetweenForJob(fromIso: string, toIso: string): Promise<TaskRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, notes, due_at, status, category")
    .eq("status", "open")
    .not("due_at", "is", null)
    .gte("due_at", fromIso)
    .lt("due_at", toIso)
    .order("due_at", { ascending: true });

  if (error) throw new Error(`마감 임박 태스크 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    notes: r.notes,
    dueAt: r.due_at,
    status: r.status as TaskRow["status"],
    category: r.category,
  }));
}

export async function setTaskStatus(id: string, status: TaskRow["status"]): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(`태스크 상태 변경 실패: ${error.message}`);
}
