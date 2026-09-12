import type { ChatMessage } from "./dialogue-types";
import type { WorkChatReply, WorkInput, WorkSnapshot, WorkStatus } from "./work-types";

export type VoiceMode = "push_to_talk" | "automatic";
export type VoiceSessionState = "idle" | "permission" | "connecting" | "listening" | "transcribing" | "processing" | "speaking" | "stopped";
export type StartVoiceSessionInput = { mode: VoiceMode; contextId?: string | null };
export type StartVoiceSessionReply = {
  sessionId: string; clientSecret: string; expiresAt: string; maxTurns: 8; maxDurationSeconds: 300;
  transcriptionModel: "gpt-live-transcribe";
  turnDetection: null | { type: "client_vad"; rmsThreshold: 0.03; silenceDurationMs: 700 };
};
export type VoiceTurnInput = {
  sessionId: string; providerItemId: string; requestId: string; durationMs: number; messages: ChatMessage[];
  contextId?: string | null; expectedRevision?: number;
};
export type WorkMutationPayload = {
  operation: "update" | "status"; sessionId:string; turnId:string; contextId: string; expectedRevision: number; requestId: string;
  input: WorkInput | { status: WorkStatus }; expiresAt: string;
};
export type WorkMutationConfirmation = { payload: WorkMutationPayload; signature: string };
export type SpeechPayload = { sessionId: string; turnId: string; attempt: 1 | 2 | 3 | 4; text: string; expiresAt: string };
export type SpeechTicket = { payload: SpeechPayload; signature: string };
export type VoiceTurnReply = WorkChatReply & { voice: { turnId: string; speech: SpeechTicket | null; confirmation: WorkMutationConfirmation | null } };
export type VoiceConfirmReply = { work: WorkSnapshot | null; speech: SpeechTicket | null };

export type VoiceUiEvent =
  | { type: "request_permission" } | { type: "permission_granted" } | { type: "connected" }
  | { type: "speech_started" } | { type: "speech_stopped" } | { type: "transcript_final" }
  | { type: "processing_started" } | { type: "speech_started_output" } | { type: "speech_finished" }
  | { type: "stop" } | { type: "fail" };
