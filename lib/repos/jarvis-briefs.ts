import "server-only";
import { buildCommandBrief } from "@/lib/jarvis/brief";
import { createAdminClient as createJarvisAdminClient } from "@/lib/supabase/admin";
import { createClient as createJarvisUserClient } from "@/lib/supabase/server";
import type { BriefApproval, BriefTask, CommandBrief, JsonValue } from "@/lib/jarvis/types";

type BriefRow = {
  brief_date: string;
  headline: string;
  top_actions: JsonValue;
  prepared_items: JsonValue;
  postponed_items: JsonValue;
  warnings: JsonValue;
  source_snapshot: JsonValue;
  generated_at: string;
};

type TaskRow = {
  id: string;
  title: string;
  due_at: string | null;
  defer_until: string | null;
  priority: number | null;
  estimated_minutes: number | null;
  category: string | null;
};

type ApprovalBriefRow = {
  id: string;
  title: string;
  action_type: string;
  requested_at: string;
};

const TASK_COLUMNS = "id, title, due_at, defer_until, priority, estimated_minutes, category";

function mapTask(row: TaskRow): BriefTask {
  return {
    id: row.id,
    title: row.title,
    dueAt: row.due_at,
    deferUntil: row.defer_until,
    priority: row.priority,
    estimatedMinutes: row.estimated_minutes,
    category: row.category,
  };
}

function mapApproval(row: ApprovalBriefRow): BriefApproval {
  return {
    id: row.id,
    title: row.title,
    actionType: row.action_type,
    requestedAt: row.requested_at,
  };
}

export async function listTasksForBriefForJob(): Promise<BriefTask[]> {
  return loadBriefTasks(createJarvisAdminClient());
}

// Rank after reading every open task; a high-priority task without a due date
// must not disappear behind the first 100 due-date-sorted rows.
async function loadBriefTasks(supabase: ReturnType<typeof createJarvisAdminClient>): Promise<BriefTask[]> {
  const tasks: BriefTask[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("tasks").select(TASK_COLUMNS)
      .eq("status", "open").order("id").range(offset, offset + 499);
    if (error) throw new Error(`브리핑용 할 일 조회 실패: ${error.message}`);
    tasks.push(...((data ?? []) as TaskRow[]).map(mapTask));
    if (!data || data.length < 500) return tasks;
  }
}

/** UI용 실시간 fallback. service role을 사용하지 않는다. */
export async function buildLiveCommandBrief(now = new Date()): Promise<CommandBrief> {
  const supabase = await createJarvisUserClient();
  const [tasksResult, approvalsResult] = await Promise.all([
    loadBriefTasks(supabase),
    supabase
      .from("approval_requests")
      .select("id, title, action_type, requested_at")
      .eq("status", "pending")
      .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
      .order("requested_at", { ascending: true })
      .limit(20),
  ]);

  if (approvalsResult.error) throw new Error(`실시간 브리핑용 승인 조회 실패: ${approvalsResult.error.message}`);

  return buildCommandBrief({
    tasks: tasksResult,
    approvals: ((approvalsResult.data ?? []) as ApprovalBriefRow[]).map(mapApproval),
    now,
  });
}

export async function saveCommandBriefForJob(brief: CommandBrief): Promise<void> {
  const supabase = createJarvisAdminClient();
  const { error } = await supabase.from("command_briefs").upsert(
    {
      brief_date: brief.date,
      headline: brief.headline,
      top_actions: brief.topActions,
      prepared_items: brief.preparedItems,
      postponed_items: brief.postponedItems,
      warnings: brief.warnings,
      source_snapshot: brief.sourceSnapshot,
      generated_at: brief.sourceSnapshot.generatedAt,
    },
    { onConflict: "brief_date" },
  );
  if (error) throw new Error(`커맨드 브리프 저장 실패: ${error.message}`);
}

export async function getCommandBrief(date: string): Promise<CommandBrief | null> {
  const supabase = await createJarvisUserClient();
  const { data, error } = await supabase
    .from("command_briefs")
    .select("brief_date, headline, top_actions, prepared_items, postponed_items, warnings, source_snapshot, generated_at")
    .eq("brief_date", date)
    .maybeSingle();
  if (error) throw new Error(`커맨드 브리프 조회 실패: ${error.message}`);
  if (!data) return null;
  const row = data as BriefRow;
  return {
    date: row.brief_date,
    headline: row.headline,
    topActions: row.top_actions as CommandBrief["topActions"],
    preparedItems: row.prepared_items as CommandBrief["preparedItems"],
    postponedItems: row.postponed_items as CommandBrief["postponedItems"],
    warnings: row.warnings as CommandBrief["warnings"],
    sourceSnapshot: row.source_snapshot as CommandBrief["sourceSnapshot"],
  };
}
