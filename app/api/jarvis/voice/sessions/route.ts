import type { NextRequest } from "next/server";
import { workHttp } from "@/lib/jobs/work-http";
import { startVoiceSession } from "@/lib/repos/voice";
import type { StartVoiceSessionInput } from "@/lib/jarvis/voice-types";
export const maxDuration=30;
export async function POST(request:NextRequest){return workHttp(request,body=>startVoiceSession(body as unknown as StartVoiceSessionInput));}
