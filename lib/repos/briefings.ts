import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { BriefingSectionPayload } from "@/lib/ai/prompts/briefing";

export type BriefingStatus = "pending" | "ready" | "failed";

export type Briefing = {
  id: string;
  briefingDate: string;
  status: BriefingStatus;
  generatedAt: string | null;
  costUsd: number | null;
  sections: BriefingSectionPayload[];
};

/** 잡 전용. 같은 날짜에 두 번 돌면 기존 행을 다시 쓴다 (briefing_date가 unique). */
export async function startBriefing(dateIso: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("briefings")
    .upsert({ briefing_date: dateIso, status: "pending" }, { onConflict: "briefing_date" })
    .select("id")
    .single();

  if (error) throw new Error(`브리핑 생성 실패: ${error.message}`);

  // 재생성이면 이전 섹션을 지운다. 남겨두면 옛 섹션과 새 섹션이 섞인다.
  await supabase.from("briefing_sections").delete().eq("briefing_id", data.id);
  return data.id;
}

export async function completeBriefing(
  briefingId: string,
  sections: BriefingSectionPayload[],
  usage: { inputToken: number; outputToken: number; costUsd: number },
): Promise<number> {
  const supabase = createAdminClient();

  const { error: sectionError } = await supabase.from("briefing_sections").insert(
    sections.map((section, index) => ({
      briefing_id: briefingId,
      sector: section.sector,
      lang: section.lang,
      headline: section.headline,
      bullets: section.bullets,
      why_it_matters: section.why_it_matters,
      source_urls: section.source_urls,
      position: index,
    })),
  );
  if (sectionError) throw new Error(`브리핑 섹션 저장 실패: ${sectionError.message}`);

  const { error } = await supabase
    .from("briefings")
    .update({
      status: "ready",
      generated_at: new Date().toISOString(),
      input_token: usage.inputToken,
      output_token: usage.outputToken,
      cost_usd: usage.costUsd,
    })
    .eq("id", briefingId);
  if (error) throw new Error(`브리핑 상태 갱신 실패: ${error.message}`);

  return sections.length;
}

export async function failBriefing(briefingId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("briefings").update({ status: "failed" }).eq("id", briefingId);
  if (error) console.error("[briefings] 실패 상태 기록 실패:", error.message);
}

/** UI용. 가장 최근 브리핑 하나를 섹션과 함께 읽는다. */
export async function latestBriefing(): Promise<Briefing | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("briefings")
    .select(
      "id, briefing_date, status, generated_at, cost_usd, briefing_sections(sector, lang, headline, bullets, why_it_matters, source_urls, position)",
    )
    .order("briefing_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  // null은 "아직 브리핑이 없음"을 뜻한다. 조회 실패를 null로 바꾸면 둘이 섞인다.
  if (error) throw new Error(`브리핑 조회 실패: ${error.message}`);
  if (!data) return null;

  const sections = [...(data.briefing_sections ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      sector: s.sector as BriefingSectionPayload["sector"],
      lang: s.lang as BriefingSectionPayload["lang"],
      headline: s.headline,
      bullets: s.bullets,
      why_it_matters: s.why_it_matters,
      source_urls: s.source_urls,
    }));

  return {
    id: data.id,
    briefingDate: data.briefing_date,
    status: data.status as BriefingStatus,
    generatedAt: data.generated_at,
    costUsd: data.cost_usd === null ? null : Number(data.cost_usd),
    sections,
  };
}

/** 아카이브 목록. 섹션은 싣지 않는다. */
export async function listBriefings(limit = 30): Promise<
  Array<{ id: string; briefingDate: string; status: BriefingStatus; sectionCount: number; costUsd: number | null }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("briefings")
    .select("id, briefing_date, status, cost_usd, briefing_sections(count)")
    .order("briefing_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`브리핑 목록 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    briefingDate: r.briefing_date,
    status: r.status as BriefingStatus,
    sectionCount: r.briefing_sections?.[0]?.count ?? 0,
    costUsd: r.cost_usd === null ? null : Number(r.cost_usd),
  }));
}
