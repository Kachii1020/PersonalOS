import type { NextRequest } from "next/server";
import { workHttp } from "@/lib/jobs/work-http";
import { processLiveVoiceDelegation } from "@/lib/repos/voice";
import type { LiveVoiceDelegationInput } from "@/lib/jarvis/voice-types";

export const maxDuration = 120;
export async function POST(request: NextRequest) {
  return workHttp(request, body => processLiveVoiceDelegation(body as unknown as LiveVoiceDelegationInput));
}
