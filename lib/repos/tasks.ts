import "server-only";
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
