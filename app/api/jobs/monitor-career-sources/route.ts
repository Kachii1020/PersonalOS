import { NextResponse, type NextRequest } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";
import { recordJobRun } from "@/lib/repos/job-runs";
import { queueDueCareerSourcesForJob } from "@/lib/repos/career";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export async function POST(request: NextRequest) {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;
  const startedAt = new Date();
  try {
    const queued = await queueDueCareerSourcesForJob();
    await recordJobRun({ jobName: "monitor-career-sources", startedAt, status: "ok", meta: { queued } });
    return NextResponse.json({ queued });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordJobRun({ jobName: "monitor-career-sources", startedAt, status: "failed", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
