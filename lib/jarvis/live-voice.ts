import type { ChatMessage } from "./dialogue-types";

export const LIVE_VOICE_MODEL = "gpt-live-1" as const;
export const LIVE_VOICE_MAX_SECONDS = 300 as const;
export const LIVE_VOICE_MAX_TURNS = 8 as const;

export function liveVoiceEnabled() {
  return process.env.JARVIS_VOICE_ENABLED === "true" && process.env.JARVIS_LIVE_VOICE_ENABLED === "true";
}

export function liveSessionConfig() {
  return {
    model: LIVE_VOICE_MODEL,
    instructions: [
      "한국어를 중심으로 자연스럽고 간결하게 대화하세요. 사용자가 끼어들면 듣고 응답을 조정하세요.",
      "업무, 할 일, 일정, 기억, 상태, 날짜, 실행 결과에 관한 요청은 반드시 client backend에 위임하세요.",
      "업무 ID, revision, 실행 가능 여부를 추측하지 마세요. backend가 준 사실과 불확실성만 충실하게 전달하세요.",
      "음성으로 승인했다고 간주하지 마세요. 외부 행동은 화면의 승인 버튼을 눌러야 한다고 안내하세요.",
      "영수증으로 확인되지 않은 행동을 성공했다고 말하지 마세요. 일부만 성공하면 부분 완료라고 말하세요.",
      "backend 결과를 받기 전에는 업무가 처리됐다고 말하지 마세요.",
    ].join(" "),
    delegation: { type: "client" as const },
    store: false,
  };
}

type Speaker = "input" | "output";
type TranscriptDelta = { delta: string; startMs: number; endMs: number; order: number };

export class LiveTranscriptLedger {
  private order = 0;
  private delegatedThrough = 0;
  private readonly deltas: Record<Speaker, TranscriptDelta[]> = { input: [], output: [] };

  add(speaker: Speaker, value: { delta: string; startMs: number; endMs: number }) {
    if (!value.delta || !Number.isFinite(value.startMs) || !Number.isFinite(value.endMs) || value.startMs < 0 || value.endMs <= value.startMs) return;
    this.deltas[speaker].push({ ...value, order: this.order++ });
  }

  inputForDelegation(offsetMs: number) {
    if (!Number.isFinite(offsetMs) || offsetMs <= this.delegatedThrough) return "";
    return this.deltas.input
      .filter(part => part.endMs > this.delegatedThrough && part.endMs <= offsetMs)
      .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.order - b.order)
      .map(part => part.delta)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  }

  visibleInput() {
    return this.deltas.input
      .filter(part => part.endMs > this.delegatedThrough)
      .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.order - b.order)
      .map(part => part.delta)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  }

  markDelegated(offsetMs: number) {
    if (Number.isFinite(offsetMs)) this.delegatedThrough = Math.max(this.delegatedThrough, offsetMs);
  }

  clear() {
    this.deltas.input.length = 0;
    this.deltas.output.length = 0;
    this.delegatedThrough = 0;
    this.order = 0;
  }
}

export function appendLiveHistory(history: ChatMessage[], role: ChatMessage["role"], content: string) {
  return [...history, { role, content }].slice(-6);
}
