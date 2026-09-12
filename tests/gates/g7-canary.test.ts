/** Pure worker + static migration contract checks. No DB/Push/clock fabrication.
 * This file does not claim migration application or seven-day observation.
 * node --import tsx --conditions=react-server --test tests/gates/g7-canary.test.ts
 */
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { completeSilentWorkMeasurement } from "../../lib/repos/work-worker";

const migration = readFileSync(new URL("../../supabase/migrations/0025_work_attention_canary.sql", import.meta.url), "utf8");
const worker = readFileSync(new URL("../../lib/repos/work-worker.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../../app/api/jobs/work-tick/route.ts", import.meta.url), "utf8");
const attention = {
  id: "11111111-1111-4111-8111-111111111111", contextId: "22222222-2222-4222-8222-222222222222",
  ownerId: "33333333-3333-4333-8333-333333333333", kind: "explicit" as const, dueAt: "2026-09-09T03:00:00Z",
  status: "processing", reason: "Silent attention queue measurement", acknowledgedAt: null,
  lockedUntil: "2026-09-09T03:01:30Z", isMeasurement: true,
};
before(() => { mock.method(globalThis, "fetch", () => { throw new Error("Network forbidden in silent canary unit gate"); }); });
after(() => { mock.restoreAll(); });

test("silent sample uses attention completion once with zero provider results", async () => {
  const calls: unknown[][] = [];
  const result = await completeSilentWorkMeasurement(attention, "canary-unit", async (...args) => { calls.push(args); });
  assert.deepEqual(calls, [[attention.id, "canary-unit", "ready"]]);
  assert.deepEqual(result, { kind: "measurement", measurementScope: "silent_canary", attentionId: attention.id,
    accepted: 0, failed: 0, uncertain: 0, pushSkipped: true });
});

test("ordinary user items do not enter the silent completion branch", async () => {
  let finished = 0;
  const result = await completeSilentWorkMeasurement({ ...attention, isMeasurement: false }, "user-unit", async () => { finished++; });
  assert.equal(result, null); assert.equal(finished, 0);
});

test("failed measurement persistence is not reported as successful completion", async () => {
  await assert.rejects(completeSilentWorkMeasurement(attention, "failed-unit", async () => { throw new Error("completion failed"); }), /completion failed/);
});

test("worker returns silent results before subscription lookup or provider setup", () => {
  const completion = worker.indexOf("const measurement = await completeSilentWorkMeasurement(attention, workerId)");
  const exit = worker.indexOf("if (measurement) return", completion);
  const subscriptions = worker.indexOf("const targets = await getClaimedWorkSubscriptions", completion);
  assert.ok(completion >= 0 && exit > completion && subscriptions > exit);
  assert.match(migration, /silent measurements never reserve or send Push/);
  assert.match(migration, /create trigger guard_work_canary_delivery before insert or update on public\.notification_deliveries/);
  assert.match(migration, /if exists\(select 1 from attention_items where id=p_attention_id and is_measurement\) then return null/);
  assert.match(migration, /if exists\(select 1 from attention_items where id=p_attention_id and is_measurement\) then return '\[\]'::jsonb/);
});

test("manual ticks cannot count as scheduler-proven canary claims", () => {
  assert.match(worker, /schedulerSlot\s*\? await retryWorkDatabase\("claim", \(\) => canaryRpc\("claim_measured_work_attention"/);
  assert.match(worker, /: await claimWorkAttention\(workerId, allowAutomatic\)/);
  assert.match(route, /slot \? `work-tick-\$\{slot\}` : `work-tick-\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(route, /processWorkAttention\(workerId, undefined, slot \?\? undefined\)/);
  assert.match(migration, /not is_measurement or \(canary_slot is not null/);
  assert.match(migration, /p_slot is null or p_slot>clock_timestamp\(\)/);
  assert.match(migration, /worker_started_at is not null and worker_finished_at is null/);
  assert.match(migration, /grant execute on function .*claim_measured_work_attention\(text,timestamptz,boolean\) to service_role/);
});

test("system rows are hidden from owners and never use the user quota", () => {
  assert.match(migration, /create unique index work_canary_single_context/);
  assert.match(migration, /using\(public\.is_allowed_user\(\) and owner_id=auth\.uid\(\) and not is_measurement\)/);
  assert.match(migration, /system measurement is service-only/);
  assert.match(migration, /system measurement cannot contain user actions/);
  assert.match(migration, /new\.kind<>'explicit' or new\.quota_reserved_at is not null/);
  assert.match(migration, /owner_id=w\.owner_id and not is_measurement and kind<>'explicit'/);
  assert.match(migration, /order by is_measurement,due_at,id/);
});

test("future schedules and actual timestamps cannot be backfilled as passing history", () => {
  assert.match(migration, /new\.due_at<=clock_timestamp\(\)/);
  assert.match(migration, /new\.created_at:=clock_timestamp\(\)/);
  assert.match(migration, /new\.first_claimed_at is distinct from old\.first_claimed_at/);
  assert.match(migration, /new\.measurement_finished_at:=clock_timestamp\(\)/);
  assert.match(migration, /date_trunc\('hour',clock\)\+interval '1 hour'/);
  assert.match(migration, /expected_canary as/);
  assert.match(migration, /from expected_canary e left join attention_items/);
  assert.match(migration, /a\.created_at<=a\.due_at and a\.first_claimed_at between e\.slot and e\.slot\+interval '5 minutes'/);
});

test("health separates actual canary samples from real work and keeps seven-day minimum", () => {
  assert.match(migration, /'attentionSamples',u\.total/);
  assert.match(migration, /'actualClaimedSamples',m\.observed/);
  assert.match(migration, /'missingSamples',m\.expected-m\.registered/);
  assert.match(migration, /m\.expected>=168 and m\.registered>=168 and m\.observed>=168/);
  assert.match(migration, /now\(\)>=cs\.measurement_started_at\+interval '7 days 5 minutes'/);
  assert.match(migration, /m\.timely::numeric\/greatest\(m\.expected,1\)>=0\.99/);
  assert.match(migration, /'pushDeliveryAllowed',false/);
  assert.doesNotMatch(migration, /insert into (?:public\.)?app_config|update (?:public\.)?app_config|configure_work_scheduler\(true/i);
  assert.match(migration, /enabled boolean not null default false/);
});
