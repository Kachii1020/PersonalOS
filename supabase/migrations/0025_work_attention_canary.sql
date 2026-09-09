-- Silent hourly queue measurements. This migration enables no scheduler,
-- automatic user reminders, feature flag or Push delivery.
-- Rollback: configure_work_attention_canary(false); keep measurement history.
alter table public.work_contexts add column is_measurement boolean not null default false;
alter table public.attention_items add column is_measurement boolean not null default false;
alter table public.attention_items add column measurement_slot timestamptz references public.work_scheduler_probes(slot);
alter table public.attention_items add column measurement_finished_at timestamptz;
create unique index work_canary_single_context on public.work_contexts(is_measurement) where is_measurement;
create unique index work_canary_hour on public.attention_items(due_at) where is_measurement;
create table public.work_attention_canary_state (
  singleton boolean primary key default true check(singleton), enabled boolean not null default false,
  context_id uuid references public.work_contexts(id), measurement_started_at timestamptz,
  first_due_at timestamptz, planned_through timestamptz
);
insert into public.work_attention_canary_state(singleton) values(true);
alter table public.work_attention_canary_state enable row level security;
revoke all on public.work_attention_canary_state from public,anon,authenticated;
grant all on public.work_attention_canary_state to service_role;

-- Existing owner read RPCs are security-invoker and inherit these exclusions.
drop policy work_owner on public.work_contexts;
create policy work_owner on public.work_contexts for select to authenticated
  using(public.is_allowed_user() and owner_id=auth.uid() and not is_measurement);
drop policy work_owner on public.attention_items;
create policy work_owner on public.attention_items for select to authenticated
  using(public.is_allowed_user() and owner_id=auth.uid() and not is_measurement);

create function public.guard_work_canary_context() returns trigger language plpgsql set search_path=public as $$
begin
  if (case when tg_op='DELETE' then old.is_measurement else new.is_measurement end)
    and (auth.role() in ('anon','authenticated') or current_user in ('anon','authenticated')) then
    raise exception 'system measurement is service-only' using errcode='42501';
  end if;
  if tg_op='UPDATE' and old.is_measurement is distinct from new.is_measurement then raise exception 'measurement identity is immutable'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger guard_work_canary_context before insert or update or delete on public.work_contexts
  for each row execute function public.guard_work_canary_context();

create function public.guard_work_canary_attention() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='UPDATE' and old.is_measurement is distinct from new.is_measurement then raise exception 'measurement identity is immutable'; end if;
  if not (case when tg_op='DELETE' then old.is_measurement else new.is_measurement end) then
    if tg_op<>'DELETE' and exists(select 1 from work_contexts where id=new.context_id and is_measurement) then raise exception 'system attention must be marked measurement'; end if;
    return case when tg_op='DELETE' then old else new end;
  end if;
  if auth.role() in ('anon','authenticated') or current_user in ('anon','authenticated') then raise exception 'measurement is service-only' using errcode='42501'; end if;
  if tg_op='DELETE' then return old; end if;
  if not exists(select 1 from work_contexts where id=new.context_id and is_measurement and owner_id=new.owner_id)
    or new.kind<>'explicit' or new.quota_reserved_at is not null then raise exception 'invalid measurement context or quota'; end if;
  if tg_op='INSERT' then
    if new.due_at<=clock_timestamp() or date_trunc('hour',new.due_at)<>new.due_at
      or new.first_claimed_at is not null or new.measurement_slot is not null or new.measurement_finished_at is not null or new.status<>'pending'
      then raise exception 'canary must be registered before its future hourly due time'; end if;
    new.created_at:=clock_timestamp(); new.updated_at:=new.created_at;
  else
    if new.due_at is distinct from old.due_at or new.created_at is distinct from old.created_at
      or new.first_claimed_at is distinct from old.first_claimed_at
      or new.measurement_finished_at is distinct from old.measurement_finished_at
      or (old.measurement_slot is not null and new.measurement_slot is distinct from old.measurement_slot)
      or new.context_id is distinct from old.context_id or new.owner_id is distinct from old.owner_id
      then raise exception 'actual measurement history cannot be rewritten'; end if;
    if new.status='processing' then
      if new.measurement_slot is null or not exists(select 1 from work_scheduler_probes p where p.slot=new.measurement_slot
        and p.request_id is not null and p.worker_started_at is not null) then raise exception 'dispatched scheduler provenance required'; end if;
    end if;
    if new.status='ready' and old.status='processing' and old.measurement_finished_at is null then new.measurement_finished_at:=clock_timestamp(); end if;
  end if;
  return new;
