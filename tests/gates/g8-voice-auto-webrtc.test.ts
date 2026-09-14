import test from "node:test";
import assert from "node:assert/strict";
import {config} from "dotenv";
import {createClient} from "@supabase/supabase-js";
import {chromium} from "playwright";
config({path:[".env.eval.local"],quiet:true});
const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,app="http://localhost:3055",audioPath=process.env.G8_FAKE_AUDIO_PATH!,admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
test("G8 client RMS VAD commits a foreground automatic turn",{timeout:120000},async()=>{
  assert.equal(process.env.G8_ALLOW_LIVE_OPENAI,"1");const link=await admin.auth.admin.generateLink({type:"magiclink",email:process.env.ALLOWED_EMAIL!});assert.ifError(link.error);const auth=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false}}),login=await auth.auth.verifyOtp({type:"email",email:process.env.ALLOWED_EMAIL!,token:link.data.properties.email_otp});assert.ifError(login.error);const owner=login.data.user!.id;const browser=await chromium.launch({channel:"chrome",headless:true,args:["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream",`--use-file-for-fake-audio-capture=${audioPath}`]}),page=await browser.newPage({viewport:{width:390,height:844}});await page.context().addCookies([{name:"sb-127-auth-token",value:"base64-"+Buffer.from(JSON.stringify(login.data.session)).toString("base64url"),url:app}]);
  try{await page.goto(`${app}/jarvis`);await page.getByRole("button",{name:"자동 대화"}).click();await page.getByRole("button",{name:"음성 대화 시작"}).click();await page.getByText("확정 전사").waitFor({timeout:40000});const transcript=await page.getByText("확정 전사").locator("..").locator("p").nth(1).textContent();assert.ok((transcript??"").trim().length>0);let count=0;for(let i=0;i<20;i++){const turns=await admin.from("voice_turns").select("id",{count:"exact",head:true}).eq("owner_id",owner);assert.ifError(turns.error);count=turns.count??0;if(count)break;await new Promise(resolve=>setTimeout(resolve,250));}assert.equal(count,1);await page.getByRole("button",{name:"종료"}).click();}
  finally{await browser.close();await admin.from("voice_sessions").delete().eq("owner_id",owner);}
});
