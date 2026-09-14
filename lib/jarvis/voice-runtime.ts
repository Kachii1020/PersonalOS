import type { StartVoiceSessionReply } from "./voice-types";

export type VoiceSessionToken = { generation: number; sessionId: string };
export type VoiceTurnToken = VoiceSessionToken & { turn: number };

export class VoiceRuntime {
  generation = 0;
  turn = 0;
  session: StartVoiceSessionReply | null = null;
  stopReason: string | null = null;
  pc: RTCPeerConnection | null = null;
  dc: RTCDataChannel | null = null;
  stream: MediaStream | null = null;
  audio: AudioContext | null = null;
  source: AudioBufferSourceNode | null = null;
  micNode: MediaStreamAudioSourceNode | null = null;
  analyser: AnalyserNode | null = null;
  vadFrame = 0;
  heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  heartbeatInFlight = false;
  heartbeatFailures = 0;
  playbackAbort: AbortController | null = null;
  playbackIdentity: { sessionId: string; turnId: string } | null = null;

  startAttempt(): number {
    this.teardown("restarting");
    this.stopReason = null;
    this.turn = 0;
    return this.generation;
  }

  activate(generation: number, session: StartVoiceSessionReply): VoiceSessionToken | null {
    if (generation !== this.generation) return null;
    this.session = session;
    this.stopReason = null;
    return { generation, sessionId: session.sessionId };
  }

  sessionToken(): VoiceSessionToken | null {
    return this.session ? { generation: this.generation, sessionId: this.session.sessionId } : null;
  }

  nextTurn(): VoiceTurnToken | null {
    const token = this.sessionToken();
    if (!token) return null;
    this.turn += 1;
    return { ...token, turn: this.turn };
  }

  isCurrent(token: VoiceSessionToken | VoiceTurnToken): boolean {
    return this.generation === token.generation && this.session?.sessionId === token.sessionId;
  }

  beginHeartbeat(token: VoiceSessionToken): boolean {
    if (!this.isCurrent(token) || this.heartbeatInFlight) return false;
    this.heartbeatInFlight = true;
    return true;
  }

  finishHeartbeat(token: VoiceSessionToken, success: boolean): number {
    if (!this.isCurrent(token)) return this.heartbeatFailures;
    this.heartbeatInFlight = false;
    this.heartbeatFailures = success ? 0 : this.heartbeatFailures + 1;
    return this.heartbeatFailures;
  }

  interruptPlayback(): { sessionId: string; turnId: string } | null {
    const identity = this.playbackIdentity;
    this.playbackAbort?.abort();
    this.playbackAbort = null;
    try { this.source?.stop(); } catch {}
    this.source = null;
    this.playbackIdentity = null;
    return identity;
  }

  teardown(reason: string): { sessionId: string | null; alreadyStopped: boolean } {
    const sessionId = this.session?.sessionId ?? null;
    const alreadyStopped = !this.session && this.stopReason !== null;
    this.session = null;
    this.stopReason = reason;
    this.generation += 1;
    this.interruptPlayback();
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.heartbeatInFlight = false;
    this.heartbeatFailures = 0;
    if (this.vadFrame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.vadFrame);
    this.vadFrame = 0;
    try { this.analyser?.disconnect(); } catch {}
    try { this.micNode?.disconnect(); } catch {}
    try { this.dc?.close(); } catch {}
    try { this.pc?.close(); } catch {}
    try { this.stream?.getTracks().forEach(track => track.stop()); } catch {}
    void this.audio?.close();
    this.analyser = null;
    this.micNode = null;
    this.dc = null;
    this.pc = null;
    this.stream = null;
    this.audio = null;
    return { sessionId, alreadyStopped };
  }
}