end $$;
-- Alphabetically before mark_work_attention_claim: attempts to supply a false
-- first_claimed_at fail; the existing trigger alone records clock_timestamp().
create trigger guard_work_canary_attention before insert or update or delete on public.attention_items
  for each row execute function public.guard_work_canary_attention();

create function public.guard_work_canary_delivery() returns trigger language plpgsql set search_path=public as $$
begin
  if exists(select 1 from attention_items where id=new.attention_id and is_measurement) then
    raise exception 'silent measurements never reserve or send Push' using errcode='42501';
  end if;
  return new;
end $$;
create trigger guard_work_canary_delivery before insert or update on public.notification_deliveries
  for each row execute function public.guard_work_canary_delivery();
create function public.guard_work_canary_action() returns trigger language plpgsql set search_path=public as $$
begin
  if exists(select 1 from work_contexts where id=new.context_id and is_measurement) then raise exception 'system measurement cannot contain user actions' using errcode='42501'; end if;
  return new;
end $$;
create trigger guard_work_canary_action before insert or update on public.work_context_actions
  for each row execute function public.guard_work_canary_action();

-- Keep user implementations intact behind narrowly gated service wrappers.
alter function public.begin_work_delivery(uuid,text,uuid) rename to begin_user_work_delivery;
revoke all on function public.begin_user_work_delivery(uuid,text,uuid) from public,anon,authenticated,service_role;
create function public.begin_work_delivery(p_attention_id uuid,p_worker_id text,p_subscription_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from attention_items where id=p_attention_id and is_measurement) then return null; end if;
  return begin_user_work_delivery(p_attention_id,p_worker_id,p_subscription_id);
end $$;
alter function public.get_claimed_work_subscriptions(uuid) rename to get_claimed_user_work_subscriptions;
revoke all on function public.get_claimed_user_work_subscriptions(uuid) from public,anon,authenticated,service_role;
create function public.get_claimed_work_subscriptions(p_attention_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from attention_items where id=p_attention_id and is_measurement) then return '[]'::jsonb; end if;
  return get_claimed_user_work_subscriptions(p_attention_id);
end $$;

create function public.seed_work_attention_canary() returns integer language plpgsql security definer set search_path=public as $$
declare s work_attention_canary_state; w work_contexts; clock timestamptz:=clock_timestamp(); first_new timestamptz; last_new timestamptz; n integer;
begin
  select * into strict s from work_attention_canary_state where singleton for update;
  if not s.enabled then return 0; end if;
  select * into strict w from work_contexts where id=s.context_id and is_measurement;
  if s.first_due_at is null or s.measurement_started_at is null or w.forgotten_at is not null then raise exception 'canary configuration unavailable'; end if;
  if s.planned_through>=clock+interval '7 days' then return 0; end if;
  first_new:=greatest(s.first_due_at,coalesce(s.planned_through+interval '1 hour',s.first_due_at),date_trunc('hour',clock)+interval '1 hour');
  last_new:=date_trunc('hour',clock)+interval '8 days';
  -- Missing past slots remain missing in the expected-series denominator. They
  -- are never backfilled as apparently on-time registered samples.
  insert into attention_items(owner_id,context_id,source_revision,kind,due_at,reason,dedupe_key,is_measurement)
    select w.owner_id,w.id,w.revision,'explicit',slot,'Silent attention queue measurement',
      'system:attention-canary:'||extract(epoch from slot)::text,true from generate_series(first_new,last_new,interval '1 hour') slot
    on conflict(dedupe_key) do nothing;
  get diagnostics n=row_count;
  update work_attention_canary_state set planned_through=greatest(coalesce(planned_through,last_new),last_new) where singleton;
  return n;
