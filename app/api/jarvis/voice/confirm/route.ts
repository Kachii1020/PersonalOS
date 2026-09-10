import type { NextRequest } from "next/server";
import { workHttp } from "@/lib/jobs/work-http";
import { confirmVoiceMutation } from "@/lib/repos/voice";
import type { WorkMutationConfirmation } from "@/lib/jarvis/voice-types";
export async function POST(request:NextRequest){return workHttp(request,body=>confirmVoiceMutation(body as unknown as WorkMutationConfirmation));}
