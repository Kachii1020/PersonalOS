import { NextResponse, type NextRequest } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";
import { pruneDialogueDraftsForJob } from "@/lib/repos/jarvis-dialogue";
import { recordJobRun } from "@/lib/repos/job-runs";

export async function POST(request: NextRequest) {
  const denied = rejectUnauthorizedCron(request); if (denied) return denied;
  const startedAt = new Date();
  try {
    const pruned = await pruneDialogueDraftsForJob();
    await recordJobRun({ jobName: "prune-dialogue-drafts", startedAt, status: "ok", meta: { pruned } });
    return NextResponse.json({ pruned });
  } catch (error) {
    await recordJobRun({ jobName: "prune-dialogue-drafts", startedAt, status: "failed", error: error instanceof Error ? error.message : "Prune failed" });
    return NextResponse.json({ error: "초안 정리를 완료하지 못했습니다." }, { status: 500 });
  }
}
