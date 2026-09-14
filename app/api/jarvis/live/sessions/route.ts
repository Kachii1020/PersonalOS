import type { NextRequest } from "next/server";
import { workHttp } from "@/lib/jobs/work-http";
import { startLiveVoiceSession } from "@/lib/repos/voice";
import type { StartLiveVoiceSessionInput } from "@/lib/jarvis/voice-types";

export const maxDuration = 30;
export async function POST(request: NextRequest) {
  return workHttp(request, body => startLiveVoiceSession(body as unknown as StartLiveVoiceSessionInput));
}
