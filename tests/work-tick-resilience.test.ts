import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTransientDatabaseError, retryIdempotentDatabase } from "../lib/jobs/db-retry";

test("work tick retries transient database gateway failures only", async () => {
  let calls = 0;
  const value = await retryIdempotentDatabase(async () => {
    calls++;
    if (calls < 3) throw new Error("Gateway Timeout");
    return "ok";
  }, { delayMs: 0 });
  assert.equal(value, "ok");
  assert.equal(calls, 3);
  assert.equal(isTransientDatabaseError(new Error("503 Service Unavailable")), true);
});

test("work tick does not retry deterministic failures", async () => {
  let calls = 0;
  await assert.rejects(retryIdempotentDatabase(async () => {
    calls++;
    throw new Error("active dispatched scheduler slot required");
  }, { delayMs: 0 }), /active dispatched/);
  assert.equal(calls, 1);
});

test("scheduler claim retry is serialized and returns the same live lease", () => {
  const migration = readFileSync(new URL("../supabase/migrations/0028_work_tick_retry.sql", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/jobs/work-tick/route.ts", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../lib/repos/work-worker.ts", import.meta.url), "utf8");
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /locked_by=p_worker_id/);
  assert.match(migration, /locked_until>clock_timestamp\(\)/);
  assert.match(route, /`work-tick-\$\{slot\}`/);
  assert.match(worker, /retryWorkDatabase\("claim", \(\) => canaryRpc\("claim_measured_work_attention"/);
  assert.match(migration, /a\.status=p_status and a\.locked_by is null/);
});

test("per-minute idle ticks avoid maintenance and duplicate job history writes", () => {
  const route = readFileSync(new URL("../app/api/jobs/work-tick/route.ts", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../lib/repos/work-worker.ts", import.meta.url), "utf8");
  assert.match(worker, /getUTCMinutes\(\) === 0/);
  assert.match(route, /result\.kind !== "idle"/);
  assert.match(route, /console\.error\(`\[work-tick\] \$\{stage\} 실패:/);
});
