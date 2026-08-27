import { NextResponse, type NextRequest } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";
import { recordSync } from "@/lib/repos/sync-state";
import { recordJobRun } from "@/lib/repos/job-runs";
import { upsertSecFilings } from "@/lib/repos/sec-filings";
import { fetchEdgarFilings, CIK_MAP } from "@/lib/integrations/sec/edgar";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * SEC EDGAR XBRL 실적 수집 잡.
 *
 * tickers 테이블에서 미국 개별 종목을 찾고, CIK_MAP에 매핑되는 것만 수집한다.
 * 월 1회 실행.
 */
export async function POST(request: NextRequest) {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date();
  const failures: Array<{ cik: string; error: string }> = [];
  let upserted = 0;

  try {
    // tickers에서 symbol → id 매핑을 가져온다
    const sb = createAdminClient();
    const { data: tickers, error: tickerErr } = await sb
      .from("tickers")
      .select("id, symbol")
      .in("symbol", Object.values(CIK_MAP));

    if (tickerErr) throw tickerErr;
    const symbolToId = new Map((tickers ?? []).map((t) => [t.symbol, t.id as string]));

    // CIK별로 순차 수집 (SEC rate limit 준수)
    for (const [cik, symbol] of Object.entries(CIK_MAP)) {
      const tickerId = symbolToId.get(symbol);
      if (!tickerId) {
        failures.push({ cik, error: `tickers에서 ${symbol} 없음 (시세 잡을 먼저 실행하세요)` });
        continue;
      }

      const result = await fetchEdgarFilings(cik, 4);
      if (!result.ok) {
        failures.push({ cik, error: result.error });
        continue;
      }

      const rows = result.filings.map((f) => ({
        ticker_id: tickerId,
        cik: f.cik,
        fiscal_end: f.fiscalEnd,
        form_type: f.formType,
        revenue: f.revenue,
        net_income: f.netIncome,
        eps: f.eps,
        total_assets: f.totalAssets,
        equity: f.equity,
        filed_at: f.filedAt,
      }));

      upserted += await upsertSecFilings(rows);

      // SEC courtesy: 200ms 딜레이
      await new Promise((r) => setTimeout(r, 200));
    }

    const error =
      failures.length > 0
        ? failures.map((f) => `${f.cik}: ${f.error}`).join("\n")
        : null;

    await recordJobRun({
      jobName: "fetch-sec-filings",
      startedAt,
      status: upserted > 0 || failures.length === 0 ? "ok" : "failed",
      error,
      meta: { tickers: Object.keys(CIK_MAP).length, upserted, failed: failures.length },
    });
    await recordSync("sec-filings", {
      status: upserted > 0 || failures.length === 0 ? "ok" : "failed",
      error,
    });

    return NextResponse.json({
      tickers: Object.keys(CIK_MAP).length,
      upserted,
      failures: failures.map((f) => ({ cik: f.cik, error: f.error })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordJobRun({ jobName: "fetch-sec-filings", startedAt, status: "failed", error: message });
    await recordSync("sec-filings", { status: "failed", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
