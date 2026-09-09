import { NextResponse, type NextRequest } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";
import { processWorkAttention, acknowledgeWorkTick } from "@/lib/repos/work-worker";
import { recordJobRun } from "@/lib/repos/job-runs";
export const maxDuration = 120;
export async function POST(request: NextRequest) {
  const denied = rejectUnauthorizedCron(request); if (denied) return denied;
  const startedAt = new Date(); let slot: string | null = null;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    if (body.slot !== undefined && (typeof body.slot !== "string" || !Number.isFinite(Date.parse(body.slot)))) return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
    slot = body.slot ?? null;
    if (slot) await acknowledgeWorkTick(slot,false);
    const result = await processWorkAttention(`work-tick-${crypto.randomUUID()}`, undefined, slot ?? undefined);
    if (slot) await acknowledgeWorkTick(slot,true);
    await recordJobRun({ jobName: "work-tick", startedAt, status: "ok", meta: { slot, trigger: slot ? "scheduler" : "manual", ...result } });
    return NextResponse.json(result);
  } catch (error) {
    await recordJobRun({ jobName: "work-tick", startedAt, status: "failed", error: error instanceof Error ? error.message : "Work tick failed", meta: { slot } });
    return NextResponse.json({ error: "Work tick failed" }, { status: 500 });
  }
}
