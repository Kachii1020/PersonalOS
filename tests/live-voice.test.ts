import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LIVE_VOICE_MODEL,
  LiveTranscriptLedger,
  liveSessionConfig,
  liveVoiceEnabled,
} from "../lib/jarvis/live-voice";
import { LiveVoiceRuntime } from "../lib/jarvis/live-voice-runtime";
import type { StartLiveVoiceSessionReply } from "../lib/jarvis/voice-types";

const previous = {
  voice: process.env.JARVIS_VOICE_ENABLED,
  live: process.env.JARVIS_LIVE_VOICE_ENABLED,
};

test.after(() => {
  if (previous.voice === undefined) delete process.env.JARVIS_VOICE_ENABLED;
  else process.env.JARVIS_VOICE_ENABLED = previous.voice;
  if (previous.live === undefined) delete process.env.JARVIS_LIVE_VOICE_ENABLED;
  else process.env.JARVIS_LIVE_VOICE_ENABLED = previous.live;
});

test("GPT-Live uses client delegation without tools, storage, or a backend model", () => {
  const config = liveSessionConfig();
  assert.equal(config.model, LIVE_VOICE_MODEL);
  assert.deepEqual(config.delegation, { type: "client" });
  assert.equal(config.store, false);
  assert.equal("tools" in config, false);
  assert.equal("responses" in config.delegation, false);
  assert.match(config.instructions, /화면의 승인 버튼/);
  assert.match(config.instructions, /성공했다고 말하지 마세요/);
});

test("live voice needs both the base voice and independent live flags", () => {
  process.env.JARVIS_VOICE_ENABLED = "true";
  process.env.JARVIS_LIVE_VOICE_ENABLED = "false";
  assert.equal(liveVoiceEnabled(), false);
  process.env.JARVIS_LIVE_VOICE_ENABLED = "true";
  assert.equal(liveVoiceEnabled(), true);
  process.env.JARVIS_VOICE_ENABLED = "false";
  assert.equal(liveVoiceEnabled(), false);
});

test("transcript ledger correlates uneven deltas to the delegation offset", () => {
  const ledger = new LiveTranscriptLedger();
  ledger.add("input", { delta: " 준비", startMs: 1120, endMs: 1300 });
  ledger.add("input", { delta: "이력서", startMs: 1000, endMs: 1120 });
  ledger.add("output", { delta: "좋아요.", startMs: 1350, endMs: 1500 });
  assert.equal(ledger.inputForDelegation(1300), "이력서 준비");
  ledger.markDelegated(1300);
  ledger.add("input", { delta: "내일 20시 일정도 만들어줘", startMs: 1600, endMs: 2100 });
  assert.equal(ledger.inputForDelegation(2100), "내일 20시 일정도 만들어줘");
  ledger.markDelegated(2100);
  assert.equal(ledger.inputForDelegation(2200), "");
});

test("live session budget migration reserves the five-minute maximum", () => {
  const migration = readFileSync(new URL("../supabase/migrations/0032_live_voice_budget.sql", import.meta.url), "utf8");
  assert.match(migration, /when trim\(p_model\)='gpt-live-1' then 0\.25/);
  assert.match(migration, /stt_reserved_usd\) values\(p_owner_id,p_mode,trim\(p_model\),reservation\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
});

test("live routes keep the OpenAI key on the server and reuse Phase 7 turns", () => {
  const client = readFileSync(new URL("../lib/ai/live-voice-client.ts", import.meta.url), "utf8");
  const repo = readFileSync(new URL("../lib/repos/voice.ts", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../components/jarvis-chat/live-voice-panel.tsx", import.meta.url), "utf8");
  assert.match(client, /https:\/\/api\.openai\.com\/v1\/live\/sessions/);
  assert.match(client, /process\.env\.OPENAI_API_KEY/);
  assert.doesNotMatch(panel, /OPENAI_API_KEY|api\.openai\.com/);
  assert.match(repo, /processVoiceTurn\(/);
  assert.match(panel, /session\.commentary\.append/);
  assert.doesNotMatch(panel, /\/api\/jarvis\/voice\/speech/);
});

test("live runtime blocks late delegation results once graceful close starts", () => {
  const runtime = new LiveVoiceRuntime();
  const generation = runtime.startAttempt();
  const session: StartLiveVoiceSessionReply = { sessionId: "local", providerSessionId: "live_provider", sdpAnswer: "answer", expiresAt: "2030-01-01T00:00:00Z", maxTurns: 8, maxDurationSeconds: 300, model: "gpt-live-1" };
  const token = runtime.activate(generation, session)!;
  const delegation = runtime.nextDelegation(generation)!;
  assert.equal(runtime.isAccepting(token), true);
  assert.equal(runtime.requestClose(), true);
  assert.equal(runtime.isCurrent(delegation), true);
  assert.equal(runtime.isAccepting(delegation), false);
  assert.equal(runtime.nextDelegation(generation), null);
  assert.equal(runtime.requestClose(), false);
});
