import type { NextRequest } from "next/server";
import { workHttp } from "@/lib/jobs/work-http";
import { acknowledgeWorkDelivery } from "@/lib/repos/work-attention";
import { DialogueRequestError } from "@/lib/repos/jarvis-dialogue";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
 return workHttp(request, async body => { if (body.event !== "received" && body.event !== "opened") throw new DialogueRequestError("기기 관측 동작을 확인하세요.");
  await acknowledgeWorkDelivery((await params).id, body.event); return { ok: true }; });
}
