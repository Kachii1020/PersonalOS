import "server-only";
import { LIVE_VOICE_MODEL, liveSessionConfig } from "@/lib/jarvis/live-voice";

type LiveSessionResponse = {
  session?: { id?: string };
  transport?: { type?: string; sdp?: string };
};

function apiKey() {
  const value = process.env.OPENAI_API_KEY;
  if (!value) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  return value;
}

export async function createLiveVoiceConnection(sdp: string, safetyIdentifier: string) {
  const response = await fetch("https://api.openai.com/v1/live/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": safetyIdentifier,
    },
    body: JSON.stringify({
      session: liveSessionConfig(),
      transport: { type: "webrtc", sdp },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    console.error("[live-voice] session creation failed", response.status, response.headers.get("x-request-id") ?? "");
    throw new Error("자연 음성 제공자 연결을 만들지 못했습니다.");
  }
  const body = await response.json() as LiveSessionResponse;
  if (!body.session?.id || body.transport?.type !== "webrtc" || !body.transport.sdp) {
    throw new Error("자연 음성 제공자 연결 응답을 확인하지 못했습니다.");
  }
  return { providerSessionId: body.session.id, sdpAnswer: body.transport.sdp, model: LIVE_VOICE_MODEL };
}