end $$;

create function public.configure_work_attention_canary(p_enabled boolean) returns void language plpgsql security definer set search_path=public as $$
declare s work_attention_canary_state; owner uuid; context uuid; clock timestamptz:=clock_timestamp(); first_due timestamptz;
begin
  if p_enabled is null then raise exception 'explicit enabled setting required'; end if;
  select * into strict s from work_attention_canary_state where singleton for update;
  if not p_enabled then update work_attention_canary_state set enabled=false where singleton; return; end if;
  select u.id into owner from auth.users u join app_config c on c.key='allowed_email' and c.value=u.email;
  if owner is null then raise exception 'configured owner is not available'; end if;
  if s.context_id is null then
    first_due:=date_trunc('hour',clock)+interval '1 hour';
    insert into work_contexts(owner_id,goal,progress,next_step,status,reminder_at,deadline_reminder,resume_reminder,is_measurement)
      values(owner,'System attention timing canary','','','active',first_due,false,false,true) returning id into context;
    update work_attention_canary_state set enabled=true,context_id=context,measurement_started_at=clock,first_due_at=first_due where singleton;
  else
    if not exists(select 1 from work_contexts where id=s.context_id and owner_id=owner and is_measurement and forgotten_at is null) then raise exception 'system context owner changed; explicit recovery required'; end if;
    -- Keep the original start and expected cadence across pauses. Re-enabling
    -- does not erase an outage or turn missed historical slots into successes.
    update work_attention_canary_state set enabled=true where singleton;
  end if;
  perform seed_work_attention_canary();
end $$;

