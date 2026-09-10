import { NextResponse,type NextRequest } from "next/server";
import { synthesizeTicket,VoiceRequestError } from "@/lib/repos/voice";
import type { SpeechTicket } from "@/lib/jarvis/voice-types";
export const maxDuration=30;
export async function POST(request:NextRequest){
  try{
    if(request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({error:"같은 앱에서 요청하세요."},{status:403});
    const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0;if(reader)for(;;){const{value,done}=await reader.read();if(done)break;size+=value.length;if(size>6000){await reader.cancel();return NextResponse.json({error:"음성 재생 요청이 너무 큽니다."},{status:413});}chunks.push(value);}
    const ticket=JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}") as SpeechTicket;const audio=await synthesizeTicket(ticket);
    return new Response(audio.body,{status:200,headers:{"Content-Type":"audio/pcm","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }catch(error){const status=error instanceof VoiceRequestError?error.status:error instanceof SyntaxError?400:503;return NextResponse.json({error:status>=500?"음성 재생에 실패했습니다. 화면의 결과를 확인하세요.":error instanceof Error?error.message:"음성 재생 요청을 확인하세요."},{status});}
}
