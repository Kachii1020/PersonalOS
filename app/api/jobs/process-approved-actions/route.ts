import { NextResponse, type NextRequest } from "next/server";
import { executeNextApprovedAction } from "@/lib/jarvis/executor";
import { recordJobRun } from "@/lib/repos/job-runs";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;
  const startedAt = new Date();
  const workerId = `approved-actions-${crypto.randomUUID()}`;

  try {
    const result = await executeNextApprovedAction(workerId);
    await recordJobRun({
      jobName: "process-approved-actions",
      startedAt,
      status: result.kind === "failed" ? "failed" : "ok",
      error: result.kind === "failed" ? result.message : null,
      meta: { workerId, result },
    });
    return NextResponse.json({ workerId, result }, { status: result.kind === "failed" ? 500 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordJobRun({
      jobName: "process-approved-actions",
      startedAt,
      status: "failed",
      error: message,
      meta: { workerId },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