-- The same user attention claim path, with user work taking precedence. A
-- transaction-local slot can be set only by the service scheduler wrapper.
create or replace function public.claim_work_attention(p_worker_id text,p_allow_automatic boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare candidate attention_items; a attention_items; w work_contexts; clock timestamptz; jst_day date; hour integer; used integer;
  canary_slot timestamptz:=nullif(current_setting('personalos.canary_slot',true),'')::timestamptz;
begin
  if p_worker_id is null or length(trim(p_worker_id)) not between 1 and 200 then raise exception 'worker required'; end if;
  if canary_slot is not null and not exists(select 1 from work_scheduler_probes where slot=canary_slot and request_id is not null and worker_started_at is not null and worker_finished_at is null) then raise exception 'unknown active scheduler slot'; end if;
  for candidate in select * from attention_items where status in ('pending','processing','failed') and due_at<=clock_timestamp()
    and (kind='explicit' or p_allow_automatic is true)
    and (not is_measurement or (canary_slot is not null and exists(select 1 from work_attention_canary_state where singleton and enabled)))
    and next_attempt_at<=clock_timestamp() and (locked_until is null or locked_until<=clock_timestamp()) and claim_count<5
    order by is_measurement,due_at,id limit 30 loop
    select * into w from work_contexts where id=candidate.context_id for update skip locked;
    if not found then continue; end if;
    select * into a from attention_items where id=candidate.id for update skip locked;
    if not found or a.status not in ('pending','processing','failed') or a.due_at>clock_timestamp() or a.next_attempt_at>clock_timestamp()
      or (a.locked_until is not null and a.locked_until>clock_timestamp()) then continue; end if;
    if not coalesce(work_attention_valid(w,a),false) then
      update attention_items set status='cancelled',locked_by=null,locked_until=null,updated_at=now() where id=a.id; continue;
    end if;
    if not exists(select 1 from auth.users u join app_config c on c.key='allowed_email' and c.value=u.email where u.id=w.owner_id) then continue; end if;
    perform pg_advisory_xact_lock(hashtextextended(w.owner_id::text||':work-attention',0));
    clock:=clock_timestamp(); jst_day:=(clock at time zone 'Asia/Tokyo')::date; hour:=extract(hour from clock at time zone 'Asia/Tokyo');
    if not coalesce(work_attention_valid(w,a),false) then
      update attention_items set status='cancelled',locked_by=null,locked_until=null,updated_at=clock where id=a.id; continue;
    end if;
    if a.kind<>'explicit' then
      if hour>=22 or hour<8 then continue; end if;
      select count(*) into used from attention_items where owner_id=w.owner_id and not is_measurement and kind<>'explicit' and (quota_reserved_at at time zone 'Asia/Tokyo')::date=jst_day;
      if (a.quota_reserved_at is null or (a.quota_reserved_at at time zone 'Asia/Tokyo')::date<>jst_day) and used>=3 then continue; end if;
    end if;
    update attention_items set status='processing',locked_by=p_worker_id,locked_until=clock+interval '90 seconds',claim_count=claim_count+1,
      quota_reserved_at=case when kind='explicit' then null when (quota_reserved_at at time zone 'Asia/Tokyo')::date=jst_day then quota_reserved_at else clock end,
      measurement_slot=case when is_measurement then coalesce(measurement_slot,canary_slot) else null end,updated_at=clock where id=a.id returning * into a;
    return jsonb_build_object('id',a.id,'contextId',a.context_id,'ownerId',a.owner_id,'kind',a.kind,'dueAt',a.due_at,'status',a.status,
      'reason',a.reason,'acknowledgedAt',a.acknowledged_at,'lockedUntil',a.locked_until,'isMeasurement',a.is_measurement);
  end loop;
  return null;
end $$;

create function public.claim_measured_work_attention(p_worker_id text,p_slot timestamptz,p_allow_automatic boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if p_slot is null or p_slot>clock_timestamp() or p_slot<clock_timestamp()-interval '5 minutes'
    or not exists(select 1 from work_scheduler_state where singleton and enabled)
    or not exists(select 1 from work_scheduler_probes where slot=p_slot and request_id is not null
    and worker_started_at is not null and worker_finished_at is null) then raise exception 'active dispatched scheduler slot required'; end if;
  perform set_config('personalos.canary_slot',p_slot::text,true);
  result:=claim_work_attention(p_worker_id,p_allow_automatic);
  perform set_config('personalos.canary_slot','',true);
  return result;
end $$;

create or replace function public.work_scheduler_health() returns jsonb language sql stable security definer set search_path=public as $$
 with bounds as (select greatest(date_trunc('minute',measurement_started_at)+interval '1 minute',date_trunc('minute',now())-interval '7 days 4 minutes') as start,
   date_trunc('minute',now())-interval '5 minutes' as finish from work_scheduler_state where singleton and measurement_started_at is not null),
 expected as (select generate_series(start,finish,interval '1 minute') slot from bounds),
 counts as (select count(*) total,count(*) filter(where p.worker_started_at between e.slot and e.slot+interval '5 minutes') timely from expected e left join work_scheduler_probes p using(slot)),
 user_attention as (select count(*) total,count(*) filter(where a.first_claimed_at between a.due_at and a.due_at+interval '5 minutes') timely,
   count(distinct (a.due_at at time zone 'Asia/Tokyo')::date) sample_days from attention_items a cross join bounds b
   where not a.is_measurement and a.due_at>=b.start and a.due_at<=b.finish),
 expected_canary as (select generate_series(greatest(c.first_due_at,date_trunc('hour',now()-interval '7 days 5 minutes')+interval '1 hour'),
   date_trunc('hour',now()-interval '5 minutes'),interval '1 hour') slot from work_attention_canary_state c where c.singleton and c.first_due_at is not null),
 canary as (select count(*) expected,count(a.id) registered,
   count(a.id) filter(where a.first_claimed_at is not null and p.request_id is not null and p.worker_started_at is not null) observed,
   count(a.id) filter(where a.created_at<=a.due_at and a.first_claimed_at between e.slot and e.slot+interval '5 minutes'
      and p.request_id is not null and p.worker_started_at is not null) timely,
   count(a.id) filter(where a.measurement_finished_at is not null and a.status='ready') completed
   from expected_canary e left join attention_items a on a.is_measurement and a.due_at=e.slot
   left join work_scheduler_probes p on p.slot=a.measurement_slot)
 select jsonb_build_object('enabled',s.enabled,'measurementStartedAt',s.measurement_started_at,'expectedSlots',c.total,'timelyStarts',c.timely,
 'sevenDaysObserved',s.measurement_started_at is not null and now()>=s.measurement_started_at+interval '7 days 5 minutes',
 'timelyRatio',case when c.total>0 then c.timely::numeric/c.total else null end,
 'attentionSamples',u.total,'attentionTimelyStarts',u.timely,'attentionSampleDays',u.sample_days,
 'attentionTimelyRatio',case when u.total>0 then u.timely::numeric/u.total else null end,
 'canary',jsonb_build_object('enabled',cs.enabled,'measurementStartedAt',cs.measurement_started_at,'firstDueAt',cs.first_due_at,
   'sevenDaysObserved',cs.measurement_started_at is not null and now()>=cs.measurement_started_at+interval '7 days 5 minutes',
   'expectedSamples',m.expected,'registeredSamples',m.registered,'actualClaimedSamples',m.observed,'timelyStarts',m.timely,
   'completedSamples',m.completed,'missingSamples',m.expected-m.registered,'unclaimedSamples',m.expected-m.observed,
   'timelyRatio',case when m.expected>0 then m.timely::numeric/m.expected else null end,'pushDeliveryAllowed',false),
 'automaticPromotionReady',s.enabled and cs.enabled and s.measurement_started_at is not null and cs.measurement_started_at is not null
   and now()>=s.measurement_started_at+interval '7 days 5 minutes' and now()>=cs.measurement_started_at+interval '7 days 5 minutes'
   and c.total>=10080 and c.timely::numeric/greatest(c.total,1)>=0.99
   and m.expected>=168 and m.registered>=168 and m.observed>=168 and m.timely::numeric/greatest(m.expected,1)>=0.99
   and m.completed::numeric/greatest(m.expected,1)>=0.99 and (u.total=0 or u.timely::numeric/greatest(u.total,1)>=0.99),
 'lastStartedAt',(select max(worker_started_at) from work_scheduler_probes),
 'scope','Actual rolling seven-day scheduler starts plus at least 168 pre-registered hourly silent attention claims. Missing slots and unclaimed rows remain failures. Real user attention is reported separately and retains its timing guard. Synthetic fixture timestamps are not seven-day operational evidence; provider/device receipt is outside this measurement.')
 from work_scheduler_state s cross join work_attention_canary_state cs cross join counts c cross join user_attention u cross join canary m where s.singleton and cs.singleton
$$;

revoke all on function public.guard_work_canary_context(),public.guard_work_canary_attention(),public.guard_work_canary_delivery(),public.guard_work_canary_action() from public,anon,authenticated;
revoke all on function public.seed_work_attention_canary(),public.configure_work_attention_canary(boolean),public.claim_measured_work_attention(text,timestamptz,boolean) from public,anon,authenticated;
revoke all on function public.begin_work_delivery(uuid,text,uuid),public.get_claimed_work_subscriptions(uuid) from public,anon,authenticated;
grant execute on function public.seed_work_attention_canary(),public.configure_work_attention_canary(boolean),public.claim_measured_work_attention(text,timestamptz,boolean) to service_role;
grant execute on function public.begin_work_delivery(uuid,text,uuid),public.get_claimed_work_subscriptions(uuid) to service_role;
