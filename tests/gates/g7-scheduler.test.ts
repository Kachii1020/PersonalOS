/** Actual local pg_cron → pg_net → HTTP worker. A short wiring test, not the 7-day gate. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/types/database";

test("G7 actual local scheduler reaches worker; seven-day promotion remains blocked", { timeout: 100_000 }, async () => {
  assert.equal(process.env.GATE_ISOLATED_DB, "1");
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54721");
  assert.equal(process.env.CRON_SECRET, "dialogue-eval-local-only");
  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const state = await db.from("work_scheduler_state").select("enabled").single();
  assert.ifError(state.error); assert.equal(state.data!.enabled, false, "Do not replace an active measurement");
  const secretName = `g7-local-${crypto.randomUUID()}`;
  const contextId = crypto.randomUUID();
  const sql = (query: string) => execFileSync("docker", ["exec", "-i", "supabase_db_personalos-dialogue-eval", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { input: query, encoding: "utf8" });
  sql(`select vault.create_secret('dialogue-eval-local-only','${secretName}');`);
  const startedAt = new Date().toISOString();
  try {
    const due = await db.from("attention_items").select("id").in("status", ["pending", "processing", "failed"]).lte("due_at", new Date(Date.now() + 100_000).toISOString());
    assert.ifError(due.error); assert.equal(due.data!.length, 0, "Do not claim unrelated due reminders");
    const subscriptions = await db.from("push_subscriptions").select("id"); assert.ifError(subscriptions.error);
    assert.equal(subscriptions.data!.length, 0, "This wiring gate does not send device Push");
    sql(`insert into public.work_contexts(id,owner_id,goal,reminder_at)
      select '${contextId}',u.id,'G7 synthetic scheduled reminder',date_trunc('second',clock_timestamp())
      from auth.users u join public.app_config c on c.key='allowed_email' and c.value=u.email;
      select public.work_refresh_attention('${contextId}');`);
    const enabled = await db.rpc("configure_work_scheduler", { p_enabled: true, p_url: "http://host.docker.internal:3055/api/jobs/work-tick", p_secret_name: secretName });
    assert.ifError(enabled.error);
    let observed: { slot: string; worker_started_at: string | null; worker_finished_at: string | null } | undefined;
    const deadline = Date.now() + 85_000;
    while (Date.now() < deadline) {
      const probes = await db.from("work_scheduler_probes").select("slot,worker_started_at,worker_finished_at").gte("dispatched_at", startedAt).order("slot", { ascending: false });
      assert.ifError(probes.error);
      observed = probes.data?.find(row => row.worker_finished_at !== null);
      if (observed) break;
      await delay(2000);
    }
    assert.ok(observed?.worker_started_at && observed.worker_finished_at, "Actual scheduled tick must finish; no manual dispatch substitutes");
    const reminder = await db.from("attention_items").select("status,due_at,first_claimed_at").eq("context_id", contextId).single();
    assert.ifError(reminder.error); assert.equal(reminder.data!.status, "ready"); assert.ok(reminder.data!.first_claimed_at);
    const attentionDelayMs = Date.parse(reminder.data!.first_claimed_at!) - Date.parse(reminder.data!.due_at);
    assert.ok(attentionDelayMs >= 0 && attentionDelayMs <= 300_000);
    const health = await db.rpc("work_scheduler_health"); assert.ifError(health.error);
    assert.equal((health.data as { sevenDaysObserved: boolean }).sevenDaysObserved, false);
    console.log(JSON.stringify({ scope: "short actual local cron and one due app reminder, not seven-day SLO or device Push", ...observed, startDelayMs: Date.parse(observed.worker_started_at) - Date.parse(observed.slot), attentionDelayMs, reminder: reminder.data, health: health.data }));
  } finally {
    const disabled = await db.rpc("configure_work_scheduler", { p_enabled: false, p_url: "", p_secret_name: "" });
    assert.ifError(disabled.error);
    sql(`delete from vault.secrets where name='${secretName}';`);
    assert.ifError((await db.from("attention_items").delete().eq("context_id", contextId)).error);
    assert.ifError((await db.from("work_contexts").delete().eq("id", contextId)).error);
  }
});
