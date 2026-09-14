import type { VoiceSessionState, VoiceUiEvent } from "./voice-types";

const transitions:Record<VoiceSessionState,VoiceSessionState[]>={idle:["permission"],permission:["connecting","stopped"],connecting:["listening","stopped"],listening:["transcribing","stopped"],transcribing:["processing","listening","stopped"],processing:["speaking","listening","stopped"],speaking:["listening","stopped"],stopped:["permission"]};
export function reduceVoiceState(state:VoiceSessionState,event:VoiceUiEvent):VoiceSessionState {
  const next:VoiceSessionState=event.type==="request_permission"?"permission":event.type==="permission_granted"?"connecting":event.type==="connected"?"listening":event.type==="speech_started"?state==="speaking"?"listening":state:event.type==="speech_stopped"?"transcribing":event.type==="transcript_final"?"processing":event.type==="processing_started"?"processing":event.type==="speech_started_output"?"speaking":event.type==="speech_finished"||event.type==="turn_failed"||event.type==="playback_interrupted"?"listening":"stopped";
  if(next===state)return state;
  if(!transitions[state].includes(next))throw new Error(`허용되지 않은 음성 상태 전이: ${state} → ${next}`);
  return next;
}
