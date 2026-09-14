"use client";
import { useState } from "react";
import { VoicePanel } from "./voice-panel";
import type { VoiceTurnReply } from "@/lib/jarvis/voice-types";

export function VoiceTestHarness(){
  const [context,setContext]=useState<{id:string|null;revision?:number}>({id:"11111111-1111-4111-8111-111111111111",revision:1});
  const [reply,setReply]=useState("");
  return <main><button onClick={()=>setContext({id:"11111111-1111-4111-8111-111111111111",revision:1})}>context one</button><button onClick={()=>setContext({id:"22222222-2222-4222-8222-222222222222",revision:2})}>context two</button><p data-testid="reply">{reply}</p><VoicePanel history={[]} contextId={context.id} expectedRevision={context.revision} automaticEnabled onReply={(_transcript,value:VoiceTurnReply)=>setReply(value.message)} onWork={()=>{}}/></main>;
}
