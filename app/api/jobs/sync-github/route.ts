import { NextResponse, type NextRequest } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";
import { recordSync } from "@/lib/repos/sync-state";
import { recordJobRun } from "@/lib/repos/job-runs";
import { upsertRepos, upsertDailyCommits } from "@/lib/repos/github";
import { fetchRepos, fetchDailyCommits } from "@/lib/integrations/github/collect";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GitHub 수집 잡 (SPEC.md Phase 3).
 *
 * 1. 공개 레포 목록을 가져와 github_repos에 upsert한다.
 * 2. 이벤트 API에서 PushEvent를 집계해 일별 커밋 수를 저장한다.
 */
export async function POST(request: NextRequest) {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  const username = process.env.GITHUB_USERNAME;
  if (!username) {
    return NextResponse.json(
      { error: "GITHUB_USERNAME 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  const startedAt = new Date();

  try {
    const repos = await fetchRepos(username);
    const repoCount = await upsertRepos(repos);

    const dailyCommits = await fetchDailyCommits(username);
    const commitCount = await upsertDailyCommits(dailyCommits);

    await recordJobRun({
      jobName: "sync-github",
      startedAt,
      status: "ok",
      meta: { repos: repoCount, commitDays: commitCount },
    });
    await recordSync("github", { status: "ok" });

    return NextResponse.json({
      repos: repoCount,
      commitDays: commitCount,
      username,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordJobRun({ jobName: "sync-github", startedAt, status: "failed", error: message });
    await recordSync("github", { status: "failed", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
