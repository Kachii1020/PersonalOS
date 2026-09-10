import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { JsonValue } from "./types";
import type { SpeechPayload, SpeechTicket, VoiceMode, VoiceSessionState, VoiceUiEvent, WorkMutationConfirmation, WorkMutationPayload } from "./voice-types";
import type { WorkChatReply, WorkSnapshot } from "./work-types";

export const VOICE_MODEL = "gpt-live-transcribe" as const;
export const VOICE_TTS_MODEL = "gpt-4o-mini-tts-2025-12-15" as const;
export const VOICE_TTS_VOICE = "cedar" as const;
export const VOICE_MAX_TURNS = 8 as const;
export const VOICE_MAX_SECONDS = 300 as const;
export const VOICE_SPEECH_MAX_CHARS = 350;
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function voiceBudgetUsd(): number {
  const value=Number(process.env.VOICE_MONTHLY_BUDGET_USD);
  if(!Number.isFinite(value)||value<=0)throw new Error("환경변수 VOICE_MONTHLY_BUDGET_USD가 없거나 양수가 아닙니다");
  return value;
}
export function voiceEnabled(){return process.env.JARVIS_VOICE_ENABLED==="true";}
export function automaticVoiceEnabled(){return voiceEnabled()&&process.env.JARVIS_VOICE_AUTO_TURN_ENABLED==="true";}
export function validateVoiceMode(value:unknown):VoiceMode {
  if(value!=="push_to_talk"&&value!=="automatic")throw new Error("음성 모드를 확인해 주세요.");
  if(value==="automatic"&&!automaticVoiceEnabled())throw new Error("자동 음성 대화는 아직 활성화되지 않았습니다.");
  return value;
}
export function voiceTurnDetection(mode:VoiceMode){return mode==="automatic"?{type:"client_vad" as const,rmsThreshold:0.03 as const,silenceDurationMs:700 as const}:null;}

const transitions:Record<VoiceSessionState,VoiceSessionState[]>={idle:["permission"],permission:["connecting","stopped"],connecting:["listening","stopped"],listening:["transcribing","stopped"],transcribing:["processing","listening","stopped"],processing:["speaking","listening","stopped"],speaking:["listening","stopped"],stopped:["permission"]};
export function reduceVoiceState(state:VoiceSessionState,event:VoiceUiEvent):VoiceSessionState {
  const next:VoiceSessionState=event.type==="request_permission"?"permission":event.type==="permission_granted"?"connecting":event.type==="connected"?"listening":event.type==="speech_started"?state==="speaking"?"listening":state:event.type==="speech_stopped"?"transcribing":event.type==="transcript_final"?"processing":event.type==="processing_started"?"processing":event.type==="speech_started_output"?"speaking":event.type==="speech_finished"?"listening":"stopped";
  if(next===state)return state;
  if(!transitions[state].includes(next))throw new Error(`허용되지 않은 음성 상태 전이: ${state} → ${next}`);
  return next;
}

function secret(){const value=process.env.VOICE_SIGNING_SECRET;if(!value||value.length<32)throw new Error("VOICE_SIGNING_SECRET은 32자 이상이어야 합니다.");return value;}
function signature(payload:unknown){return createHmac("sha256",secret()).update(JSON.stringify(payload)).digest("base64url");}
function same(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);}
export function signSpeech(payload:SpeechPayload):SpeechTicket{return{payload,signature:signature(payload)};}
export function verifySpeech(ticket:SpeechTicket,now=new Date()):SpeechPayload {
  if(!ticket||!ticket.payload||typeof ticket.signature!=="string"||!same(signature(ticket.payload),ticket.signature)||Date.parse(ticket.payload.expiresAt)<=now.getTime()||ticket.payload.text.length<1||ticket.payload.text.length>VOICE_SPEECH_MAX_CHARS||![1,2,3,4].includes(ticket.payload.attempt))throw new Error("음성 재생 요청이 만료됐거나 올바르지 않습니다.");
  return ticket.payload;
}
export function signMutation(payload:WorkMutationPayload):WorkMutationConfirmation{return{payload,signature:signature(payload)};}
export function verifyMutation(ticket:WorkMutationConfirmation,now=new Date()):WorkMutationPayload {
  if(!ticket||!ticket.payload||typeof ticket.signature!=="string"||!same(signature(ticket.payload),ticket.signature)||Date.parse(ticket.payload.expiresAt)<=now.getTime()||!['update','status'].includes(ticket.payload.operation))throw new Error("업무 변경 확인이 만료됐거나 올바르지 않습니다.");
  return ticket.payload;
}
function record(value:JsonValue):Record<string,JsonValue>|null{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,JsonValue>:null;}
function jst(iso:JsonValue){if(typeof iso!=="string"||!Number.isFinite(Date.parse(iso)))return null;return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Tokyo",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(iso));}
function actionLine(action:{type:string;title:string;payload:JsonValue}){const p=record(action.payload);const title=typeof p?.title==="string"?p.title:typeof p?.summary==="string"?p.summary:action.title;const when=jst(p?.startsAt??p?.dueAt??null);return `${action.type==="CREATE_TASK"?"할 일":action.type==="UPDATE_CALENDAR_EVENT"?"일정 수정":"일정"} ${title}${when?`, ${when}`:""}`;}
function bounded(text:string){const clean=text.replace(/\s+/g," ").trim();if(clean.length<=VOICE_SPEECH_MAX_CHARS)return clean;const cut=clean.slice(0,VOICE_SPEECH_MAX_CHARS-24);return `${cut.slice(0,Math.max(cut.lastIndexOf("."),cut.lastIndexOf("。"),cut.lastIndexOf(" ")))}. 자세한 내용은 화면에서 확인하세요.`;}
export function buildReplySpeech(reply:WorkChatReply):string {
  if(reply.mode==="preview"&&reply.preview)return bounded(`업무 저장안을 표시했습니다. 목표 ${reply.preview.goal}. 현재 진행 ${reply.preview.progress||"미입력"}. 다음 행동 ${reply.preview.nextStep||"미입력"}. 화면에서 확인 후 저장해 주세요.`);
  if(reply.mode==="propose"&&reply.proposals.length)return bounded(`${reply.proposals.map(actionLine).join(". ")}. 각 실행안은 승인 전까지 실행되지 않습니다.`);
  return bounded(reply.message);
}
export function buildActionSpeech(work:WorkSnapshot,actionId:string):string {
  const action=work.actions.find(item=>item.id===actionId);if(!action)throw new Error("이 업무의 실행안을 찾을 수 없습니다.");
  const label=actionLine(action.draft);
  if(action.status==="executed")return bounded(`${label}. 실행 결과가 확인됐습니다. 이 결과만 완료됐으며 업무 전체 완료를 뜻하지 않습니다.`);
  if(action.status==="failed")return bounded(`${label}. 실행에 실패해 확인이 필요합니다. 성공했다고 처리하지 않았습니다.`);
  if(action.status==="rejected")return bounded(`${label}. 거절되어 실행하지 않았습니다.`);
  return bounded(`${label}. 현재 상태는 ${action.status}입니다. 실행 완료로 확인되지 않았습니다.`);
}
