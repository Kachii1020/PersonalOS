import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {config} from "dotenv";
import {createClient} from "@supabase/supabase-js";
config({path:[".env.eval.local"],quiet:true});
const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,service=process.env.SUPABASE_SERVICE_ROLE_KEY!,anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin=createClient(url,service,{auth:{persistSession:false}});
type Result={data:unknown;error:{code:string;message:string}|null};const rpc=(name:string,args:Record<string,unknown>)=>(admin as unknown as {rpc:(n:string,a:Record<string,unknown>)=>Promise<Result>}).rpc(name,args);
const ok=async(name:string,args:Record<string,unknown>)=>{const r=await rpc(name,args);assert.ifError(r.error);return r.data as Record<string,unknown>;};
test("G8 voice DB keeps sessions owner-scoped, bounded, replay-safe and fail-closed",{timeout:120000},async()=>{
  assert.equal(process.env.GATE_ISOLATED_DB,"1");assert.equal(url,"http://127.0.0.1:54721");
  await admin.from("voice_sessions" as never).delete().neq("id" as never,"00000000-0000-0000-0000-000000000000" as never);
  const link=await admin.auth.admin.generateLink({type:"magiclink",email:process.env.ALLOWED_EMAIL!});assert.ifError(link.error);const auth=createClient(url,anonKey,{auth:{persistSession:false}});const login=await auth.auth.verifyOtp({type:"email",email:process.env.ALLOWED_EMAIL!,token:link.data.properties.email_otp});assert.ifError(login.error);const owner=login.data.user!.id;
  const anonymous=createClient(url,anonKey,{auth:{persistSession:false}});const denied=await anonymous.from("voice_sessions" as never).select("id" as never);assert.ok(denied.error,"anon voice read must fail");
  const session=await ok("begin_voice_session",{p_owner_id:owner,p_mode:"push_to_talk",p_model:"gpt-live-transcribe",p_budget:5});const sessionId=session.id as string;assert.equal(session.status,"active");
  const duplicate=await rpc("begin_voice_session",{p_owner_id:owner,p_mode:"automatic",p_model:"gpt-live-transcribe",p_budget:5});assert.equal(duplicate.error?.code,"PT409");
  let first:Record<string,unknown>|null=null;
  for(let i=0;i<8;i++){const request=randomUUID(),provider=String(i).padStart(64,"a"),transcript=String(i).padStart(64,"b");const turn=await ok("reserve_voice_turn",{p_owner_id:owner,p_session_id:sessionId,p_request_id:request,p_provider_hash:provider,p_transcript_hash:transcript,p_context_id:null});if(i===0){first=turn;const replay=await ok("reserve_voice_turn",{p_owner_id:owner,p_session_id:sessionId,p_request_id:request,p_provider_hash:provider,p_transcript_hash:transcript,p_context_id:null});assert.equal(replay.id,turn.id);const changed=await rpc("reserve_voice_turn",{p_owner_id:owner,p_session_id:sessionId,p_request_id:request,p_provider_hash:"c".repeat(64),p_transcript_hash:transcript,p_context_id:null});assert.equal(changed.error?.code,"PT409");}}
  const ninth=await rpc("reserve_voice_turn",{p_owner_id:owner,p_session_id:sessionId,p_request_id:randomUUID(),p_provider_hash:"d".repeat(64),p_transcript_hash:"e".repeat(64),p_context_id:null});assert.equal(ninth.error?.code,"PT409");
  const finished=await ok("finish_voice_turn",{p_owner_id:owner,p_turn_id:first!.id,p_reply_hash:"f".repeat(64),p_outcome:"answer",p_context_id:null});assert.equal(finished.status,"completed");await ok("reserve_voice_speech",{p_owner_id:owner,p_turn_id:first!.id,p_reply_hash:"f".repeat(64),p_attempt:1,p_budget:5});const replaySpeech=await rpc("reserve_voice_speech",{p_owner_id:owner,p_turn_id:first!.id,p_reply_hash:"f".repeat(64),p_attempt:1,p_budget:5});assert.equal(replaySpeech.error?.code,"PT409");
  const visible=await auth.from("voice_sessions" as never).select("id" as never);assert.ifError(visible.error);assert.equal((visible.data as unknown[]).length,1);
  await ok("finish_voice_session",{p_owner_id:owner,p_session_id:sessionId,p_reason:"test"});const afterEnd=await rpc("reserve_voice_speech",{p_owner_id:owner,p_turn_id:first!.id,p_reply_hash:"f".repeat(64),p_attempt:2,p_budget:5});assert.equal(afterEnd.error?.code,"PT409");const budget=await rpc("begin_voice_session",{p_owner_id:owner,p_mode:"push_to_talk",p_model:"gpt-live-transcribe",p_budget:.09});assert.equal(budget.error?.code,"PT402");
  const rows=await admin.from("voice_turns" as never).select("*" as never).limit(1);assert.ifError(rows.error);const keys=Object.keys((rows.data as unknown as Record<string,unknown>[])[0]);assert.ok(!keys.includes("transcript")&&!keys.includes("audio")&&!keys.includes("spoken_text"));
  await admin.from("voice_sessions" as never).delete().eq("owner_id" as never,owner as never);
});
