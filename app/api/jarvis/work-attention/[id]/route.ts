import type { NextRequest } from "next/server";
import { workHttp } from "@/lib/jobs/work-http";
import { mutateWorkAttention } from "@/lib/repos/work-attention";
import { DialogueRequestError } from "@/lib/repos/jarvis-dialogue";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
 return workHttp(request, async body => { if (!["hour","tomorrow","disable","ack"].includes(String(body.operation))) throw new DialogueRequestError("알림 동작을 확인하세요.");
  await mutateWorkAttention((await params).id, body.operation as "hour"|"tomorrow"|"disable"|"ack"); return { ok: true }; });
}
