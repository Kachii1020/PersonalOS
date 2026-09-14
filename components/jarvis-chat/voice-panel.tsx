"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { reduceVoiceState } from "@/lib/jarvis/voice-state";
import { VoiceRuntime, type VoiceSessionToken, type VoiceTurnToken } from "@/lib/jarvis/voice-runtime";
import type { ChatMessage } from "@/lib/jarvis/dialogue-types";
import type { WorkSnapshot } from "@/lib/jarvis/work-types";
import type { SpeechTicket, StartVoiceSessionReply, VoiceConfirmReply, VoiceMode, VoiceSessionState, VoiceTurnReply, VoiceUiEvent, WorkMutationConfirmation } from "@/lib/jarvis/voice-types";

class VoiceHttpError extends Error { constructor(message: string, readonly status: number) { super(message); } }
async function json<T>(path: string, method = "POST", body?: unknown): Promise<T> {
  const response = await fetch(path, { method, credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
  const data = await response.json();
  if (!response.ok) throw new VoiceHttpError(data.error ?? "음성 요청에 실패했습니다.", response.status);
  return data as T;
}
const labels: Record<VoiceSessionState, string> = { idle: "대기", permission: "마이크 권한 확인", connecting: "음성 연결 중", listening: "듣는 중", transcribing: "전사 확인 중", processing: "업무 처리 중", speaking: "JARVIS 응답 중", stopped: "종료됨" };
const playbackLabels = { idle: "", downloading: "응답 음성 준비 중", received: "응답 음성 수신", playing: "응답 재생 중", completed: "응답 재생 완료", interrupted: "응답 재생 중단" } as const;
type PlaybackState = keyof typeof playbackLabels;
function stateReducer(state: VoiceSessionState, event: VoiceUiEvent): VoiceSessionState { try { return reduceVoiceState(state, event); } catch { return state; } }
type VoiceAdapters={getUserMedia:(constraints:MediaStreamConstraints)=>Promise<MediaStream>;createPeer:()=>RTCPeerConnection;createAudio:()=>AudioContext};
function browserAdapters():VoiceAdapters {
  const injected=(window as unknown as {__PERSONALOS_VOICE_ADAPTERS__?:VoiceAdapters}).__PERSONALOS_VOICE_ADAPTERS__;
  return injected??{getUserMedia:constraints=>navigator.mediaDevices.getUserMedia(constraints),createPeer:()=>new RTCPeerConnection(),createAudio:()=>new AudioContext()};
}
function observePlayback(identity: { sessionId: string; turnId: string } | null, event: "received" | "started" | "completed" | "interrupted" | "failed", errorCode?: string) {
  if (!identity) return;
  void fetch("/api/jarvis/voice/observe", { method: "POST", credentials: "same-origin", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...identity, event, errorCode }) }).catch(() => undefined);
}

