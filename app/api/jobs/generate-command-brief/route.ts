import { NextResponse, type NextRequest } from "next/server";
import { generateCommandBriefForJob } from "@/lib/jarvis/command-brief";
import { recordJobRun } from "@/lib/repos/job-runs";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;
  const startedAt = new Date();

  try {
    const brief = await generateCommandBriefForJob(startedAt);
    await recordJobRun({
      jobName: "generate-command-brief",
      startedAt,
      status: "ok",
      meta: {
        date: brief.date,
        topActions: brief.topActions.length,
        pendingApprovals: brief.sourceSnapshot.pendingApprovalCount,
      },
    });
    return NextResponse.json(brief);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordJobRun({
      jobName: "generate-command-brief",
      startedAt,
      status: "failed",
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
