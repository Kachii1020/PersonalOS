/** Explicit live-model evaluation: synthetic file context; local cost ledger only. */
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { config } from "dotenv";
import { callStructured } from "../lib/ai/client";
import { DIALOGUE_SCHEMA, DIALOGUE_SYSTEM, buildDialoguePrompt } from "../lib/ai/prompts/dialogue";
import { groundDialogueIntent, validateDialogueIntent } from "../lib/jarvis/dialogue-grounding";
import type { ChatMessage } from "../lib/jarvis/dialogue-types";

config({ path: ".env.local", quiet: true });
type Case = { id: string; group: string; messages: ChatMessage[]; selectedSourceId?: string; expected: Record<string, unknown> };
type Corpus = { version: number; referenceTime: string; sources: { id: string; title: string; detail: string }[]; cases: Case[] };
type Outcome = { id: string; group: string; passed: boolean; mismatches: string[]; latencyMs: number; costUsd: number; unsafeProposal: boolean; error?: string; actual?: unknown; intent?: unknown; model?: string };
async function main() {
const label = process.argv[2];
assert.match(label ?? "", /^[a-z0-9-]{1,40}$/, "Provide a unique run label, e.g. baseline-01");
assert.equal(process.env.GATE_ISOLATED_DB, "1");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54721", "Only the dedicated dialogue-evaluation usage ledger is permitted");
assert.equal(process.env.ALLOWED_EMAIL, "phase5a@example.test");
assert.equal(process.env.DIALOGUE_EVAL_ALLOW_LIVE, "1", "Explicit live synthetic model evaluation required");
assert.ok(process.env.ANTHROPIC_API_KEY);
const raw = readFileSync("tests/fixtures/dialogue-eval.json", "utf8");
const corpus = JSON.parse(raw) as Corpus;
assert.equal(corpus.cases.length, 100); assert.equal(new Set(corpus.cases.map(c => c.id)).size, 100);
assert.ok(Number.isFinite(Date.parse(corpus.referenceTime)));
assert.ok(corpus.sources.length <= 20);
for (const c of corpus.cases) { assert.ok(c.messages.length > 0 && c.messages.length <= 6); assert.equal(c.messages.at(-1)?.role, "user"); assert.ok(c.expected.kind); }
const directory = `test-results/dialogue-eval-${label}`;
assert.ok(!existsSync(directory), "Never overwrite an earlier measurement");
mkdirSync(directory, { recursive: true, mode: 0o700 });
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const metadata = { startedAt: new Date().toISOString(), gitSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  corpusSha256: sha(raw), groundingSha256: sha(readFileSync("lib/jarvis/dialogue-grounding.ts", "utf8")),
  promptSha256: sha(readFileSync("lib/ai/prompts/dialogue.ts", "utf8")), cases: 100, concurrency: 2,
  readFiltersSha256: existsSync("lib/jarvis/dialogue-read-filters.ts") ? sha(readFileSync("lib/jarvis/dialogue-read-filters.ts", "utf8")) : null,
  contextSource: "synthetic corpus only; no repository snapshots or external action imports", referenceTime: corpus.referenceTime };
writeFileSync(`${directory}/metadata.json`, JSON.stringify(metadata, null, 2) + "\n", { mode: 0o600, flag: "wx" });
const outcomes: Outcome[] = [];
async function ledger() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ai_usage?select=id,cost_usd&purpose=eq.dialogue`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }, signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, 200, "Local usage ledger must be readable before live evaluation");
  return await response.json() as { id: number; cost_usd: number }[];
}
const priorIds = new Set((await ledger()).map(row => row.id));
let cursor = 0, spent = 0, stopReason: string | null = null;
const costCap = Number(process.env.DIALOGUE_EVAL_MAX_COST_USD ?? "2");
assert.ok(costCap > 0 && costCap <= 5);
async function worker() {
  while (!stopReason && cursor < corpus.cases.length) {
    if (spent >= costCap) { stopReason = "per-run recorded cost cap reached"; break; }
    const c = corpus.cases[cursor++]; const start = performance.now();
    let result: Outcome;
    let callCost = 0;
    try {
      const response = await callStructured<unknown>({ purpose: "dialogue", system: DIALOGUE_SYSTEM,
        userMessage: buildDialoguePrompt(c.messages, corpus.sources, new Date(corpus.referenceTime), c.selectedSourceId), schema: DIALOGUE_SCHEMA,
        maxTokens: 1800, effort: "low", retries: 0, timeoutMs: 45_000 });
      callCost = response.costUsd; spent += callCost;
      const intent = validateDialogueIntent(response.data);
      // Match the route's explicit selected-target behavior, not a different evaluator pipeline.
      if (intent.kind === "update_calendar" && c.selectedSourceId) intent.sourceId = c.selectedSourceId;
      const actual = groundDialogueIntent(intent, c.messages, new Date(corpus.referenceTime), corpus.sources.map(s => s.id), c.selectedSourceId);
      const fields = actual as unknown as Record<string, unknown>;
      const mismatches = Object.entries(c.expected).filter(([key, value]) => !isDeepStrictEqual(fields[key], value)).map(([key]) => key);
      const write = ["create_task", "create_calendar", "update_calendar"].includes(actual.kind);
      const expectedWrite = ["create_task", "create_calendar", "update_calendar"].includes(String(c.expected.kind));
      result = { id: c.id, group: c.group, passed: mismatches.length === 0, mismatches, latencyMs: Math.round(performance.now() - start),
        costUsd: callCost, unsafeProposal: write && !actual.needsClarification && (!expectedWrite || mismatches.length > 0), actual, intent, model: response.model };
    } catch (error) {
      result = { id: c.id, group: c.group, passed: false, mismatches: ["error"], latencyMs: Math.round(performance.now() - start),
        costUsd: callCost, unsafeProposal: false, error: error instanceof Error ? error.name + ": " + error.message : "Unknown evaluation error" };
      if (error instanceof Error && error.name === "BudgetExceededError") stopReason = "central budget guard blocked evaluation";
    }
    outcomes.push(result);
    appendFileSync(`${directory}/outcomes.jsonl`, JSON.stringify(result) + "\n", { mode: 0o600 });
    if (outcomes.length % 10 === 0) console.log(`${label}: ${outcomes.length}/100 completed, ${outcomes.filter(o => o.passed).length} passed, recorded response cost $${spent.toFixed(4)}`);
  }
}
await Promise.all([worker(), worker()]);
const recorded = (await ledger()).filter(row => !priorIds.has(row.id));
const latency = outcomes.map(o => o.latencyMs).sort((a, b) => a - b);
const percentile = (p: number) => latency.length ? latency[Math.ceil(p * latency.length) - 1] : null;
const groups = Object.fromEntries([...new Set(corpus.cases.map(c => c.group))].map(group => {
  const rows = outcomes.filter(o => o.group === group);
  return [group, { completed: rows.length, passed: rows.filter(o => o.passed).length, unsafeProposals: rows.filter(o => o.unsafeProposal).length }];
}));
const summary = { ...metadata, finishedAt: new Date().toISOString(), completed: outcomes.length, passed: outcomes.filter(o => o.passed).length,
  failed: outcomes.filter(o => !o.passed).length, unsafeProposals: outcomes.filter(o => o.unsafeProposal).length, externalWrites: 0,
  modelResponses: outcomes.filter(o => o.model).length, recordedCalls: recorded.length,
  recordedCostUsd: Number(recorded.reduce((sum, row) => sum + Number(row.cost_usd), 0).toFixed(6)),
  responseCostUsd: Number(spent.toFixed(6)), latencyP50Ms: percentile(.5), latencyP95Ms: percentile(.95), stopReason, groups,
  limitation: "Grounded-intent/proposal evaluation, not execution or general conversation accuracy. Safety mismatches count even though no action can execute. Error response costs may be missing; consult local ai_usage ledger." };
writeFileSync(`${directory}/summary.json`, JSON.stringify(summary, null, 2) + "\n", { mode: 0o600 });
console.log(JSON.stringify(summary, null, 2));
if (outcomes.length !== 100) process.exitCode = 2;
}
void main().catch(error => { console.error(error instanceof Error ? `${error.name}: ${error.message}` : "Evaluation failed"); process.exitCode = 1; });
