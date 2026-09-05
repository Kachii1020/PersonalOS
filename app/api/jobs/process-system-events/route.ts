import { NextResponse, type NextRequest } from "next/server";
import { processJarvisSteps } from "@/lib/jarvis/orchestrator";
import { recordJobRun } from "@/lib/repos/job-runs";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;
  const startedAt = new Date();
  const workerId = `system-events-${crypto.randomUUID()}`;

  try {
    const results = await processJarvisSteps({ workerId, maxSteps: 6 });
    const failure = results.find((result) => result.kind === "failed");
    await recordJobRun({
      jobName: "process-system-events",
      startedAt,
      status: failure ? "failed" : "ok",
      error: failure?.message,
      meta: { workerId, results },
    });
    return NextResponse.json({ workerId, results }, { status: failure ? 500 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordJobRun({
      jobName: "process-system-events",
      startedAt,
      status: "failed",
      error: message,
      meta: { workerId },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
