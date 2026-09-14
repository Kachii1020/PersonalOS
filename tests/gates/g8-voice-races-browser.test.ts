import test from "node:test";
import assert from "node:assert/strict";
import { chromium, type Page, type Route } from "playwright";

const app=process.env.G8_RACE_APP_URL??"http://127.0.0.1:3056";
type Capture={sessions:number;speech:number;observations:string[];turnBodies:Record<string,unknown>[];patches:number};

async function browser(){
  const instance=await chromium.launch({channel:"chrome",headless:true,args:["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"]});
  const page=await instance.newPage();
  page.on("pageerror",cause=>console.error("[voice-race-page]",cause.message));
  await page.addInitScript({content:`(()=>{const root=window;root.__voiceChannels=[];root.__playbacks=0;class Channel{constructor(){this.onopen=null;this.onclose=null;this.onmessage=null;this.readyState="open";root.__voiceChannels.push(this);setTimeout(()=>this.onopen?.(),0);}send(){}close(){this.readyState="closed";}emit(data){this.onmessage?.({data:JSON.stringify(data)});}}class Peer{addTrack(){}createDataChannel(){return new Channel();}async createOffer(){return{type:"offer",sdp:"fake"};}async setLocalDescription(){}async setRemoteDescription(){}close(){}}class Source{constructor(){this.onended=null;}connect(){}start(){root.__playbacks++;setTimeout(()=>this.onended?.(),20);}stop(){}}class Audio{constructor(){this.state="running";this.destination={};}async resume(){}async close(){this.state="closed";}createBuffer(_channels,length){return{getChannelData:()=>new Float32Array(length)};}createBufferSource(){return new Source();}createMediaStreamSource(){return{connect(){},disconnect(){}};}createAnalyser(){return{fftSize:0,connect(){},disconnect(){},getByteTimeDomainData(values){values.fill(128);}};}}root.__PERSONALOS_VOICE_ADAPTERS__={getUserMedia:async()=>({getAudioTracks:()=>[{enabled:false,stop(){}}],getTracks:()=>[{stop(){}}]}),createPeer:()=>new Peer(),createAudio:()=>new Audio()};const interval=window.setInterval.bind(window);window.setInterval=(handler,timeout,...args)=>interval(handler,timeout===15000?20:timeout,...args);})();`});
  return{instance,page};
}
async function emit(page:Page,id:string,text:string){await page.evaluate(({id,text})=>{const root=window as unknown as {__voiceChannels:{emit:(data:unknown)=>void}[]};root.__voiceChannels.at(-1)!.emit({type:"conversation.item.input_audio_transcription.completed",item_id:id,transcript:text});},{id,text});}
async function ready(page:Page){try{await page.getByRole("button",{name:"말하기 시작"}).waitFor({timeout:5000});}catch{throw new Error(`voice panel did not connect: ${await page.locator("body").innerText()}`);}}
function reply(sessionId:string,turnId:string,message="reply") {return{mode:"answer",message,work:null,preview:null,proposals:[],requestId:crypto.randomUUID(),voice:{turnId,speech:{payload:{sessionId,turnId,attempt:1,text:message,expiresAt:"2030-01-01T00:00:00Z"},signature:"test"},confirmation:null}};}
async function routes(page:Page,capture:Capture,options:{turnDelay?:number;speechDelay?:number;firstPatchFailure?:boolean}={}){
  await page.route("https://api.openai.com/v1/realtime/calls",route=>route.fulfill({status:200,contentType:"application/sdp",body:"fake-answer"}));
  await page.route("**/api/jarvis/voice/**",async(route:Route)=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname;
    if(path.endsWith("/sessions")&&request.method()==="POST"){capture.sessions++;const sessionId=`00000000-0000-4000-8000-${String(capture.sessions).padStart(12,"0")}`;return route.fulfill({json:{sessionId,clientSecret:"test",expiresAt:new Date(Date.now()+300000).toISOString(),maxTurns:8,maxDurationSeconds:300,transcriptionModel:"gpt-live-transcribe",turnDetection:null}});}
    if(path.includes("/sessions/")&&request.method()==="PATCH"){capture.patches++;if(options.firstPatchFailure&&capture.patches===1){await new Promise(r=>setTimeout(r,120));return route.fulfill({status:503,json:{error:"temporary"}});}return route.fulfill({json:{ok:true}});}
    if(path.includes("/sessions/")&&request.method()==="DELETE")return route.fulfill({json:{ok:true}});
    if(path.endsWith("/turns")){capture.turnBodies.push(request.postDataJSON());if(options.turnDelay)await new Promise(r=>setTimeout(r,options.turnDelay));const body=request.postDataJSON();return route.fulfill({json:reply(body.sessionId,`10000000-0000-4000-8000-${String(capture.turnBodies.length).padStart(12,"0")}`)});}
    if(path.endsWith("/speech")){capture.speech++;if(options.speechDelay)await new Promise(r=>setTimeout(r,options.speechDelay));return route.fulfill({status:200,contentType:"audio/pcm",body:Buffer.alloc(48)});}
    if(path.endsWith("/observe")){capture.observations.push(request.postDataJSON().event);return route.fulfill({json:{observed:true}});}
    if(path.endsWith("/replay-speech"))return route.fulfill({json:{speech:request.postDataJSON()}});
    return route.fulfill({json:{ok:true}});
  });
}
const blank=():Capture=>({sessions:0,speech:0,observations:[],turnBodies:[],patches:0});

