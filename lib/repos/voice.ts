import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTranscriptionSecret, generateSpeech } from "@/lib/ai/voice-client";
import { answerWorkChat } from "./work-chat";
import { getWorkSnapshot, mutateWorkContext, requireWorkOwner } from "./work-contexts";
import { buildActionSpeech, buildReplySpeech, sha256, signMutation, signSpeech, validateVoiceMode, verifyMutation, verifySpeech, voiceTranscriptionKeywords, voiceTurnDetection, VOICE_MAX_SECONDS, VOICE_MAX_TURNS, VOICE_MODEL, voiceBudgetUsd, voiceEnabled } from "@/lib/jarvis/voice";
import type { SpeechTicket, StartVoiceSessionInput, StartVoiceSessionReply, VoiceConfirmReply, VoiceTurnInput, VoiceTurnReply, WorkMutationConfirmation } from "@/lib/jarvis/voice-types";

type RpcError={code:string;message:string};type RpcResult={data:unknown;error:RpcError|null};
type VoiceRpcClient={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<RpcResult>};
type VoiceSessionRow={id:string;expires_at:string;status:string};
type VoiceTurnRow={id:string;session_id:string;status:string;tts_attempts:number;reply_hash:string|null};
export class VoiceRequestError extends Error{constructor(message:string,readonly status=400){super(message);this.name="VoiceRequestError";}}
function id(value:unknown,label:string){if(typeof value!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw new VoiceRequestError(`${label} ID를 확인해 주세요.`);return value;}
function text(value:unknown,label:string,max:number){if(typeof value!=="string"||!value.trim()||value.length>max||/[\0\r\n]/.test(value))throw new VoiceRequestError(`${label}을 확인해 주세요.`);return value.trim();}
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{const result=await(createAdminClient() as unknown as VoiceRpcClient).rpc(name,args);if(result.error){const status=result.error.code==="PT402"?402:result.error.code==="PT409"?409:400;throw new VoiceRequestError(result.error.message,status);}return result.data as T;}
function requireEnabled(){if(!voiceEnabled())throw new VoiceRequestError("음성 JARVIS가 아직 활성화되지 않았습니다.",404);}
function expiry(minutes=2){return new Date(Date.now()+minutes*60_000).toISOString();}
function speechTicket(sessionId:string,row:VoiceTurnRow,speech:string):SpeechTicket|null{const attempt=row.tts_attempts+1;if(attempt>4)return null;return signSpeech({sessionId,turnId:row.id,attempt:attempt as 1|2|3|4,text:speech,expiresAt:expiry()});}

export async function startVoiceSession(input:StartVoiceSessionInput):Promise<StartVoiceSessionReply>{
  requireEnabled();const owner=await requireWorkOwner();const mode=validateVoiceMode(input.mode);const selected=input.contextId?await getWorkSnapshot(id(input.contextId,"업무")):null;if(input.contextId&&!selected)throw new VoiceRequestError("선택한 업무를 찾을 수 없습니다.",404);
  const session=await rpc<VoiceSessionRow>("begin_voice_session",{p_owner_id:owner.ownerId,p_mode:mode,p_model:VOICE_MODEL,p_budget:voiceBudgetUsd()});
  try{const provider=await createTranscriptionSecret(mode,sha256(owner.ownerId),voiceTranscriptionKeywords(selected?.context));const providerExpiry=provider.expiresAt?.getTime()??Infinity;const expiresAt=new Date(Math.min(Date.parse(session.expires_at),providerExpiry)).toISOString();return{sessionId:session.id,clientSecret:provider.value,expiresAt,maxTurns:VOICE_MAX_TURNS,maxDurationSeconds:VOICE_MAX_SECONDS,transcriptionModel:VOICE_MODEL,turnDetection:voiceTurnDetection(mode)};}
  catch(error){await rpc("finish_voice_session",{p_owner_id:owner.ownerId,p_session_id:session.id,p_reason:"provider_error"}).catch(()=>undefined);throw error;}
}

export async function touchVoiceSession(sessionId:string){requireEnabled();const owner=await requireWorkOwner();await rpc("touch_voice_session",{p_owner_id:owner.ownerId,p_session_id:id(sessionId,"음성 세션")});return{ok:true};}
export async function endVoiceSession(sessionId:string,reason="user"){requireEnabled();const owner=await requireWorkOwner();await rpc("finish_voice_session",{p_owner_id:owner.ownerId,p_session_id:id(sessionId,"음성 세션"),p_reason:text(reason,"종료 사유",80)});return{ok:true};}

export async function processVoiceTurn(input:VoiceTurnInput):Promise<VoiceTurnReply>{
  requireEnabled();const owner=await requireWorkOwner();const sessionId=id(input.sessionId,"음성 세션"),requestId=id(input.requestId,"요청");const providerItem=text(input.providerItemId,"전사 항목",200);
  if(!Number.isFinite(input.durationMs)||input.durationMs<300||input.durationMs>60_000)throw new VoiceRequestError("300밀리초 이상 60초 이하로 말해 주세요.");
  if(!Array.isArray(input.messages)||!input.messages.length)throw new VoiceRequestError("확정된 전사가 없습니다.");const latest=input.messages.at(-1);if(latest?.role!=="user"||!latest.content.trim())throw new VoiceRequestError("확정된 전사가 없습니다.");
  const contextId=input.contextId?id(input.contextId,"업무"):null;
  const row=await rpc<VoiceTurnRow>("reserve_voice_turn",{p_owner_id:owner.ownerId,p_session_id:sessionId,p_request_id:requestId,p_provider_hash:sha256(providerItem),p_transcript_hash:sha256(latest.content),p_context_id:contextId});
  try{
    const reply=await answerWorkChat({messages:input.messages,contextId,expectedRevision:input.expectedRevision,requestId},{mutationPolicy:"confirm"});const spoken=buildReplySpeech(reply);const replyHash=sha256(spoken);
    const finished=await rpc<VoiceTurnRow>("finish_voice_turn",{p_owner_id:owner.ownerId,p_turn_id:row.id,p_reply_hash:replyHash,p_outcome:reply.mode,p_context_id:reply.work?.context.id??contextId});
    const candidate=reply.confirmation;const confirmation=candidate?signMutation({...candidate,sessionId,turnId:row.id,expiresAt:expiry()}):null;
    const clean={...reply};delete clean.confirmation;
    return{...clean,voice:{turnId:row.id,speech:speechTicket(sessionId,finished,spoken),confirmation}};
  }catch(error){throw error;}
}

async function ownedTurn(ownerId:string,sessionId:string,turnId:string){const checkedSession=id(sessionId,"음성 세션");await rpc("touch_voice_session",{p_owner_id:ownerId,p_session_id:checkedSession});const row=await rpc<VoiceTurnRow|null>("get_voice_turn_for_owner",{p_owner_id:ownerId,p_session_id:checkedSession,p_turn_id:id(turnId,"음성 turn")});if(!row)throw new VoiceRequestError("음성 turn을 찾을 수 없습니다.",404);return row;}
export async function confirmVoiceMutation(ticket:WorkMutationConfirmation):Promise<VoiceConfirmReply>{
  requireEnabled();const owner=await requireWorkOwner();let payload;try{payload=verifyMutation(ticket);}catch(error){throw new VoiceRequestError(error instanceof Error?error.message:"업무 변경 확인 실패",409);}const row=await ownedTurn(owner.ownerId,payload.sessionId,payload.turnId);
  const work=await mutateWorkContext({operation:payload.operation,contextId:id(payload.contextId,"업무"),expectedRevision:payload.expectedRevision,requestId:id(payload.requestId,"요청"),input:payload.input});const spoken="확인한 업무 변경을 저장했습니다. 연결된 할 일과 일정은 자동으로 변경하지 않았습니다.";const finished=await rpc<VoiceTurnRow>("finish_voice_turn",{p_owner_id:owner.ownerId,p_turn_id:row.id,p_reply_hash:sha256(spoken),p_outcome:"confirmed",p_context_id:work?.context.id??payload.contextId});return{work,speech:speechTicket(payload.sessionId,finished,spoken)};
}
export async function actionResultSpeech(input:{sessionId:string;turnId:string;contextId:string;actionId:string}){
  requireEnabled();const owner=await requireWorkOwner();const sessionId=id(input.sessionId,"음성 세션");const row=await ownedTurn(owner.ownerId,sessionId,input.turnId);const work=await getWorkSnapshot(id(input.contextId,"업무"));if(!work)throw new VoiceRequestError("업무를 찾을 수 없습니다.",404);const spoken=buildActionSpeech(work,id(input.actionId,"실행안"));const finished=await rpc<VoiceTurnRow>("finish_voice_turn",{p_owner_id:owner.ownerId,p_turn_id:row.id,p_reply_hash:sha256(spoken),p_outcome:"action_result",p_context_id:work.context.id});return{speech:speechTicket(sessionId,finished,spoken)};
}
export async function synthesizeTicket(ticket:SpeechTicket):Promise<Response>{
  requireEnabled();const owner=await requireWorkOwner();let payload;try{payload=verifySpeech(ticket);}catch(error){throw new VoiceRequestError(error instanceof Error?error.message:"음성 재생 요청 실패",409);}await ownedTurn(owner.ownerId,payload.sessionId,payload.turnId);await rpc("reserve_voice_speech",{p_owner_id:owner.ownerId,p_turn_id:payload.turnId,p_reply_hash:sha256(payload.text),p_attempt:payload.attempt,p_budget:voiceBudgetUsd()});return generateSpeech(payload.text);
}
export async function reissueSpeech(ticket:SpeechTicket):Promise<{speech:SpeechTicket}>{
  requireEnabled();const owner=await requireWorkOwner();let payload;try{payload=verifySpeech(ticket);}catch(error){throw new VoiceRequestError(error instanceof Error?error.message:"음성 재생 요청 실패",409);}const row=await ownedTurn(owner.ownerId,payload.sessionId,payload.turnId);if(row.reply_hash!==sha256(payload.text))throw new VoiceRequestError("더 최신 결과가 있어 이전 음성을 다시 재생하지 않습니다.",409);const next=speechTicket(payload.sessionId,row,payload.text);if(!next)throw new VoiceRequestError("이 응답의 음성 재생 횟수를 모두 사용했습니다.",409);return{speech:next};
}
