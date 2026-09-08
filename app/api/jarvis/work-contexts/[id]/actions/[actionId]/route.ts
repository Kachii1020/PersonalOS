import type { NextRequest } from "next/server";
import { workHttp } from "@/lib/jobs/work-http";
import { approveWorkAction } from "@/lib/repos/work-chat";
import { DialogueRequestError } from "@/lib/repos/jarvis-dialogue";
export const maxDuration = 120;
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; actionId: string }> }) {
 return workHttp(request, async body => { if (body.decision !== "approved" && body.decision !== "rejected") throw new DialogueRequestError("승인 또는 거절만 가능합니다.");
  const { id, actionId } = await params; return { work: await approveWorkAction(id, actionId, body.decision) }; });
}
