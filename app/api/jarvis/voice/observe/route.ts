import { workHttp } from "@/lib/jobs/work-http";
import { observeVoicePlayback } from "@/lib/repos/voice";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  return workHttp(request, body => observeVoicePlayback(body));
}