test("late turn after explicit session end stays visible and never starts stale speech",async()=>{
  const{instance,page}=await browser(),capture=blank();await routes(page,capture,{turnDelay:200});
  try{await page.goto(`${app}/voice-test-gate`);await page.getByRole("button",{name:"음성 대화 시작"}).click();await ready(page);await emit(page,"late","이력서 준비 이어하자");await page.getByRole("button",{name:"종료"}).click();await page.getByTestId("voice-late-result").waitFor();assert.equal(capture.speech,0);assert.equal(await page.evaluate(()=>(window as unknown as {__playbacks:number}).__playbacks),0);assert.equal(await page.getByTestId("reply").textContent(),"");assert.match((await page.getByTestId("voice-late-result").textContent())??"",/reply/);}finally{await instance.close();}
});

test("a delayed old heartbeat failure cannot close a replacement session",async()=>{
  const{instance,page}=await browser(),capture=blank();await routes(page,capture,{firstPatchFailure:true});
  try{await page.goto(`${app}/voice-test-gate`);await page.getByRole("button",{name:"음성 대화 시작"}).click();await page.getByRole("button",{name:"말하기 시작"}).waitFor();await page.waitForTimeout(30);await page.getByRole("button",{name:"종료"}).click();await page.getByRole("button",{name:"음성 대화 시작"}).click();await page.getByRole("button",{name:"말하기 시작"}).waitFor();await page.waitForTimeout(180);assert.equal(await page.getByRole("button",{name:"종료"}).isVisible(),true);assert.equal(capture.sessions,2);}finally{await instance.close();}
});

test("new speech aborts a downloading TTS and current context revision is used",async()=>{
  const{instance,page}=await browser(),capture=blank();await routes(page,capture,{speechDelay:250});
  try{await page.goto(`${app}/voice-test-gate`);await page.getByRole("button",{name:"음성 대화 시작"}).click();await page.getByRole("button",{name:"말하기 시작"}).waitFor();await page.getByRole("button",{name:"context two"}).click();await emit(page,"first","이력서 준비 이어하자");await page.getByTestId("voice-playback-state").waitFor();await page.getByRole("button",{name:"말하기 시작"}).click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>(window as unknown as {__playbacks:number}).__playbacks),0);assert.equal(capture.turnBodies[0].contextId,"22222222-2222-4222-8222-222222222222");assert.equal(capture.turnBodies[0].expectedRevision,2);assert.ok(capture.observations.includes("interrupted"));}finally{await instance.close();}
});

test("two current turns reach PCM playback completion with ordered observations",async()=>{
  const{instance,page}=await browser(),capture=blank();await routes(page,capture);
  try{await page.goto(`${app}/voice-test-gate`);await page.getByRole("button",{name:"음성 대화 시작"}).click();await ready(page);await emit(page,"one","첫 번째 요청");await page.getByText("응답 재생 완료").waitFor();await page.getByRole("button",{name:"context two"}).click();await emit(page,"two","두 번째 요청");await page.waitForFunction(()=>{const root=window as unknown as {__playbacks:number};return root.__playbacks===2;});for(let i=0;i<20&&capture.observations.filter(value=>value==="completed").length<2;i++)await page.waitForTimeout(10);assert.equal(capture.turnBodies.length,2);assert.equal(capture.turnBodies[1].contextId,"22222222-2222-4222-8222-222222222222");assert.equal(capture.turnBodies[1].expectedRevision,2);assert.deepEqual(capture.observations.filter(value=>value!=="interrupted"),["received","started","completed","received","started","completed"]);}finally{await instance.close();}
});
