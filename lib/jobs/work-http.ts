import { NextResponse, type NextRequest } from "next/server";
import { requireWorkOwner } from "@/lib/repos/work-contexts";
import { requireWorkEnabled } from "@/lib/repos/work-chat";
import { DialogueRequestError } from "@/lib/repos/jarvis-dialogue";
import { recordJobRun } from "@/lib/repos/job-runs";

export async function workHttp(request: NextRequest, callback: (body: Record<string, unknown>) => Promise<unknown>) {
  const startedAt = new Date();
  try {
    requireWorkEnabled();
    if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) throw new DialogueRequestError("같은 앱에서 요청하세요.", 403);
    await requireWorkOwner();
    let body: Record<string, unknown> = {};
    if (request.method !== "GET") {
      const reader = request.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      if (reader) for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 48000) { await reader.cancel(); throw new DialogueRequestError("요청이 너무 큽니다.", 413); } chunks.push(value); }
      const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new DialogueRequestError("요청 형식을 확인하세요.");
      body = parsed as Record<string, unknown>;
    }
    return NextResponse.json(await callback(body));
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : error instanceof Error && error.name === "BudgetExceededError" ? 402
      : error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 503;
    if (status >= 500 || status === 402) await recordJobRun({ jobName: "work-api", startedAt, status: "failed", error: error instanceof Error ? error.name : "WorkError" });
    return NextResponse.json({ error: status >= 500 ? "업무 처리에 실패했습니다. 같은 요청으로 다시 확인하세요." : error instanceof Error ? error.message : "요청을 확인하세요." }, { status });
  }
}
