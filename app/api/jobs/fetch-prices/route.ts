import { NextResponse, type NextRequest } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";
import { recordSync } from "@/lib/repos/sync-state";
import { recordJobRun } from "@/lib/repos/job-runs";
import { listTickersForJob, seedTickers } from "@/lib/repos/tickers";
import { upsertPriceSnapshots } from "@/lib/repos/prices";
import { upsertFxRates } from "@/lib/repos/fx";
import { fetchQuotes } from "@/lib/integrations/finance/prices";
import { fetchFxRates } from "@/lib/integrations/finance/fx";
import { DEFAULT_TICKERS } from "@/config/tickers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 시세 + 환율 수집 잡 (SPEC.md Phase 3).
 *
 * 1. DB에 티커가 없으면 기본 20개를 시드한다.
 * 2. 전 티커의 시세를 yahoo-finance2로 가져온다.
 * 3. USD→KRW, USD→JPY 환율을 frankfurter.app에서 가져온다.
 *
 * 종목별 실패는 격리: 20개 중 2개가 실패해도 나머지 18개는 저장된다.
 */
export async function POST(request: NextRequest) {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date();

  try {
    // 1. 티커 확보
    let tickers = await listTickersForJob();
    if (tickers.length === 0) {
      await seedTickers(DEFAULT_TICKERS);
      tickers = await listTickersForJob();
    }

    // 2. 시세
    const symbols = tickers.map((t) => t.symbol);
    const quotes = await fetchQuotes(symbols);

    const symbolToId = new Map(tickers.map((t) => [t.symbol, t.id]));
    const today = new Date().toISOString().slice(0, 10);
    const successRows = quotes
      .filter((q): q is Extract<typeof q, { ok: true }> => q.ok)
      .map((q) => ({
        tickerId: symbolToId.get(q.symbol)!,
        asOf: today,
        close: q.close,
        changePct: q.changePct,
      }));

    const priceCount = await upsertPriceSnapshots(successRows);
    const failures = quotes.filter((q) => !q.ok);

    // 3. 환율
    let fxCount = 0;
    try {
      const fx = await fetchFxRates("USD", ["KRW", "JPY"]);
      fxCount = await upsertFxRates(fx.pairs.map((p) => ({ ...p, asOf: fx.asOf })));
    } catch (e) {
      // 환율 실패는 시세 결과를 무효화하지 않는다
      failures.push({
        symbol: "FX",
        error: e instanceof Error ? e.message : String(e),
        ok: false as const,
      });
    }

    const error =
      failures.length > 0
        ? failures.map((f) => `${f.symbol}: ${"error" in f ? f.error : "unknown"}`).join("\n")
        : null;

    await recordJobRun({
      jobName: "fetch-prices",
      startedAt,
      status: priceCount > 0 ? "ok" : "failed",
      error,
      meta: { tickers: tickers.length, prices: priceCount, fx: fxCount, failed: failures.length },
    });
    await recordSync("prices", {
      status: priceCount > 0 ? "ok" : "failed",
      error,
    });

    return NextResponse.json({
      tickers: tickers.length,
      prices: priceCount,
      fx: fxCount,
      failures: failures.map((f) => ({ symbol: f.symbol, error: "error" in f ? f.error : "unknown" })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordJobRun({ jobName: "fetch-prices", startedAt, status: "failed", error: message });
    await recordSync("prices", { status: "failed", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
