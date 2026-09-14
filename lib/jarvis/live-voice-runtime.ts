import type { StartLiveVoiceSessionReply } from "./voice-types";

export type LiveSessionToken = { generation: number; sessionId: string };
export type LiveDelegationToken = LiveSessionToken & { sequence: number };

export class LiveVoiceRuntime {
  generation = 0;
  sequence = 0;
  session: StartLiveVoiceSessionReply | null = null;
  pc: RTCPeerConnection | null = null;
  dc: RTCDataChannel | null = null;
  stream: MediaStream | null = null;
  output: HTMLAudioElement | null = null;
  heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  countdownTimer: ReturnType<typeof setInterval> | null = null;
  closeTimer: ReturnType<typeof setTimeout> | null = null;
  heartbeatInFlight = false;
  heartbeatFailures = 0;
  closing = false;

  startAttempt() {
    this.teardown();
    return this.generation;
  }

  activate(generation: number, session: StartLiveVoiceSessionReply): LiveSessionToken | null {
    if (generation !== this.generation) return null;
    this.session = session;
    this.closing = false;
    return { generation, sessionId: session.sessionId };
  }

  isGeneration(generation: number) {
    return generation === this.generation;
  }

  isCurrent(token: LiveSessionToken | LiveDelegationToken) {
    return token.generation === this.generation && token.sessionId === this.session?.sessionId;
  }

  isAccepting(token: LiveSessionToken | LiveDelegationToken) {
    return this.isCurrent(token) && !this.closing;
  }

  nextDelegation(generation: number): LiveDelegationToken | null {
    if (!this.session || !this.isGeneration(generation) || this.closing) return null;
    this.sequence += 1;
    return { generation, sessionId: this.session.sessionId, sequence: this.sequence };
  }

  beginHeartbeat(token: LiveSessionToken) {
    if (!this.isAccepting(token) || this.heartbeatInFlight) return false;
    this.heartbeatInFlight = true;
    return true;
  }

  finishHeartbeat(token: LiveSessionToken, success: boolean) {
    if (!this.isCurrent(token)) return this.heartbeatFailures;
    this.heartbeatInFlight = false;
    this.heartbeatFailures = success ? 0 : this.heartbeatFailures + 1;
    return this.heartbeatFailures;
  }

  requestClose() {
    if (!this.session || this.closing) return false;
    this.closing = true;
    return true;
  }

  teardown() {
    const sessionId = this.session?.sessionId ?? null;
    this.session = null;
    this.closing = false;
    this.generation += 1;
    this.sequence = 0;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.heartbeatTimer = null;
    this.countdownTimer = null;
    this.closeTimer = null;
    this.heartbeatInFlight = false;
    this.heartbeatFailures = 0;
    try { this.dc?.close(); } catch {}
    try { this.pc?.close(); } catch {}
    try { this.stream?.getTracks().forEach(track => track.stop()); } catch {}
    try { this.output?.pause(); } catch {}
    if (this.output) this.output.srcObject = null;
    this.dc = null;
    this.pc = null;
    this.stream = null;
    this.output = null;
    return sessionId;
  }
}
