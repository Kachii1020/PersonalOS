/** Synthetic historical timestamps exercise policy math, NOT seven-day evidence.
 * Every fixture and temporary scheduler overlay is transactionally rolled back.
 * Run only while the isolated 54721 database is reserved for this gate. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/types/database";

type Health = { automaticPromotionReady: boolean; sevenDaysObserved: boolean; expectedSlots: number; timelyRatio: number; attentionSamples: number; attentionTimelyStarts: number; attentionSampleDays: number; attentionTimelyRatio: number };
type Result = { stage: string; health?: Health; stateHash?: string; probesHash?: string; ownedContexts?: number; ownedAttention?: number };

test("G7 synthetic attention SLO blocks healthy wakeups with missed claims and checks rolling degradation", { timeout: 45_000 }, async () => {
  assert.equal(process.env.GATE_ISOLATED_DB, "1");
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54721");
  assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY);
  assert.ok(process.env.ALLOWED_EMAIL);
  const client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const users = await client.auth.admin.listUsers();
  assert.ifError(users.error);
  const owner = users.data.users.find((user) => user.email === process.env.ALLOWED_EMAIL);
  assert.ok(owner, "Use the existing isolated owner; this gate does not create auth users");
  assert.match(owner.id, /^[0-9a-f-]{36}$/i);
  const marker = `g7-synthetic-slo-${crypto.randomUUID()}`;
  const snapshot = (stage: string) => `select jsonb_build_object('stage','${stage}',
    'stateHash',(select md5(coalesce(jsonb_agg(to_jsonb(s) order by singleton)::text,'[]')) from public.work_scheduler_state s),
    'probesHash',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by slot)::text,'[]')) from public.work_scheduler_probes p),
    'ownedContexts',(select count(*) from public.work_contexts where goal='${marker}'),
    'ownedAttention',(select count(*) from public.attention_items where dedupe_key like '${marker}:%'));`;
  const sql = `
begin isolation level repeatable read;
set local lock_timeout='5s';
set local statement_timeout='25s';
set local role service_role;
${snapshot("before")}
do $gate$
begin
  if (select enabled from public.work_scheduler_state where singleton) then raise exception 'Do not replace an active scheduler measurement'; end if;
  if exists(select 1 from public.attention_items where due_at between date_trunc('minute',now())-interval '7 days 4 minutes' and date_trunc('minute',now())-interval '5 minutes') then
    raise exception 'Reserve a clear isolated attention sample window; other fixtures must not be changed';
  end if;
end $gate$;
-- No configure/dispatch function is called: no cron, Vault or HTTP side effect.
update public.work_scheduler_state set enabled=true,measurement_started_at=now()-interval '8 days' where singleton;
insert into public.work_scheduler_probes(slot,dispatched_at,worker_started_at,worker_finished_at)
select slot,slot,slot+interval '20 seconds',slot+interval '30 seconds'
from generate_series(date_trunc('minute',now())-interval '7 days 4 minutes',date_trunc('minute',now())-interval '5 minutes',interval '1 minute') slot
on conflict(slot) do update set dispatched_at=excluded.dispatched_at,worker_started_at=excluded.worker_started_at,worker_finished_at=excluded.worker_finished_at;
with work as (
 insert into public.work_contexts(owner_id,goal,progress,next_step) values('${owner.id}','${marker}','Synthetic policy fixture only','No actual notification') returning id
)
insert into public.attention_items(owner_id,context_id,source_revision,kind,due_at,status,reason,dedupe_key,first_claimed_at)
select '${owner.id}',work.id,1,'explicit',due,
 case when i<50 then 'ready' else 'cancelled' end,
 'SYNTHETIC historical timestamp; NOT seven-day operational evidence','${marker}:'||i,
 case when i<50 then due+interval '6 minutes' else null end
from work cross join generate_series(0,99) i
cross join lateral (select date_trunc('minute',now())-interval '7 days 4 minutes'+i*interval '100 minutes' as due) times;
select jsonb_build_object('stage','late-and-missing','health',public.work_scheduler_health());
-- Update only this test's attention rows. All cancellations/missing claims above
-- were counted in the denominator; this branch simulates timely completion.
update public.attention_items set first_claimed_at=due_at+interval '1 minute',status='ready' where dedupe_key like '${marker}:%';
select jsonb_build_object('stage','all-on-time','health',public.work_scheduler_health());
-- A recent failure must spoil the rolling result even after the initial week.
update public.work_scheduler_probes set worker_started_at=null,worker_finished_at=null
where slot in (select slot from public.work_scheduler_probes where slot between date_trunc('minute',now())-interval '106 minutes' and date_trunc('minute',now())-interval '5 minutes');
select jsonb_build_object('stage','recent-wakeup-loss','health',public.work_scheduler_health());
rollback;
${snapshot("after")}
`;
  // A SQL assertion/error also closes the connection and rolls back the transaction.
  const output = execFileSync("docker", ["exec", "-i", "supabase_db_personalos-dialogue-eval", "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { input: sql, encoding: "utf8", timeout: 35_000, maxBuffer: 1024 * 1024 });
  const rows = output.split("\n").filter((line) => line.startsWith("{")).map((line) => JSON.parse(line) as Result);
  const stage = (name: string) => { const row = rows.find((entry) => entry.stage === name); assert.ok(row, name); return row; };
  const before = stage("before"); const after = stage("after");
  assert.equal(after.stateHash, before.stateHash, "Original scheduler settings restored");
  assert.equal(after.probesHash, before.probesHash, "Original probes restored, including overwritten timestamps");
  assert.equal(after.ownedContexts, 0); assert.equal(after.ownedAttention, 0);
  const late = stage("late-and-missing").health!;
  assert.equal(late.sevenDaysObserved, true, "Synthetic clock data tests the predicate, not elapsed real days");
  assert.equal(late.expectedSlots, 10080); assert.equal(late.timelyRatio, 1);
  assert.equal(late.attentionSamples, 100); assert.ok(late.attentionSampleDays >= 7);
  assert.equal(late.attentionTimelyStarts, 0); assert.equal(late.attentionTimelyRatio, 0);
  assert.equal(late.automaticPromotionReady, false, "Healthy wakeups cannot substitute for actual due-item first claims");
  const timely = stage("all-on-time").health!;
  assert.equal(timely.attentionTimelyRatio, 1); assert.equal(timely.automaticPromotionReady, true);
  const degraded = stage("recent-wakeup-loss").health!;
  assert.ok(degraded.timelyRatio < 0.99); assert.equal(degraded.automaticPromotionReady, false);
  console.log(JSON.stringify({ scope: "SYNTHETIC historical policy test only; not real seven-day SLO, cron delivery, Push or automatic-promotion authorization", late, timely, degraded, rollbackVerified: true }));
});
