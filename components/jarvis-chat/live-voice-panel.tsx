"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { appendLiveHistory, LiveTranscriptLedger } from "@/lib/jarvis/live-voice";
import { LiveVoiceRuntime, type LiveDelegationToken, type LiveSessionToken } from "@/lib/jarvis/live-voice-runtime";
import type { ChatMessage } from "@/lib/jarvis/dialogue-types";
import type { WorkSnapshot } from "@/lib/jarvis/work-types";
import type { SpeechTicket, StartLiveVoiceSessionReply, VoiceConfirmReply, VoiceTurnReply, WorkMutationConfirmation } from "@/lib/jarvis/voice-types";

class LiveHttpError extends Error { constructor(message: string, readonly status: number) { super(message); } }
async function json<T>(path: string, method = "POST", body?: unknown): Promise<T> {
  const response = await fetch(path, { method, credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
  const data = await response.json();
  if (!response.ok) throw new LiveHttpError(data.error ?? "자연 음성 요청에 실패했습니다.", response.status);
  return data as T;
}

type LiveAdapters = { getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>; createPeer: () => RTCPeerConnection };
function browserAdapters(): LiveAdapters {
  const injected = (window as unknown as { __PERSONALOS_LIVE_VOICE_ADAPTERS__?: LiveAdapters }).__PERSONALOS_LIVE_VOICE_ADAPTERS__;
  return injected ?? { getUserMedia: constraints => navigator.mediaDevices.getUserMedia(constraints), createPeer: () => new RTCPeerConnection() };
}

function ticketText(ticket: SpeechTicket | null) {
  return ticket?.payload.text?.trim() || null;
}

export function LiveVoicePanel({ history, contextId, expectedRevision, onReply, onWork }: {
  history: ChatMessage[];
  contextId: string | null;
  expectedRevision?: number;
  onReply: (transcript: string, reply: VoiceTurnReply) => void;
  onWork: (work: WorkSnapshot | null, message: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "connecting" | "listening" | "working" | "closing" | "stopped">("idle");
  const [partial, setPartial] = useState("");
  const [finalText, setFinalText] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stopReason, setStopReason] = useState<string | null>(null);
  const [replaceAvailable, setReplaceAvailable] = useState(false);
  const [remaining, setRemaining] = useState(300);
  const [turns, setTurns] = useState(0);
  const [usageSeconds, setUsageSeconds] = useState<number | null>(null);
  const [mutating, setMutating] = useState<{ ticket: WorkMutationConfirmation; delegationId: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const runtime = useRef(new LiveVoiceRuntime());
  const ledger = useRef(new LiveTranscriptLedger());
  const handled = useRef(new Set<string>());
  const liveHistory = useRef<ChatMessage[]>(history);
  const contextRef = useRef({ contextId, expectedRevision });
  const replyRef = useRef(onReply);
  const actionTurns = useRef(new Map<string, { turnId: string; delegationId: string }>());
  contextRef.current = { contextId, expectedRevision };
  replyRef.current = onReply;

  const send = useCallback((event: Record<string, unknown>) => {
    const channel = runtime.current.dc;
    if (channel?.readyState !== "open" || runtime.current.closing) return false;
    channel.send(JSON.stringify(event));
    return true;
  }, []);

  const finish = useCallback(async (reason: string) => {
    const sessionId = runtime.current.teardown();
    ledger.current.clear(); handled.current.clear(); actionTurns.current.clear(); liveHistory.current = [];
    setStopReason(reason); setPartial(""); setMutating(null);
    if (sessionId) {
      try { await json(`/api/jarvis/voice/sessions/${sessionId}`, "DELETE", { reason }); }
      catch { setError("음성은 종료했지만 서버 종료 기록을 확인하지 못했습니다. 만료 후 다시 시작해 주세요."); }
    }
    setStatus("stopped");
  }, []);

  const beginHeartbeat = useCallback((token: LiveSessionToken) => {
    if (runtime.current.heartbeatTimer) clearInterval(runtime.current.heartbeatTimer);
    if (runtime.current.countdownTimer) clearInterval(runtime.current.countdownTimer);
    runtime.current.heartbeatTimer = setInterval(async () => {
      if (!runtime.current.beginHeartbeat(token)) return;
      try {
        await json(`/api/jarvis/voice/sessions/${token.sessionId}`, "PATCH", {});
        runtime.current.finishHeartbeat(token, true);
      } catch (cause) {
        const failures = runtime.current.finishHeartbeat(token, false);
        if (!runtime.current.isCurrent(token)) return;
        const terminal = cause instanceof LiveHttpError && [401, 403, 409].includes(cause.status);
        if (terminal || failures >= 3) await finish(terminal ? "session_rejected" : "connection_lost");
      }
    }, 15_000);
    runtime.current.countdownTimer = setInterval(() => {
      if (!runtime.current.isCurrent(token) || !runtime.current.session) return;
      const left = Math.max(0, Math.ceil((Date.parse(runtime.current.session.expiresAt) - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) void finish("expired");
    }, 1_000);
  }, [finish]);

  const handleDelegation = useCallback(async (generation: number, delegationId: string, offsetMs: number) => {
    if (handled.current.has(delegationId)) return;
    handled.current.add(delegationId);
    let transcript = "", stableReads = 0;
    for (let attempt = 0; attempt < 12 && stableReads < 4; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
      if (!runtime.current.isGeneration(generation)) return;
      const next = ledger.current.inputForDelegation(offsetMs);
      stableReads = next && next === transcript ? stableReads + 1 : 0;
      transcript = next;
    }
    const token: LiveDelegationToken | null = runtime.current.nextDelegation(generation);
    if (!token) return;
    ledger.current.markDelegated(offsetMs);
    setPartial(""); setFinalText(transcript);
    if (!transcript) {
      setError("업무로 넘길 확정 전사를 확인하지 못했습니다. 다시 말해 주세요.");
      send({ type: "session.commentary.append", event_id: crypto.randomUUID(), delegation_id: delegationId, content: "방금 말씀을 정확히 확인하지 못했습니다. 다시 말씀해 주세요." });
      return;
    }
    setStatus("working");
    const messages = appendLiveHistory(liveHistory.current.length ? liveHistory.current : history, "user", transcript);
    liveHistory.current = messages;
    const selected = contextRef.current;
    try {
      const result = await json<VoiceTurnReply>("/api/jarvis/live/delegations", "POST", {
        sessionId: token.sessionId,
        delegationId,
        requestId: crypto.randomUUID(),
        transcript,
        durationMs: Math.max(300, Math.min(60_000, offsetMs)),
        messages,
        contextId: selected.contextId,
        expectedRevision: selected.expectedRevision,
      });
      if (!runtime.current.isAccepting(token)) return;
      const spoken = ticketText(result.voice.speech);
      if (!spoken) throw new Error("검증된 음성 결과가 없습니다.");
      liveHistory.current = appendLiveHistory(liveHistory.current, "assistant", result.message);
      setReply(result.message); setTurns(token.sequence); setStatus("listening"); setMutating(result.voice.confirmation ? { ticket: result.voice.confirmation, delegationId } : null);
      for (const action of result.work?.actions ?? []) if (result.proposals.some(proposal => proposal.id === action.draft.id)) actionTurns.current.set(action.id, { turnId: result.voice.turnId, delegationId });
      replyRef.current(transcript, result);
      send({ type: "session.commentary.append", event_id: crypto.randomUUID(), delegation_id: delegationId, content: spoken });
    } catch (cause) {
      if (!runtime.current.isAccepting(token)) return;
      setStatus("listening"); setError(cause instanceof Error ? cause.message : "Phase 7 업무 처리에 실패했습니다.");
      send({ type: "session.commentary.append", event_id: crypto.randomUUID(), delegation_id: delegationId, content: "업무 서버에서 결과를 확인하지 못했습니다. 화면의 텍스트 입력을 사용해 주세요." });
    }
  }, [history, send]);

  const handleProviderEvent = useCallback((generation: number, raw: string) => {
    if (!runtime.current.isGeneration(generation)) return;
    try {
      const event = JSON.parse(raw) as Record<string, unknown>;
      if (event.type === "session.started") {
        const token = runtime.current.session && { generation, sessionId: runtime.current.session.sessionId };
        if (!token || !runtime.current.isCurrent(token)) return;
        setStatus("listening"); setStopReason(null); beginHeartbeat(token);
      } else if ((event.type === "session.input_transcript.delta" || event.type === "session.output_transcript.delta") && typeof event.delta === "string" && typeof event.start_ms === "number" && typeof event.end_ms === "number") {
        const speaker = event.type === "session.input_transcript.delta" ? "input" : "output";
        ledger.current.add(speaker, { delta: event.delta, startMs: event.start_ms, endMs: event.end_ms });
        if (speaker === "input") setPartial(ledger.current.visibleInput());
      } else if (event.type === "session.delegation.created") {
        const delegation = event.delegation && typeof event.delegation === "object" ? event.delegation as Record<string, unknown> : null;
        if (delegation?.target === "client" && typeof delegation.id === "string" && typeof event.offset_ms === "number") void handleDelegation(generation, delegation.id, event.offset_ms);
      } else if (event.type === "session.usage.updated") {
        const usage = event.usage && typeof event.usage === "object" ? event.usage as Record<string, unknown> : null;
        if (typeof usage?.seconds === "number") setUsageSeconds(usage.seconds);
      } else if (event.type === "session.closed") {
        const usage = event.usage && typeof event.usage === "object" ? event.usage as Record<string, unknown> : null;
        if (typeof usage?.seconds === "number") setUsageSeconds(usage.seconds);
        void finish(typeof event.reason === "string" ? event.reason : "closed");
      } else if (event.type === "error") {
        setError("자연 음성 제공자가 요청 하나를 처리하지 못했습니다. 화면 상태를 기준으로 다시 확인해 주세요.");
      }
    } catch {
      setError("자연 음성 이벤트를 읽지 못했습니다.");
    }
  }, [beginHeartbeat, finish, handleDelegation]);

  const start = useCallback(async (replaceExisting = false) => {
    if (runtime.current.session) return;
    const generation = runtime.current.startAttempt();
    ledger.current.clear(); handled.current.clear(); actionTurns.current.clear(); liveHistory.current = history;
    setStatus("connecting"); setError(null); setStopReason(null); setReplaceAvailable(false); setReply(""); setPartial(""); setFinalText(""); setTurns(0); setUsageSeconds(null); setMutating(null);
    try {
      const adapters = browserAdapters();
      const media = await adapters.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (!runtime.current.isGeneration(generation)) { media.getTracks().forEach(track => track.stop()); return; }
      runtime.current.stream = media;
      const peer = adapters.createPeer(); runtime.current.pc = peer; runtime.current.output = audioRef.current;
      if (audioRef.current) {
        peer.ontrack = event => {
          if (!runtime.current.isGeneration(generation) || !audioRef.current) return;
          audioRef.current.srcObject = event.streams[0] ?? new MediaStream([event.track]);
          void audioRef.current.play().catch(() => setError("자동 재생이 차단됐습니다. 화면을 한 번 누른 뒤 다시 시작해 주세요."));
        };
      }
      for (const track of media.getAudioTracks()) peer.addTrack(track, media);
      const channel = peer.createDataChannel("oai-events"); runtime.current.dc = channel;
      channel.onmessage = event => handleProviderEvent(generation, event.data);
      channel.onclose = () => { if (runtime.current.isGeneration(generation) && runtime.current.session) void finish("connection_lost"); };
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      const started = await json<StartLiveVoiceSessionReply>("/api/jarvis/live/sessions", "POST", { sdp: offer.sdp, contextId: contextRef.current.contextId, replaceExisting });
      const token = runtime.current.activate(generation, started);
      if (!token) { await json(`/api/jarvis/voice/sessions/${started.sessionId}`, "DELETE", { reason: "stale_start" }).catch(() => undefined); return; }
      setRemaining(Math.max(0, Math.ceil((Date.parse(started.expiresAt) - Date.now()) / 1000)));
      await peer.setRemoteDescription({ type: "answer", sdp: started.sdpAnswer });
    } catch (cause) {
      if (cause instanceof LiveHttpError && cause.status === 409) setReplaceAvailable(true);
      setError(cause instanceof Error ? cause.message : "자연 음성을 시작하지 못했습니다.");
      await finish("start_failed");
    }
  }, [finish, handleProviderEvent, history]);

  const requestEnd = useCallback(() => {
    if (!runtime.current.requestClose()) return;
    setStatus("closing");
    const channel = runtime.current.dc;
    if (channel?.readyState === "open") {
      channel.send(JSON.stringify({ type: "session.close" }));
      runtime.current.closeTimer = setTimeout(() => void finish("finalization_timeout"), 2_000);
    } else void finish("connection_lost");
  }, [finish]);

  useEffect(() => {
    const hidden = () => { if (document.visibilityState === "hidden" && runtime.current.session) void finish("backgrounded"); };
    document.addEventListener("visibilitychange", hidden);
    return () => { document.removeEventListener("visibilitychange", hidden); void finish("unmounted"); };
  }, [finish]);

  useEffect(() => {
    const result = (event: Event) => {
      const detail = (event as CustomEvent<{ contextId: string; actionId: string }>).detail;
      const identity = actionTurns.current.get(detail.actionId);
      const session = runtime.current.session;
      if (!identity || !session || runtime.current.closing) return;
      const token = { generation: runtime.current.generation, sessionId: session.sessionId };
      void json<{ speech: SpeechTicket | null }>("/api/jarvis/voice/result-speech", "POST", { sessionId: token.sessionId, turnId: identity.turnId, ...detail }).then(value => {
        if (!runtime.current.isAccepting(token)) return;
        const spoken = ticketText(value.speech);
        if (spoken) send({ type: "session.commentary.append", event_id: crypto.randomUUID(), delegation_id: identity.delegationId, content: spoken });
      }).catch(cause => { if (runtime.current.isAccepting(token)) setError(cause instanceof Error ? cause.message : "실행 결과 음성 연결에 실패했습니다."); });
    };
    window.addEventListener("jarvis-voice-action-result", result);
    return () => window.removeEventListener("jarvis-voice-action-result", result);
  }, [send]);

  async function confirm() {
    if (!mutating || !runtime.current.session || runtime.current.closing) return;
    const token = { generation: runtime.current.generation, sessionId: runtime.current.session.sessionId };
    try {
      const result = await json<VoiceConfirmReply>("/api/jarvis/voice/confirm", "POST", mutating.ticket);
      if (!runtime.current.isAccepting(token)) return;
      setMutating(null); onWork(result.work, "확인한 음성 업무 변경을 저장했습니다.");
      const spoken = ticketText(result.speech);
      if (spoken) send({ type: "session.commentary.append", event_id: crypto.randomUUID(), delegation_id: mutating.delegationId, content: spoken });
    } catch (cause) { if (runtime.current.isAccepting(token)) setError(cause instanceof Error ? cause.message : "업무 변경 확인 실패"); }
  }

  const active = status === "connecting" || status === "listening" || status === "working" || status === "closing";
  const statusLabel = status === "connecting" ? "자연 음성 연결 중" : status === "listening" ? "자연 대화 연결됨" : status === "working" ? "Phase 7 확인 중" : status === "closing" ? "사용량 확인 후 종료 중" : status === "stopped" ? "자연 음성 종료됨" : "자연 음성 대기";
  return <Card>
    <audio ref={audioRef} autoPlay className="hidden" aria-hidden="true" />
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">자연 음성 JARVIS · 실험</h2><p className="text-xs text-text-muted">GPT-Live가 듣고 말하며, 업무 판단·승인·영수증은 Phase 7 서버가 담당합니다. AI 생성 음성입니다.</p></div><span role="status" className="text-sm text-text-muted">{statusLabel} · 업무 처리 {turns}/8 · {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span></div>
    <div className="mt-3 flex flex-wrap gap-2">{!active ? <Button variant="primary" onClick={() => void start()}><Mic className="size-4" />자연 음성 시작</Button> : <Button disabled={status === "closing"} onClick={requestEnd}><MicOff className="size-4" />자연 음성 종료</Button>}{replaceAvailable && !active && <Button onClick={() => void start(true)}>다른 기기 세션 종료 후 여기서 시작</Button>}</div>
    {(partial || finalText) && <div className="mt-3 rounded-lg border border-line p-3 text-sm"><p className="text-xs text-text-muted">{partial ? "듣는 중" : "업무로 전달한 전사"}</p><p className="mt-1 break-words">{partial || finalText}</p></div>}
    <p data-testid="live-reply" className="mt-2 text-sm">{reply}</p>
    {mutating && <div className="mt-3 rounded-lg border border-line p-3"><p className="text-sm">음성으로 인식한 업무 상태 변경입니다. 화면에서 확인해야 저장됩니다.</p><Button className="mt-2" variant="primary" onClick={() => void confirm()}>업무 변경 확인</Button></div>}
    {usageSeconds !== null && <p className="mt-2 text-xs text-text-muted">제공자 누적 연결 시간 {usageSeconds.toFixed(1)}초 · 실제 청구액과 별도</p>}
    {stopReason && status === "stopped" && <p className="mt-2 text-xs text-text-muted">종료 이유: {stopReason}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-negative">{error} 텍스트 입력과 기존 음성 모드는 계속 사용할 수 있습니다.</p>}
  </Card>;
}
