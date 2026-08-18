import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AiPurpose = "briefing" | "quiz" | "material_summary" | "domain_lesson" | "weekly_review";

export type UsageRecord = {
  purpose: AiPurpose;
  model: string;
  inputToken: number;
  outputToken: number;
  costUsd: number;
};

/** 이번 달(UTC 기준) 누적 비용. 예산 가드가 매 호출 전에 읽는다. */
export async function monthlyCostUsd(now: Date = new Date()): Promise<number> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("ai_usage").select("cost_usd").gte("used_at", monthStart);

  if (error) {
    // 예산을 못 읽으면 호출을 막는다. 조회 실패를 "0달러 썼음"으로 처리하면
    // 장애 상황에서 예산이 무제한이 된다.
    throw new Error(`AI 사용량 조회 실패: ${error.message}`);
  }
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd), 0);
}

export async function recordUsage(usage: UsageRecord): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("ai_usage").insert({
    purpose: usage.purpose,
    model: usage.model,
    input_token: usage.inputToken,
    output_token: usage.outputToken,
    cost_usd: usage.costUsd,
  });
  if (error) throw new Error(`AI 사용량 기록 실패: ${error.message}`);
}
