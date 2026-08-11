import { NextResponse, type NextRequest } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";
import { recordSync } from "@/lib/repos/sync-state";
import { recordJobRun } from "@/lib/repos/job-runs";
import { upsertMacroSnapshots } from "@/lib/repos/macro";
import { fetchFredSeries } from "@/lib/integrations/finance/fred";
import { fetchEcosSeries } from "@/lib/integrations/finance/ecos";
import { MACRO_SERIES } from "@/config/macro-series";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 매크로 지표 수집 잡 (SPEC.md 5.3).
 *
 * FRED와 ECOS에서 각각 시리즈를 가져온다.
 * 키가 없는 소스는 건너뛴다 (앱을 죽이지 않는다).
 * 시리즈별 실패는 격리한다.
 */
export async function POST(request: NextRequest) {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date();
  const rows: Array<{
    source: string;
    series_id: string;
    display_name: string;
    as_of: string;
    value: number;
    unit: string | null;
  }> = [];
  const failures: Array<{ seriesId: string; error: string }> = [];

  try {
    // FRED 시리즈
    const fredSeries = MACRO_SERIES.filter((s) => s.source === "fred");
    for (const series of fredSeries) {
      const result = await fetchFredSeries(series.seriesId, 1);
      if (!result.ok) {
        failures.push({ seriesId: result.seriesId, error: result.error });
        continue;
      }
      for (const obs of result.observations) {
        rows.push({
          source: "fred",
          series_id: series.seriesId,
          display_name: series.displayName,
          as_of: obs.date,
          value: obs.value,
          unit: series.unit,
        });
      }
    }

    // ECOS 시리즈
    const ecosSeries = MACRO_SERIES.filter((s) => s.source === "ecos");
    for (const series of ecosSeries) {
      const result = await fetchEcosSeries(
        series.seriesId,
        series.ecosItemCode ?? "0",
        series.ecosCycle ?? "MM",
        1,
      );
      if (!result.ok) {
        failures.push({ seriesId: result.seriesId, error: result.error });
        continue;
      }
      for (const obs of result.observations) {
        rows.push({
          source: "ecos",
          series_id: series.seriesId,
          display_name: series.displayName,
          as_of: obs.date,
          value: obs.value,
          unit: series.unit,
        });
      }
    }

    const upserted = await upsertMacroSnapshots(rows);

    const error =
      failures.length > 0
        ? failures.map((f) => `${f.seriesId}: ${f.error}`).join("\n")
        : null;

    await recordJobRun({
      jobName: "fetch-macro",
      startedAt,
      status: upserted > 0 || failures.length === 0 ? "ok" : "failed",
      error,
      meta: { series: MACRO_SERIES.length, upserted, failed: failures.length },
    });
    await recordSync("macro", {
      status: upserted > 0 || failures.length === 0 ? "ok" : "failed",
      error,
    });

    return NextResponse.json({
      series: MACRO_SERIES.length,
      upserted,
      failures: failures.map((f) => ({ seriesId: f.seriesId, error: f.error })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordJobRun({ jobName: "fetch-macro", startedAt, status: "failed", error: message });
    await recordSync("macro", { status: "failed", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
