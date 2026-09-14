import { notFound } from "next/navigation";
import { VoiceTestHarness } from "@/components/jarvis-chat/voice-test-harness";

export default function VoiceTestPage(){
  if(process.env.GATE_ISOLATED_DB!=="1")notFound();
  return <VoiceTestHarness/>;
}
