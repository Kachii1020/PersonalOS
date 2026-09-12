import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/types/database";

test("G7 scheduler retries return one existing claim in an isolated database", async () => {
  assert.equal(process.env.GATE_ISOLATED_DB, "1");
  const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `work-tick-retry-${crypto.randomUUID()}@example.test`;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  assert.ifError(created.error);
  const owner = created.data.user.id;
  const configured = await admin.from("app_config").upsert({ key: "allowed_email", value: email });
  assert.ifError(configured.error);
  const sql = `
begin;
update public.work_scheduler_state set enabled=true where singleton;
insert into public.work_scheduler_probes(slot,request_id,worker_started_at)
values(date_trunc('minute',clock_timestamp()),9001,clock_timestamp())
on conflict(slot) do update set request_id=excluded.request_id,worker_started_at=excluded.worker_started_at,worker_finished_at=null;
do $$
declare context uuid; first_claim jsonb; retry_claim jsonb; other_claim jsonb; claimed_count integer; final_status text; final_lock text;
begin
  insert into public.work_contexts(owner_id,goal,reminder_at)
    values('${owner}','G7 work tick retry gate',clock_timestamp()-interval '1 second')
    returning id into context;
  perform public.work_refresh_attention(context);
  first_claim:=public.claim_measured_work_attention('work-tick-retry-gate',date_trunc('minute',clock_timestamp()),false);
  retry_claim:=public.claim_measured_work_attention('work-tick-retry-gate',date_trunc('minute',clock_timestamp()),false);
  other_claim:=public.claim_measured_work_attention('work-tick-other-worker',date_trunc('minute',clock_timestamp()),false);
  select count(*) into claimed_count from public.attention_items where context_id=context and status='processing';
  if first_claim->>'id' is distinct from retry_claim->>'id' then raise exception 'retry returned a different claim'; end if;
  if other_claim is not null then raise exception 'another worker duplicated the live claim'; end if;
  if claimed_count<>1 then raise exception 'expected exactly one claimed attention, got %',claimed_count; end if;
  perform public.finish_work_attention((first_claim->>'id')::uuid,'work-tick-retry-gate','ready');
  perform public.finish_work_attention((first_claim->>'id')::uuid,'work-tick-retry-gate','ready');
  select status,locked_by into final_status,final_lock from public.attention_items where id=(first_claim->>'id')::uuid;
  if final_status<>'ready' or final_lock is not null then raise exception 'completion retry changed the recorded result'; end if;
end $$;
rollback;
`;
  try {
    execFileSync("docker", ["exec", "-i", "supabase_db_personalOS", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
      input: sql,
      encoding: "utf8",
    });
  } finally {
    assert.ifError((await admin.from("app_config").delete().eq("key", "allowed_email")).error);
    assert.ifError((await admin.auth.admin.deleteUser(owner)).error);
  }
});
