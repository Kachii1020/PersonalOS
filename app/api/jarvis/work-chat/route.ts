import type { NextRequest } from "next/server";
import { workHttp } from "@/lib/jobs/work-http";
import { answerWorkChat } from "@/lib/repos/work-chat";
import type { WorkChatInput } from "@/lib/jarvis/work-types";
export const maxDuration = 120;
export async function POST(request: NextRequest) { return workHttp(request, body => answerWorkChat(body as unknown as WorkChatInput)); }
