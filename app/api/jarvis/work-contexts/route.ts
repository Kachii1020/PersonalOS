import type { NextRequest } from "next/server";
import { workHttp } from "@/lib/jobs/work-http";
import { listWorkContexts, mutateWorkContext } from "@/lib/repos/work-contexts";
import { bindWorkPreview } from "@/lib/repos/work-chat";
import { validateWorkInput } from "@/lib/jarvis/work-context";
import { DialogueRequestError } from "@/lib/repos/jarvis-dialogue";
export async function GET(request: NextRequest) { return workHttp(request, async () => ({ contexts: await listWorkContexts() })); }
export async function POST(request: NextRequest) {
  return workHttp(request, async body => {
    let input;
    try { input = validateWorkInput(body.input); } catch (error) { throw new DialogueRequestError(error instanceof Error ? error.message : "입력을 확인하세요."); }
    const work = await mutateWorkContext({ operation: "create", requestId: String(body.requestId ?? ""), input });
    if (work && typeof body.previewRequestId === "string") {
      await bindWorkPreview(work.context.id,body.previewRequestId);
    }
    return { work };
  });
}
