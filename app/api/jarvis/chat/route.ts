import { NextResponse, type NextRequest } from "next/server";
import { answerDialogue, DialogueRequestError, requireDialogueOwner, validateChatMessages } from "@/lib/repos/jarvis-dialogue";
import { recordJobRun } from "@/lib/repos/job-runs";
import { answerWorkChat } from "@/lib/repos/work-chat";
import type { WorkChatInput } from "@/lib/jarvis/work-types";
import { WorkRequestError } from "@/lib/repos/work-contexts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "같은 앱에서 요청해 주세요." }, { status: 403 });
  const startedAt = new Date();
  try {
    const owner = await requireDialogueOwner();
    if (Number(request.headers.get("content-length")) > 48_000) throw new DialogueRequestError("요청이 너무 깁니다.", 413);
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = []; let bytes = 0;
    if (reader) for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 48_000) { await reader.cancel(); throw new DialogueRequestError("요청이 너무 깁니다.", 413); }
      chunks.push(value);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new DialogueRequestError("대화 요청 형식을 확인하세요.");
    const messages = validateChatMessages(body.messages);
    if (body.contextId != null || body.requestId !== undefined || body.expectedRevision !== undefined) {
      const reply = await answerWorkChat({ ...body, messages } as WorkChatInput);
      return NextResponse.json(reply);
    }
    if (body.selectedSourceId !== undefined && body.selectedSourceId !== null && (typeof body.selectedSourceId !== "string" || body.selectedSourceId.length > 200)) throw new DialogueRequestError("선택한 대상을 확인하세요.");
    const reply = await answerDialogue({ messages, selectedSourceId: body.selectedSourceId }, { owner });
    await recordJobRun({ jobName: "jarvis-dialogue", startedAt, status: "ok", meta: { mode: reply.mode, factCount: reply.facts.length, draftCreated: !!reply.draft, warnings: reply.warnings } });
    return NextResponse.json(reply);
  } catch (error) {
    const status = error instanceof DialogueRequestError || error instanceof WorkRequestError ? error.status : error instanceof SyntaxError ? 400 : error instanceof Error && error.name === "BudgetExceededError" ? 402 : 503;
    if (status >= 500 || status === 402) await recordJobRun({ jobName: "jarvis-dialogue", startedAt, status: "failed", error: error instanceof Error ? error.name : "DialogueError" });
    return NextResponse.json({ error: error instanceof DialogueRequestError || error instanceof WorkRequestError ? error.message : status === 402 ? "AI 예산을 모두 사용했습니다. 추가 실행은 하지 않았습니다." : "대화 요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요." }, { status });
  }
}
