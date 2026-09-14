import type { NextRequest } from "next/server";
import { workHttp } from "@/lib/jobs/work-http";
import { actionResultSpeech } from "@/lib/repos/voice";
export async function POST(request:NextRequest){return workHttp(request,body=>actionResultSpeech(body as {sessionId:string;turnId:string;contextId:string;actionId:string}));}