export function VoicePanel({ history, contextId, expectedRevision, automaticEnabled, onReply, onWork }: { history: ChatMessage[]; contextId: string | null; expectedRevision?: number; automaticEnabled: boolean; onReply: (transcript: string, reply: VoiceTurnReply) => void; onWork: (work: WorkSnapshot | null, message: string) => void }) {
  const [mode, setMode] = useState<VoiceMode>("push_to_talk"), [state, dispatch] = useReducer(stateReducer, "idle");
  const [partial, setPartial] = useState(""), [finalText, setFinalText] = useState(""), [error, setError] = useState<string | null>(null), [stopReason, setStopReason] = useState<string | null>(null);
  const [replaceAvailable, setReplaceAvailable] = useState(false), [mutating, setMutating] = useState<WorkMutationConfirmation | null>(null), [muted, setMuted] = useState(false), [pttActive, setPttActive] = useState(false), [channelReady, setChannelReady] = useState(false);
  const [turns, setTurns] = useState(0), [remaining, setRemaining] = useState(300), [playback, setPlayback] = useState<PlaybackState>("idle");
  const [lateReply,setLateReply]=useState<string|null>(null);
  const runtime = useRef(new VoiceRuntime()), lastTicket = useRef<SpeechTicket | null>(null), actionTurns = useRef(new Map<string, string>()), talkStarted = useRef(0), handled = useRef(new Set<string>());
  const historyRef = useRef(history), replyRef = useRef(onReply), contextRef = useRef({ contextId, expectedRevision });
  historyRef.current = history; replyRef.current = onReply; contextRef.current = { contextId, expectedRevision };

  const interruptPlayback = useCallback(() => {
    const hadPlayback = !!runtime.current.source || !!runtime.current.playbackAbort;
    const identity = runtime.current.interruptPlayback();
    observePlayback(identity, "interrupted");
    if (hadPlayback) setPlayback("interrupted");
    dispatch({ type: "playback_interrupted" });
  }, []);

  const endSession = useCallback(async (reason = "user") => {
    const interrupted = runtime.current.playbackIdentity;
    const ended = runtime.current.teardown(reason);
    observePlayback(interrupted, "interrupted");
    if (ended.alreadyStopped) return;
    handled.current.clear(); actionTurns.current.clear(); lastTicket.current = null;
    setChannelReady(false); setPttActive(false); setPartial(""); setMutating(null); setStopReason(reason);
    setPlayback(current => current === "idle" || current === "completed" ? current : "interrupted");
    dispatch({ type: "stop" });
    if (ended.sessionId) await json(`/api/jarvis/voice/sessions/${ended.sessionId}`, "DELETE", { reason }).catch(() => undefined);
  }, []);

  const play = useCallback(async (ticket: SpeechTicket | null, token: VoiceTurnToken) => {
    if (!runtime.current.isCurrent(token)) return;
    if (!ticket) { dispatch({type:"turn_failed"}); return; }
    lastTicket.current=ticket;
    if (muted) { setPlayback("interrupted"); dispatch({type:"playback_interrupted"}); return; }
    observePlayback(runtime.current.interruptPlayback(), "interrupted");
    const abort = new AbortController(); runtime.current.playbackAbort = abort; setPlayback("downloading");
    runtime.current.playbackIdentity = { sessionId: ticket.payload.sessionId, turnId: ticket.payload.turnId };
    try {
      const response = await fetch("/api/jarvis/voice/speech", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ticket), signal: abort.signal });
      if (!response.ok) { const data = await response.json(); throw new VoiceHttpError(data.error ?? "음성 재생 실패", response.status); }
      const bytes = await response.arrayBuffer();
      if (!runtime.current.isCurrent(token) || runtime.current.playbackAbort !== abort) return;
      setPlayback("received"); observePlayback(runtime.current.playbackIdentity, "received");
      const context = runtime.current.audio; if (!context) return;
      if (context.state === "suspended") await context.resume();
      if (!runtime.current.isCurrent(token)) return;
      const view = new DataView(bytes), buffer = context.createBuffer(1, Math.floor(bytes.byteLength / 2), 24_000), samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
      const node = context.createBufferSource(); node.buffer = buffer; node.connect(context.destination); runtime.current.source = node;
      setPlayback("playing"); observePlayback(runtime.current.playbackIdentity, "started"); dispatch({ type: "speech_started_output" });
      node.onended = () => { if (runtime.current.source !== node) return; const identity=runtime.current.playbackIdentity; runtime.current.source = null; runtime.current.playbackAbort = null; runtime.current.playbackIdentity = null; if (!runtime.current.isCurrent(token)) return; setPlayback("completed"); observePlayback(identity,"completed"); dispatch({ type: "speech_finished" }); };
      node.start();
    } catch (cause) {
      if (abort.signal.aborted || !runtime.current.isCurrent(token)) return;
      const identity=runtime.current.playbackIdentity;runtime.current.playbackAbort = null;runtime.current.playbackIdentity=null;observePlayback(identity,"failed",cause instanceof Error?cause.name:"PlaybackError");setError(cause instanceof Error ? cause.message : "음성 재생 실패"); dispatch({ type: "turn_failed" });
    }
  }, [muted]);

  const handleFinal = useCallback(async (itemId: string, transcript: string, durationMs: number) => {
    if (handled.current.has(itemId) || durationMs < 300 || !transcript.trim()) return;
    const token = runtime.current.nextTurn(); if (!token) return;
    handled.current.add(itemId); setPartial(""); setFinalText(transcript.trim()); setPlayback("idle"); dispatch({ type: "transcript_final" });
    const selected = contextRef.current;
    try {
      const reply = await json<VoiceTurnReply>("/api/jarvis/voice/turns", "POST", { sessionId: token.sessionId, providerItemId: itemId, requestId: crypto.randomUUID(), durationMs, messages: [...historyRef.current, { role: "user", content: transcript.trim() }].slice(-6), contextId: selected.contextId, expectedRevision: selected.expectedRevision });
      if (!runtime.current.isCurrent(token)) { setLateReply(reply.message); return; }
      setTurns(token.turn);
      for (const action of reply.work?.actions ?? []) if (reply.proposals.some(draft => draft.id === action.draft.id)) actionTurns.current.set(action.id, reply.voice.turnId);
      setMutating(reply.voice.confirmation); replyRef.current(transcript.trim(), reply); await play(reply.voice.speech, token);
    } catch (cause) { if (runtime.current.isCurrent(token)) { setError(cause instanceof Error ? cause.message : "음성 업무 처리 실패"); dispatch({ type: "turn_failed" }); } }
  }, [play]);

  const heartbeat = useCallback((token: VoiceSessionToken) => {
    if (runtime.current.heartbeatTimer) clearInterval(runtime.current.heartbeatTimer);
    runtime.current.heartbeatTimer = setInterval(async () => {
      if (!runtime.current.beginHeartbeat(token)) return;
      const current = runtime.current.session; if (!current) return;
      const left = Math.max(0, Math.ceil((Date.parse(current.expiresAt) - Date.now()) / 1000)); setRemaining(left);
      if (left === 0) { runtime.current.finishHeartbeat(token, true); await endSession("expired"); return; }
      try { await json(`/api/jarvis/voice/sessions/${token.sessionId}`, "PATCH", {}); runtime.current.finishHeartbeat(token, true); }
      catch (cause) { const failures = runtime.current.finishHeartbeat(token, false); if (!runtime.current.isCurrent(token)) return; const terminal = cause instanceof VoiceHttpError && [401, 403, 409].includes(cause.status); if (terminal || failures >= 3) await endSession(terminal ? "session_rejected" : "connection_lost"); }
    }, 15_000);
  }, [endSession]);

  const start = useCallback(async (replaceExisting = false) => {
    if (runtime.current.session) return;
    const generation = runtime.current.startAttempt();
    setError(null); setStopReason(null); setLateReply(null); setReplaceAvailable(false); setChannelReady(false); setTurns(0); setFinalText(""); setPlayback("idle"); lastTicket.current = null; dispatch({ type: "request_permission" });
    try {
      const adapters=browserAdapters();
      const media = await adapters.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (generation !== runtime.current.generation) { media.getTracks().forEach(track => track.stop()); return; }
      runtime.current.stream = media; const context = adapters.createAudio(); runtime.current.audio = context; await context.resume(); dispatch({ type: "permission_granted" });
      const started = await json<StartVoiceSessionReply>("/api/jarvis/voice/sessions", "POST", { mode, contextId: contextRef.current.contextId, replaceExisting });
      const token = runtime.current.activate(generation, started); if (!token) return;
      setRemaining(Math.max(0, Math.floor((Date.parse(started.expiresAt) - Date.now()) / 1000)));
      const peer = adapters.createPeer(); runtime.current.pc = peer; const track = media.getAudioTracks()[0]; track.enabled = mode === "automatic"; peer.addTrack(track, media);
      const channel = peer.createDataChannel("oai-events"); runtime.current.dc = channel; const deltas = new Map<string, string>();
      channel.onopen = () => { if (runtime.current.isCurrent(token)) { setChannelReady(true); dispatch({ type: "connected" }); heartbeat(token); } };
      channel.onclose = () => { if (runtime.current.isCurrent(token)) void endSession("connection_lost"); };
      channel.onmessage = event => {
        if (!runtime.current.isCurrent(token)) return;
        try {
          const data = JSON.parse(event.data) as Record<string, unknown>;
          if (data.type === "conversation.item.input_audio_transcription.delta" && typeof data.item_id === "string" && typeof data.delta === "string") { const value = (deltas.get(data.item_id) ?? "") + data.delta; deltas.set(data.item_id, value); setPartial(value); }
          else if (data.type === "conversation.item.input_audio_transcription.completed" && typeof data.item_id === "string" && typeof data.transcript === "string") { const duration = Math.max(300, Date.now() - (talkStarted.current || Date.now() - 300)); talkStarted.current = 0; void handleFinal(data.item_id, data.transcript, duration); }
          else if (data.type === "error") { setError("음성 전사 연결에서 오류가 발생했습니다. 세션을 다시 시작해 주세요."); void endSession("provider_error"); }
        } catch { setError("음성 전사 이벤트를 읽지 못했습니다."); }
      };
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      const answer = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", headers: { Authorization: `Bearer ${started.clientSecret}`, "Content-Type": "application/sdp" }, body: offer.sdp });
      if (!answer.ok) throw new Error("음성 연결을 만들지 못했습니다.");
      await peer.setRemoteDescription({ type: "answer", sdp: await answer.text() });
      if (mode === "automatic") {
        const input = context.createMediaStreamSource(media), meter = context.createAnalyser(), values = new Uint8Array(256); meter.fftSize = 512; input.connect(meter); runtime.current.micNode = input; runtime.current.analyser = meter;
        let speaking = false, lastLoud = 0;
        const loop = () => {
          if (!runtime.current.isCurrent(token) || !runtime.current.analyser) return;
          meter.getByteTimeDomainData(values); let power = 0; for (const value of values) { const sample = (value - 128) / 128; power += sample * sample; }
          const rms = Math.sqrt(power / values.length), now = Date.now();
          if (rms >= .03) { lastLoud = now; if (!speaking) { speaking = true; talkStarted.current = now; interruptPlayback(); dispatch({ type: "speech_started" }); } }
          else if (speaking && now - lastLoud >= 700) { speaking = false; if (now - talkStarted.current >= 300 && channel.readyState === "open") { channel.send(JSON.stringify({ type: "input_audio_buffer.commit" })); dispatch({ type: "speech_stopped" }); } talkStarted.current = 0; }
          runtime.current.vadFrame = requestAnimationFrame(loop);
        };
        runtime.current.vadFrame = requestAnimationFrame(loop);
      }
    } catch (cause) { if (cause instanceof VoiceHttpError && cause.status === 409) setReplaceAvailable(true); setError(cause instanceof Error ? cause.message : "마이크를 시작하지 못했습니다."); await endSession("start_failed"); }
  }, [endSession, handleFinal, heartbeat, interruptPlayback, mode]);

  useEffect(() => { const hidden = () => { if (document.visibilityState === "hidden" && runtime.current.session) void endSession("backgrounded"); }; document.addEventListener("visibilitychange", hidden); return () => { document.removeEventListener("visibilitychange", hidden); void endSession("unmounted"); }; }, [endSession]);
  useEffect(() => { const result = (event: Event) => { const detail = (event as CustomEvent<{ contextId: string; actionId: string }>).detail, turnId = actionTurns.current.get(detail.actionId), token = runtime.current.nextTurn(); if (!token || !turnId) return; void json<{ speech: SpeechTicket | null }>("/api/jarvis/voice/result-speech", "POST", { sessionId: token.sessionId, turnId, ...detail }).then(value => play(value.speech, token)).catch(cause => { if (runtime.current.isCurrent(token)) setError(cause instanceof Error ? cause.message : "결과 음성 생성 실패"); }); }; window.addEventListener("jarvis-voice-action-result", result); return () => window.removeEventListener("jarvis-voice-action-result", result); }, [play]);

  async function confirm() { if (!mutating) return; const token = runtime.current.nextTurn(); if (!token) return; try { const result = await json<VoiceConfirmReply>("/api/jarvis/voice/confirm", "POST", mutating); if (!runtime.current.isCurrent(token)) return; setMutating(null); onWork(result.work, "확인한 음성 업무 변경을 저장했습니다."); await play(result.speech, token); } catch (cause) { if (runtime.current.isCurrent(token)) setError(cause instanceof Error ? cause.message : "업무 변경 확인 실패"); } }
  function toggleTalk() { const track = runtime.current.stream?.getAudioTracks()[0], channel = runtime.current.dc; if (!track || !channel) return; if (track.enabled) { track.enabled = false; setPttActive(false); channel.send(JSON.stringify({ type: "input_audio_buffer.commit" })); dispatch({ type: "speech_stopped" }); } else { interruptPlayback(); talkStarted.current = Date.now(); track.enabled = true; setPttActive(true); dispatch({ type: "speech_started" }); } }
  async function replay() { const ticket = lastTicket.current, token = runtime.current.nextTurn(); if (!ticket || !token) return; try { const value = await json<{ speech: SpeechTicket }>("/api/jarvis/voice/replay-speech", "POST", ticket); await play(value.speech, token); } catch (cause) { if (runtime.current.isCurrent(token)) setError(cause instanceof Error ? cause.message : "다시 듣기 실패"); } }

  const active = !!runtime.current.session;
  return <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">음성 JARVIS</h2><p className="text-xs text-text-muted">전사는 OpenAI, 업무 판단과 실행은 기존 Phase 7 서버가 담당합니다. AI가 생성한 음성입니다.</p></div><span role="status" className="text-sm text-text-muted">{labels[state]} · 처리 {turns}/8 · {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span></div>
    <div className="mt-3 flex flex-wrap gap-2"><Button disabled={active} variant={mode === "push_to_talk" ? "primary" : "secondary"} onClick={() => setMode("push_to_talk")}>누르고 말하기</Button><Button disabled={active || !automaticEnabled} variant={mode === "automatic" ? "primary" : "secondary"} onClick={() => setMode("automatic")}>자동 대화</Button>{!active ? <Button variant="primary" onClick={() => void start()}><Mic className="size-4" />음성 대화 시작</Button> : <Button onClick={() => void endSession()}><MicOff className="size-4" />종료</Button>}{replaceAvailable && !active && <Button onClick={() => void start(true)}>다른 기기 세션 종료 후 여기서 시작</Button>}{active && mode === "push_to_talk" && <Button disabled={!channelReady} variant="primary" onClick={toggleTalk}>{pttActive ? "말하기 종료" : "말하기 시작"}</Button>}<Button disabled={!active || !lastTicket.current} onClick={() => void replay()}><Volume2 className="size-4" />다시 듣기</Button><Button onClick={() => { setMuted(value => !value); if (!muted) interruptPlayback(); }}>{muted ? "음성 켜기" : "음성 끄기"}</Button></div>
    {(partial || finalText) && <div className="mt-3 rounded-lg border border-line p-3 text-sm"><p className="text-xs text-text-muted">{partial ? "전사 중" : "확정 전사"}</p><p className="mt-1 break-words">{partial || finalText}</p></div>}
    {playbackLabels[playback] && <p className="mt-2 text-xs text-text-muted" data-testid="voice-playback-state">{playbackLabels[playback]}</p>}
    {lateReply&&<p className="mt-2 text-sm text-text-muted" data-testid="voice-late-result">이전 세션 결과: {lateReply}</p>}
    {stopReason && state === "stopped" && <p className="mt-2 text-xs text-text-muted">종료 이유: {stopReason}</p>}
    {mutating && <div className="mt-3 rounded-lg border border-line p-3"><p className="text-sm">음성으로 인식한 업무 상태 변경입니다. 화면에서 확인해야 저장됩니다.</p><Button className="mt-2" variant="primary" onClick={() => void confirm()}>업무 변경 확인</Button></div>}
    {!automaticEnabled && <p className="mt-2 text-xs text-text-muted">자동 턴 감지는 별도 검증 플래그가 켜진 뒤 사용할 수 있습니다.</p>}{error && <p role="alert" className="mt-2 text-sm text-negative">{error} 텍스트 입력은 계속 사용할 수 있습니다.</p>}
  </Card>;
}
