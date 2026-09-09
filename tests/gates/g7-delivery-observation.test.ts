/** Isolated SQL capability contract; no push sent, all fixtures rolled back. */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/types/database";
config({path:[".env.eval.local",".env.local"],quiet:true});

test("G7 delivery observation capability rotates, expires and cannot cross delivery identity", { timeout: 45_000 }, async () => {
  assert.equal(process.env.GATE_ISOLATED_DB, "1");
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54721");
  const admin=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});const link=await admin.auth.admin.generateLink({type:"magiclink",email:process.env.ALLOWED_EMAIL!});assert.ifError(link.error);const ownerId=link.data.user.id;
  try { const output = execFileSync("docker", ["exec", "-i", "supabase_db_personalos-dialogue-eval", "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { encoding: "utf8", timeout: 35_000, input: `
begin;
set local statement_timeout='15s';
do $gate$
declare owner_id uuid; context_id uuid; attention_id uuid; subscription_id uuid; reserved jsonb; second jsonb; delivery_id uuid; token text; observed timestamptz;
begin
 select u.id into strict owner_id from auth.users u join public.app_config c on c.key='allowed_email' and c.value=u.email;
 insert into public.work_contexts(owner_id,goal,reminder_at) values(owner_id,'g7 token fixture',now()-interval '1 minute') returning id into context_id;
 insert into public.attention_items(owner_id,context_id,source_revision,kind,due_at,status,reason,dedupe_key,locked_by,locked_until)
 values(owner_id,context_id,1,'explicit',now()-interval '1 minute','processing','fixture',gen_random_uuid()::text,'token-gate',now()+interval '5 minutes') returning id into attention_id;
 insert into public.push_subscriptions(endpoint,p256dh,auth) values('https://push.invalid/'||gen_random_uuid(),'fixture-key','fixture-auth') returning id into subscription_id;
 reserved:=public.begin_work_delivery(attention_id,'token-gate',subscription_id);
 delivery_id:=(reserved->>'deliveryId')::uuid; token:=reserved->>'observationToken';
 if token is null or length(token)<>64 then raise exception 'fresh observation token missing'; end if;
 if (select observation_token_hash from public.notification_deliveries where id=delivery_id)<>encode(sha256(convert_to(token,'UTF8')),'hex') then raise exception 'token hash mismatch'; end if;
 if public.observe_work_delivery(delivery_id,repeat('0',64),'received') then raise exception 'wrong token accepted'; end if;
 if public.observe_work_delivery(gen_random_uuid(),token,'received') then raise exception 'wrong delivery accepted'; end if;
 if public.observe_work_delivery(delivery_id,token,'approved') then raise exception 'unsupported event accepted'; end if;
 if not public.observe_work_delivery(delivery_id,token,'opened') then raise exception 'attempted observation rejected'; end if;
 select received_at into observed from public.notification_deliveries where id=delivery_id and opened_at is not null;
 if observed is null then raise exception 'open did not imply receive'; end if;
 perform public.observe_work_delivery(delivery_id,token,'received');
 if (select received_at from public.notification_deliveries where id=delivery_id) is distinct from observed then raise exception 'observation not idempotent'; end if;
 update public.notification_deliveries set provider_state='failed',retry_after=now()-interval '1 minute',received_at=null,opened_at=null where id=delivery_id;
 if public.observe_work_delivery(delivery_id,token,'received') then raise exception 'failed provider observation accepted'; end if;
 second:=public.begin_work_delivery(attention_id,'token-gate',subscription_id);
 if second->>'observationToken'=token or (second->>'attempt')::integer<>2 then raise exception 'retry token did not rotate'; end if;
 if public.observe_work_delivery(delivery_id,token,'received') then raise exception 'previous attempt token accepted'; end if;
 token:=second->>'observationToken';
 update public.notification_deliveries set provider_state='uncertain' where id=delivery_id;
 if not public.observe_work_delivery(delivery_id,token,'received') then raise exception 'uncertain valid observation rejected'; end if;
 update public.notification_deliveries set observation_expires_at=now()-interval '1 second' where id=delivery_id;
 if public.observe_work_delivery(delivery_id,token,'opened') then raise exception 'expired token accepted'; end if;
 update public.notification_deliveries set observation_token_hash=null,observation_expires_at=null where id=delivery_id;
 if public.observe_work_delivery(delivery_id,token,'opened') then raise exception 'legacy delivery reconstructed'; end if;
 if has_function_privilege('anon','public.observe_work_delivery(uuid,text,text)','execute') or has_function_privilege('authenticated','public.observe_work_delivery(uuid,text,text)','execute') then raise exception 'capability RPC exposed directly'; end if;
 if not has_function_privilege('service_role','public.observe_work_delivery(uuid,text,text)','execute') then raise exception 'service capability RPC missing'; end if;
 if has_function_privilege('service_role','public.ack_work_delivery(uuid,text)','execute') then raise exception 'owner ack privilege weakened'; end if;
end $gate$;
rollback;
select 'token-policy-passed-and-rolled-back';
` });
  assert.match(output, /token-policy-passed-and-rolled-back/);
  } finally { assert.ifError((await admin.auth.admin.deleteUser(ownerId)).error); }
});
