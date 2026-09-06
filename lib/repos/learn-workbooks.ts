import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { WorkbookSubmission, XlsxCheckResult } from "@/lib/learn/types";

export type { WorkbookSubmission };

const BUCKET = "learn-workbooks";

export async function listWorkbookSubmissions(): Promise<WorkbookSubmission[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workbook_submissions")
    .select("task_id, status, results, submitted_at");
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(`엑셀 과제 조회 실패: ${error.message}`);
  }
  return (data ?? []).map((row) => ({
    taskId: row.task_id,
    status: row.status as "passed" | "failed",
    results: (row.results ?? []) as XlsxCheckResult[],
    submittedAt: row.submitted_at,
  }));
}

export async function recordWorkbookSubmission(input: {
  userId: string;
  taskId: string;
  bytes: Uint8Array;
  status: "passed" | "failed";
  results: XlsxCheckResult[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const storagePath = `${input.userId}/${input.taskId}.xlsx`;

  const upload = await supabase.storage.from(BUCKET).upload(storagePath, input.bytes, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  });
  if (upload.error) {
    return { ok: false, error: `파일 저장 실패: ${upload.error.message}` };
  }

  const { error } = await supabase.from("workbook_submissions").upsert(
    {
      task_id: input.taskId,
      storage_path: storagePath,
      status: input.status,
      results: input.results,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "task_id" },
  );
  if (error) {
    return { ok: false, error: `채점 기록 실패: ${error.message}` };
  }
  return { ok: true };
}
