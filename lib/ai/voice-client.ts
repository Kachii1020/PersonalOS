import "server-only";
import { VOICE_MODEL, VOICE_TTS_MODEL, VOICE_TTS_VOICE } from "@/lib/jarvis/voice";
import type { VoiceMode } from "@/lib/jarvis/voice-types";

function key(){const value=process.env.OPENAI_API_KEY;if(!value)throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");return value;}
async function checked(response:Response,label:string){if(response.ok)return response;const requestId=response.headers.get("x-request-id");console.error(`[voice] ${label} failed`,response.status,requestId??"");throw new Error(`${label} 제공자 응답을 확인하지 못했습니다.`);}

export async function createTranscriptionSecret(mode:VoiceMode,safetyIdentifier:string){
  void mode;
  const response=await checked(await fetch("https://api.openai.com/v1/realtime/client_secrets",{method:"POST",headers:{Authorization:`Bearer ${key()}`,"Content-Type":"application/json","OpenAI-Safety-Identifier":safetyIdentifier},body:JSON.stringify({session:{type:"transcription",audio:{input:{format:{type:"audio/pcm",rate:24000},transcription:{model:VOICE_MODEL,languages:["ko","ja","en"],delay:"low"},turn_detection:null}}}}),signal:AbortSignal.timeout(15000)}),"음성 전사 세션");
  const raw=await response.json() as {value?:string;expires_at?:number;client_secret?:{value?:string;expires_at?:number}|string};
  const value=raw.value??(typeof raw.client_secret==="string"?raw.client_secret:raw.client_secret?.value);
  const expires=raw.expires_at??(typeof raw.client_secret==="object"?raw.client_secret?.expires_at:undefined);
  if(!value)throw new Error("음성 전사 임시 키를 확인하지 못했습니다.");
  return{value,expiresAt:expires?new Date(expires*1000):null};
}

export async function generateSpeech(text:string):Promise<Response>{
  return checked(await fetch("https://api.openai.com/v1/audio/speech",{method:"POST",headers:{Authorization:`Bearer ${key()}`,"Content-Type":"application/json"},body:JSON.stringify({model:VOICE_TTS_MODEL,voice:VOICE_TTS_VOICE,input:text,instructions:"Calm, concise Korean personal assistant. Preserve names, dates, times, negation, failure and uncertainty exactly. Do not add words.",response_format:"pcm",stream_format:"audio"}),signal:AbortSignal.timeout(25000)}),"음성 합성");
}
