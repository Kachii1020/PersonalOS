import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SecFiling = {
  tickerId: string;
  cik: string;
  fiscalEnd: string;
  formType: string;
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
  totalAssets: number | null;
  equity: number | null;
  filedAt: string | null;
};

/** 잡에서 사용 — service_role로 upsert. */
export async function upsertSecFilings(
  rows: Array<{
    ticker_id: string;
    cik: string;
    fiscal_end: string;
    form_type: string;
    revenue: number | null;
    net_income: number | null;
    eps: number | null;
    total_assets: number | null;
    equity: number | null;
    filed_at: string | null;
  }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("sec_filings")
    .upsert(rows, { onConflict: "ticker_id,fiscal_end,form_type" })
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** UI에서 사용 — 종목별 최신 분기 실적 1건. */
export async function latestFilingPerTicker(): Promise<SecFiling[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("sec_filings")
    .select("ticker_id, cik, fiscal_end, form_type, revenue, net_income, eps, total_assets, equity, filed_at")
    .order("fiscal_end", { ascending: false })
    .limit(100);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // 종목별 최신 1건만 (가장 최근 fiscal_end)
  const seen = new Set<string>();
  const result: SecFiling[] = [];
  for (const row of data) {
    if (seen.has(row.ticker_id)) continue;
    seen.add(row.ticker_id);
    result.push({
      tickerId: row.ticker_id,
      cik: row.cik,
      fiscalEnd: row.fiscal_end,
      formType: row.form_type,
      revenue: row.revenue != null ? Number(row.revenue) : null,
      netIncome: row.net_income != null ? Number(row.net_income) : null,
      eps: row.eps != null ? Number(row.eps) : null,
      totalAssets: row.total_assets != null ? Number(row.total_assets) : null,
      equity: row.equity != null ? Number(row.equity) : null,
      filedAt: row.filed_at,
    });
  }
  return result;
}
