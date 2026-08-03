import { NextResponse, type NextRequest } from "next/server";
import { fetchNews } from "@/lib/integrations/news/fetch-news";
import { recordSync } from "@/lib/repos/sync-state";
import { recordJobRun } from "@/lib/repos/job-runs";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 뉴스 수집 잡.
 *
 * 소스 일부가 실패해도 나머지는 저장하고 200을 돌려준다 — 부분 실패는
 * job_runs.meta에 남고 sync_state로 배너에 드러난다. 전부 실패한 경우에만 500.
 */
export async function POST(request: NextRequest) {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date();

  try {
    const result = await fetchNews(startedAt);
    const allFailed = result.failures.length === result.sources;
    const status = result.failures.length > 0 ? "failed" : "ok";
    const error =
      result.failures.length > 0
        ? result.failures.map((f) => `${f.key}: ${f.error}`).join("\n")
        : null;

    await recordJobRun({
      jobName: "fetch-news",
      startedAt,
      status,
      error,
      meta: { sources: result.sources, inserted: result.inserted, failed: result.failures.length },
    });
    await recordSync("rss", { status, error, cursor: { inserted: result.inserted } });

    return NextResponse.json(result, { status: allFailed ? 500 : 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordJobRun({ jobName: "fetch-news", startedAt, status: "failed", error: message });
    await recordSync("rss", { status: "failed", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
