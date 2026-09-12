import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import type { Database } from "../../lib/types/database";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,app=process.env.G8_APP_URL??"http://localhost:3055";
const admin=createClient<Database>(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});

test("G8 browser explicitly replaces another device voice session",{timeout:120_000},async()=>{
  assert.equal(process.env.GATE_ISOLATED_DB,"1");assert.equal(process.env.G8_ALLOW_LIVE_OPENAI,"1");assert.match(url,/^http:\/\/127\.0\.0\.1:\d+$/);
  const email=process.env.ALLOWED_EMAIL!;const link=await admin.auth.admin.generateLink({type:"magiclink",email});assert.ifError(link.error);
  const auth=createClient<Database>(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false}}),login=await auth.auth.verifyOtp({type:"email",email,token:link.data.properties.email_otp});assert.ifError(login.error);const owner=login.data.user!.id;
  await admin.from("voice_sessions").delete().eq("owner_id",owner);
  const first=await admin.rpc("begin_voice_session",{p_owner_id:owner,p_mode:"push_to_talk",p_model:"gpt-live-transcribe",p_budget:5,p_replace:false});assert.ifError(first.error);
  const browser=await chromium.launch({channel:"chrome",headless:true,args:["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"]}),page=await browser.newPage({viewport:{width:390,height:844}});
  await page.context().addCookies([{name:"sb-127-auth-token",value:"base64-"+Buffer.from(JSON.stringify(login.data.session)).toString("base64url"),url:app}]);
  try{
    await page.goto(`${app}/jarvis`);await page.getByRole("button",{name:"음성 대화 시작"}).click();
    await page.getByText("다른 기기에서 음성 대화가 진행 중입니다.").waitFor();
    const replace=page.getByRole("button",{name:"다른 기기 세션 종료 후 여기서 시작"});await replace.waitFor();await replace.click();
    await page.getByRole("status").filter({hasText:"듣는 중"}).waitFor({timeout:30_000});
    const prior=await admin.from("voice_sessions").select("status,end_reason").eq("id",first.data.id).single();assert.ifError(prior.error);assert.deepEqual(prior.data,{status:"ended",end_reason:"replaced"});
    const active=await admin.from("voice_sessions").select("id",{count:"exact"}).eq("owner_id",owner).eq("status","active");assert.ifError(active.error);assert.equal(active.count,1);
    await page.getByRole("button",{name:"종료"}).click();
  }finally{await browser.close();await admin.from("voice_sessions").delete().eq("owner_id",owner);}
});
