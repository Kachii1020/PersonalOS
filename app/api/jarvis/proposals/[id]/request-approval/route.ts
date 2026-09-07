import { NextResponse, type NextRequest } from "next/server";
import { DialogueRequestError, requestDialogueApproval } from "@/lib/repos/jarvis-dialogue";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "같은 앱에서 요청해 주세요." }, { status: 403 });
  try {
    const approvalId = await requestDialogueApproval((await params).id);
    return NextResponse.json({ approvalId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof DialogueRequestError ? error.message : "승인 요청을 저장하지 못했습니다." }, { status: error instanceof DialogueRequestError ? error.status : 503 });
  }
}
