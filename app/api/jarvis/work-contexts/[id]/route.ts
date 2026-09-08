import type { NextRequest } from "next/server";
import { workHttp } from "@/lib/jobs/work-http";
import { getWorkSnapshot, mutateWorkContext } from "@/lib/repos/work-contexts";
import { validateWorkInput } from "@/lib/jarvis/work-context";
import { DialogueRequestError } from "@/lib/repos/jarvis-dialogue";
import type { WorkStatus } from "@/lib/jarvis/work-types";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Params) { return workHttp(request, async () => ({ work: await getWorkSnapshot((await params).id) })); }
export async function PATCH(request: NextRequest, { params }: Params) {
 return workHttp(request, async body => {
  if (!["update","status","forget"].includes(String(body.operation))) throw new DialogueRequestError("동작을 확인하세요.");
  let input;
  try { input = body.operation === "update" ? validateWorkInput(body.input) : body.operation === "status" ? { status: body.status as WorkStatus } : {}; }
  catch (error) { throw new DialogueRequestError(error instanceof Error ? error.message : "입력을 확인하세요."); }
  return { work: await mutateWorkContext({ operation: body.operation as "update" | "status" | "forget", contextId: (await params).id,
    expectedRevision: body.expectedRevision as number, requestId: String(body.requestId ?? ""), input }) };
 });
}
