import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type MacroSnapshot = {
  source: string;
  seriesId: string;
  displayName: string;
  asOf: string;
  value: number;
  unit: string | null;
};

/** 잡에서 사용 — service_role로 upsert. */
export async function upsertMacroSnapshots(
  rows: Array<{
    source: string;
    series_id: string;
    display_name: string;
    as_of: string;
    value: number;
    unit: string | null;
  }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("macro_snapshots")
    .upsert(rows, { onConflict: "source,series_id,as_of" })
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** UI에서 사용 — 시리즈별 최신 1건. */
export async function latestMacroSnapshots(): Promise<MacroSnapshot[]> {
  const sb = await createClient();

  // 시리즈별 최신 행만 가져온다 (distinct on 대신 서브쿼리 회피, 전체 가져온 뒤 JS에서 dedup)
  const { data, error } = await sb
    .from("macro_snapshots")
    .select("source, series_id, display_name, as_of, value, unit")
    .order("as_of", { ascending: false })
    .limit(100);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const seen = new Set<string>();
  const result: MacroSnapshot[] = [];
  for (const row of data) {
    const key = `${row.source}:${row.series_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      source: row.source,
      seriesId: row.series_id,
      displayName: row.display_name,
      asOf: row.as_of,
      value: Number(row.value),
      unit: row.unit,
    });
  }
  return result;
}
