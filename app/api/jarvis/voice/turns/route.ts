import type { NextRequest } from "next/server";
import { workHttp } from "@/lib/jobs/work-http";
import { processVoiceTurn } from "@/lib/repos/voice";
import type { VoiceTurnInput } from "@/lib/jarvis/voice-types";
export const maxDuration=120;
export async function POST(request:NextRequest){return workHttp(request,body=>processVoiceTurn(body as unknown as VoiceTurnInput));}
