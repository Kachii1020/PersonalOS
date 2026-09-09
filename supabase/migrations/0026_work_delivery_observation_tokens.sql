-- Background service workers may not have the owner's browser session.
-- Each newly reserved delivery attempt receives a narrow, expiring capability.
-- Old delivery rows have no token and cannot acquire invented observations.
create extension if not exists pgcrypto with schema extensions;
alter table public.notification_deliveries
  add column observation_token_hash text check(observation_token_hash is null or observation_token_hash ~ '^[0-9a-f]{64}$'),
  add column observation_expires_at timestamptz;

-- Preserve 0025's measurement exclusion and the underlying owner's claim,
-- consent, quota, retry, and attempt-token guards from 0022.
create or replace function public.begin_work_delivery(p_attention_id uuid,p_worker_id text,p_subscription_id uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare reserved jsonb; observation_token text;
begin
  if exists(select 1 from attention_items where id=p_attention_id and is_measurement) then return null; end if;
  reserved:=begin_user_work_delivery(p_attention_id,p_worker_id,p_subscription_id);
  if reserved is null then return null; end if;
  observation_token:=encode(gen_random_bytes(32),'hex');
  update notification_deliveries set
    observation_token_hash=encode(sha256(convert_to(observation_token,'UTF8')),'hex'),
    observation_expires_at=clock_timestamp()+interval '7 days'
    where id=(reserved->>'deliveryId')::uuid and attempt_token=(reserved->>'attemptToken')::uuid;
  if not found then raise exception 'delivery attempt unavailable'; end if;
  return reserved||jsonb_build_object('observationToken',observation_token);
end $$;

-- The capability grants only idempotent receipt/open timestamps for one current
-- attempt. It cannot read data, acknowledge the work, or approve/execute actions.
create function public.observe_work_delivery(p_delivery_id uuid,p_token text,p_event text)
returns boolean language plpgsql security definer set search_path=public as $$
declare observed timestamptz:=clock_timestamp();
begin
  if p_delivery_id is null or p_token is null or p_token !~ '^[0-9a-f]{64}$'
    or p_event is null or p_event not in ('received','opened') then return false; end if;
  update notification_deliveries set
    received_at=coalesce(received_at,observed),
    opened_at=case when p_event='opened' then coalesce(opened_at,observed) else opened_at end
    where id=p_delivery_id and observation_token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
      and observation_expires_at>observed and attempted_at<=observed
      and provider_state in ('attempted','accepted','uncertain');
  return found;
end $$;
revoke all on function public.begin_work_delivery(uuid,text,uuid),public.observe_work_delivery(uuid,text,text) from public,anon,authenticated;
grant execute on function public.begin_work_delivery(uuid,text,uuid),public.observe_work_delivery(uuid,text,text) to service_role;
-- Existing ack_work_delivery's owner session checks and all RLS remain intact.
