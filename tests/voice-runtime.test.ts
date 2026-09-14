import test from "node:test";
import assert from "node:assert/strict";
import { VoiceRuntime } from "../lib/jarvis/voice-runtime";
import type { StartVoiceSessionReply } from "../lib/jarvis/voice-types";

const session = (id: string): StartVoiceSessionReply => ({ sessionId: id, clientSecret: "secret", expiresAt: "2030-01-01T00:00:00Z", maxTurns: 8, maxDurationSeconds: 300, transcriptionModel: "gpt-live-transcribe", turnDetection: null });

test("late turn and heartbeat tokens cannot mutate a replacement session", () => {
  const runtime = new VoiceRuntime();
  const firstGeneration = runtime.startAttempt();
  const first = runtime.activate(firstGeneration, session("first"))!;
  const turn = runtime.nextTurn()!;
  assert.equal(runtime.beginHeartbeat(first), true);
  const nextGeneration = runtime.startAttempt();
  const second = runtime.activate(nextGeneration, session("second"))!;
  assert.equal(runtime.isCurrent(first), false);
  assert.equal(runtime.isCurrent(turn), false);
  assert.equal(runtime.finishHeartbeat(first, false), 0);
  assert.equal(runtime.isCurrent(second), true);
});

test("teardown is idempotent and closes every browser resource", async () => {
  const calls: string[] = [];
  const runtime = new VoiceRuntime();
  const generation = runtime.startAttempt();
  runtime.activate(generation, session("active"));
  runtime.pc = { close: () => calls.push("pc") } as unknown as RTCPeerConnection;
  runtime.dc = { close: () => calls.push("dc") } as unknown as RTCDataChannel;
  runtime.stream = { getTracks: () => [{ stop: () => calls.push("track") }] } as unknown as MediaStream;
  runtime.audio = { state: "running", resume: async () => {}, close: async () => { calls.push("audio"); } } as unknown as AudioContext;
  runtime.source = { stop: () => calls.push("source") } as unknown as AudioBufferSourceNode;
  runtime.micNode = { disconnect: () => calls.push("mic") } as unknown as MediaStreamAudioSourceNode;
  runtime.analyser = { disconnect: () => calls.push("analyser") } as unknown as AnalyserNode;
  runtime.playbackAbort = new AbortController();
  const signal = runtime.playbackAbort.signal;
  assert.deepEqual(runtime.teardown("backgrounded"), { sessionId: "active", alreadyStopped: false });
  assert.equal(signal.aborted, true);
  assert.deepEqual(calls, ["source", "analyser", "mic", "dc", "pc", "track", "audio"]);
  assert.deepEqual(runtime.teardown("backgrounded"), { sessionId: null, alreadyStopped: true });
  await Promise.resolve();
});

test("heartbeat failures are consecutive, serialized, and reset by success", () => {
  const runtime = new VoiceRuntime();
  const generation = runtime.startAttempt();
  const token = runtime.activate(generation, session("heartbeat"))!;
  assert.equal(runtime.beginHeartbeat(token), true);
  assert.equal(runtime.beginHeartbeat(token), false);
  assert.equal(runtime.finishHeartbeat(token, false), 1);
  assert.equal(runtime.beginHeartbeat(token), true);
  assert.equal(runtime.finishHeartbeat(token, false), 2);
  assert.equal(runtime.beginHeartbeat(token), true);
  assert.equal(runtime.finishHeartbeat(token, true), 0);
});
