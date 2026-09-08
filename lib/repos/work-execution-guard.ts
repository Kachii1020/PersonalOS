import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
/** Uses the existing Phase6 draft table, so feature-off standalone actions do not depend on new tables. */
export async function assertWorkFeatureForApprovalForJob(id: string): Promise<void> {
  if (process.env.JARVIS_CONTEXT_ENABLED === "true") return;
  const result = await createAdminClient().from("dialogue_action_drafts").select("source_snapshot").eq("approval_request_id", id).maybeSingle();
  if (result.error) throw new Error("업무 실행 경계를 확인하지 못했습니다.");
  const source = result.data?.source_snapshot;
  if (source && typeof source === "object" && !Array.isArray(source) && source.workContextId) throw new Error("업무 기능이 비활성화되어 새 실행을 중단했습니다.");
}
