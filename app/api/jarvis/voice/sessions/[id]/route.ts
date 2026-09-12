import type { NextRequest } from "next/server";
import { workHttp } from "@/lib/jobs/work-http";
import { endVoiceSession,touchVoiceSession } from "@/lib/repos/voice";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){const{id}=await params;return workHttp(request,()=>touchVoiceSession(id));}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){const{id}=await params;return workHttp(request,body=>endVoiceSession(id,typeof body.reason==="string"?body.reason:"user"));}
