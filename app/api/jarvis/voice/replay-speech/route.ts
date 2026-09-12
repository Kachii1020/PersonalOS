import type { NextRequest } from "next/server";
import { workHttp } from "@/lib/jobs/work-http";
import { reissueSpeech } from "@/lib/repos/voice";
import type { SpeechTicket } from "@/lib/jarvis/voice-types";
export async function POST(request:NextRequest){return workHttp(request,body=>reissueSpeech(body as unknown as SpeechTicket));}
