/** Actual 0025 DB/RLS/configuration gate. Future hourly samples are not counted as observations. */
import test from "node:test";
import assert from "node:assert/strict";
import { config } from "dotenv";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/types/database";
config({path:[".env.eval.local",".env.local"],quiet:true});
const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,service=process.env.SUPABASE_SERVICE_ROLE_KEY!,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin=createClient<Database>(url,service,{auth:{persistSession:false}});
const hash=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");

test("G7 0025 configures hidden future-only canaries with no manual claim or Push reservation",{timeout:60_000},async()=>{
  assert.equal(process.env.GATE_ISOLATED_DB,"1");assert.equal(url,"http://127.0.0.1:54721");
  const initial=await admin.from("work_attention_canary_state").select("*").single();assert.ifError(initial.error);assert.equal(initial.data.enabled,false);assert.equal(initial.data.context_id,null);
  const link=await admin.auth.admin.generateLink({type:"magiclink",email:process.env.ALLOWED_EMAIL!});assert.ifError(link.error);
  const owner=createClient<Database>(url,anon,{auth:{persistSession:false}});const login=await owner.auth.verifyOtp({type:"email",email:process.env.ALLOWED_EMAIL!,token:link.data.properties.email_otp});assert.ifError(login.error);
  let contextId="";
  try{
    const enabled=await admin.rpc("configure_work_attention_canary",{p_enabled:true});assert.ifError(enabled.error);
    const state=await admin.from("work_attention_canary_state").select("*").single();assert.ifError(state.error);assert.equal(state.data.enabled,true);assert.ok(state.data.context_id);contextId=state.data.context_id!;
    assert.ok(Date.parse(state.data.first_due_at!)>Date.now());assert.ok(Date.parse(state.data.planned_through!)>Date.now()+7*86_400_000);
    const contexts=await admin.from("work_contexts").select("id,is_measurement,goal,revision").eq("id",contextId).single();assert.ifError(contexts.error);assert.equal(contexts.data.is_measurement,true);
    const rows=await admin.from("attention_items").select("id,due_at,is_measurement,first_claimed_at,measurement_slot,status").eq("context_id",contextId).order("due_at");assert.ifError(rows.error);assert.ok(rows.data.length>=192);assert.ok(rows.data.every(x=>x.is_measurement&&x.status==="pending"&&x.first_claimed_at===null&&x.measurement_slot===null&&Date.parse(x.due_at)>Date.now()));
    const ownerContexts=await owner.from("work_contexts").select("id").eq("id",contextId);assert.ifError(ownerContexts.error);assert.equal(ownerContexts.data.length,0);
    const ownerAttention=await owner.from("attention_items").select("id").eq("context_id",contextId);assert.ifError(ownerAttention.error);assert.equal(ownerAttention.data.length,0);
    const listed=await owner.rpc("list_work_contexts");assert.ifError(listed.error);assert.ok(!(listed.data as {id:string}[]).some(x=>x.id===contextId));
    const direct=await admin.rpc("claim_work_attention",{p_worker_id:"manual-local-gate",p_allow_automatic:false});assert.ifError(direct.error);assert.equal(direct.data,null,"manual claim cannot consume future or measurement rows");
    const delivery=await admin.rpc("begin_work_delivery",{p_attention_id:rows.data[0].id,p_worker_id:"manual-local-gate",p_subscription_id:randomUUID()});assert.ifError(delivery.error);assert.equal(delivery.data,null,"measurement rows never reserve Push");
    const input={status:"paused"},requestId=randomUUID(),requestHash=hash({operation:"status",contextId,expectedRevision:contexts.data.revision,input});
    const forbidden=await owner.rpc("mutate_work_context",{p_operation:"status",p_context_id:contextId,p_expected_revision:contexts.data.revision,p_request_id:requestId,p_request_hash:requestHash,p_input:input});assert.ok(forbidden.error);assert.equal(forbidden.error.code,"42501");
    const health=await admin.rpc("work_scheduler_health");assert.ifError(health.error);const canary=(health.data as {canary:{enabled:boolean;expectedSamples:number;actualClaimedSamples:number;pushDeliveryAllowed:boolean};automaticPromotionReady:boolean});assert.equal(canary.canary.enabled,true);assert.equal(canary.canary.expectedSamples,0);assert.equal(canary.canary.actualClaimedSamples,0);assert.equal(canary.canary.pushDeliveryAllowed,false);assert.equal(canary.automaticPromotionReady,false);
    console.log(JSON.stringify({configured:true,hiddenFromOwner:true,futureRegistered:rows.data.length,actualClaimed:0,pushReserved:0,automaticPromotionReady:false,scope:"configuration/RLS gate; not an hourly or seven-day observation"}));
  }finally{
    assert.ifError((await admin.rpc("configure_work_attention_canary",{p_enabled:false})).error);
    if(contextId){assert.ifError((await admin.from("attention_items").delete().eq("context_id",contextId)).error);assert.ifError((await admin.from("work_attention_canary_state").update({context_id:null,measurement_started_at:null,first_due_at:null,planned_through:null}).eq("singleton",true)).error);assert.ifError((await admin.from("work_contexts").delete().eq("id",contextId)).error);}
  }
});
