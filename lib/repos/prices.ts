import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PriceSnapshot = {
  id: number;
  tickerId: string;
  asOf: string;
  close: number;
  changePct: number | null;
};

type PriceRow = {
  id: number;
  ticker_id: string;
  as_of: string;
  close: number;
  change_pct: number | null;
};

function toSnapshot(r: PriceRow): PriceSnapshot {
  return {
    id: r.id,
    tickerId: r.ticker_id,
    asOf: r.as_of,
    close: Number(r.close),
    changePct: r.change_pct != null ? Number(r.change_pct) : null,
  };
}

/** 잡 전용. upsert by (ticker_id, as_of). */
export async function upsertPriceSnapshots(
  rows: Array<{ tickerId: string; asOf: string; close: number; changePct: number | null }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("price_snapshots")
    .upsert(
      rows.map((r) => ({
        ticker_id: r.tickerId,
        as_of: r.asOf,
        close: r.close,
        change_pct: r.changePct,
      })),
      { onConflict: "ticker_id,as_of" },
    )
    .select("id");

  if (error) throw new Error(`시세 저장 실패: ${error.message}`);
  return data?.length ?? 0;
}

/** UI용. 티커별 최신 스냅샷 1건. */
export async function latestPrices(): Promise<PriceSnapshot[]> {
  const supabase = await createClient();
  // distinct on은 REST API로 직접 못 하므로 rpc나 전략 변경 필요.
  // 간단하게: 최근 2일치를 가져와서 JS에서 ticker별 최신 1건을 뽑는다.
  const { data, error } = await supabase
    .from("price_snapshots")
    .select("id, ticker_id, as_of, close, change_pct")
    .order("as_of", { ascending: false })
    .limit(200);

  if (error) throw new Error(`시세 조회 실패: ${error.message}`);
  const seen = new Set<string>();
  const result: PriceSnapshot[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.ticker_id)) continue;
    seen.add(row.ticker_id);
    result.push(toSnapshot(row));
  }
  return result;
}

/** 잡 전용. 최신 시세 조회 (실패 시 마지막 값 표시용). */
export async function latestPricesForJob(): Promise<PriceSnapshot[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("price_snapshots")
    .select("id, ticker_id, as_of, close, change_pct")
    .order("as_of", { ascending: false })
    .limit(200);

  if (error) throw new Error(`시세 조회 실패: ${error.message}`);
  const seen = new Set<string>();
  const result: PriceSnapshot[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.ticker_id)) continue;
    seen.add(row.ticker_id);
    result.push(toSnapshot(row));
  }
  return result;
}
