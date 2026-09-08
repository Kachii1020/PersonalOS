-- Scheduling is installed but OFF until explicitly configured and measured.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
-- Preserve the first actual queue claim separately from scheduler HTTP delivery.
alter table public.attention_items add column first_claimed_at timestamptz;
create function public.mark_work_attention_claim() returns trigger language plpgsql set search_path=public as $$
begin
 if new.due_at is distinct from old.due_at then new.first_claimed_at:=null; end if;
 if new.status='processing' and old.first_claimed_at is null then new.first_claimed_at:=clock_timestamp(); end if;
 return new;
end $$;
create trigger mark_work_attention_claim before update of status,due_at on public.attention_items for each row execute function public.mark_work_attention_claim();
revoke all on function public.mark_work_attention_claim() from public,anon,authenticated;
create table public.work_scheduler_state (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 worker_url text, vault_secret_name text, measurement_started_at timestamptz
);
insert into public.work_scheduler_state(singleton) values(true);
create table public.work_scheduler_probes (
 slot timestamptz primary key, dispatched_at timestamptz not null default clock_timestamp(), request_id bigint,
 worker_started_at timestamptz, worker_finished_at timestamptz
);
alter table public.work_scheduler_state enable row level security;
alter table public.work_scheduler_probes enable row level security;
revoke all on public.work_scheduler_state,public.work_scheduler_probes from public,anon,authenticated;
grant all on public.work_scheduler_state,public.work_scheduler_probes to service_role;

create function public.dispatch_work_tick() returns void language plpgsql security definer set search_path=public,extensions as $$
declare s work_scheduler_state; secret text; tick timestamptz:=date_trunc('minute',clock_timestamp()); v_request_id bigint;
begin
 select * into strict s from work_scheduler_state where singleton;
 if not s.enabled then return; end if;
 insert into work_scheduler_probes(slot) values(tick) on conflict do nothing;
 if not found then return; end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name=s.vault_secret_name;
 if secret is null then raise exception 'scheduler secret missing'; end if;
 select net.http_post(url:=s.worker_url,body:=jsonb_build_object('slot',tick),headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',secret),timeout_milliseconds:=120000) into v_request_id;
 update work_scheduler_probes set request_id=v_request_id where slot=tick;
end $$;
create function public.configure_work_scheduler(p_enabled boolean,p_url text,p_secret_name text)
returns void language plpgsql security definer set search_path=public,extensions as $$
begin
 if p_enabled and p_url not in ('https://personal-os-nine-rust.vercel.app/api/jobs/work-tick','http://host.docker.internal:3055/api/jobs/work-tick') then raise exception 'unapproved worker URL'; end if;
 if p_enabled and not exists(select 1 from vault.decrypted_secrets where name=p_secret_name) then raise exception 'named Vault secret required'; end if;
 perform cron.unschedule(jobid) from cron.job where jobname='personalos-work-tick';
 update work_scheduler_state set enabled=p_enabled,worker_url=case when p_enabled then p_url else worker_url end,
 vault_secret_name=case when p_enabled then p_secret_name else vault_secret_name end,
 measurement_started_at=case when p_enabled and not enabled then clock_timestamp() else measurement_started_at end where singleton;
 if p_enabled then perform cron.schedule('personalos-work-tick','* * * * *','select public.dispatch_work_tick()'); end if;
end $$;
create function public.ack_work_tick(p_slot timestamptz,p_finished boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_slot>clock_timestamp()+interval '1 minute' then raise exception 'future slot'; end if;
 update work_scheduler_probes set worker_started_at=coalesce(worker_started_at,clock_timestamp()),
 worker_finished_at=case when p_finished then coalesce(worker_finished_at,clock_timestamp()) else worker_finished_at end where slot=p_slot;
 if not found then raise exception 'unknown dispatched slot'; end if;
end $$;
create function public.work_scheduler_health() returns jsonb language sql stable security definer set search_path=public as $$
 with bounds as (select greatest(date_trunc('minute',measurement_started_at)+interval '1 minute',date_trunc('minute',now())-interval '7 days 4 minutes') as start,
   date_trunc('minute',now())-interval '5 minutes' as finish from work_scheduler_state where singleton and measurement_started_at is not null),
 expected as (select generate_series(start,finish,interval '1 minute') slot from bounds),
 counts as (select count(*) total,count(*) filter(where p.worker_started_at between e.slot and e.slot+interval '5 minutes') timely from expected e left join work_scheduler_probes p using(slot)),
 attention as (select count(*) total,count(*) filter(where a.first_claimed_at between a.due_at and a.due_at+interval '5 minutes') timely,
   count(distinct (a.due_at at time zone 'Asia/Tokyo')::date) sample_days
   from attention_items a cross join bounds b where a.due_at>=b.start and a.due_at<=b.finish)
 select jsonb_build_object('enabled',s.enabled,'measurementStartedAt',s.measurement_started_at,'expectedSlots',c.total,'timelyStarts',c.timely,
 'sevenDaysObserved',s.measurement_started_at is not null and now()>=s.measurement_started_at+interval '7 days 5 minutes',
 'timelyRatio',case when c.total>0 then c.timely::numeric/c.total else null end,
 'attentionSamples',a.total,'attentionTimelyStarts',a.timely,'attentionSampleDays',a.sample_days,
 'attentionTimelyRatio',case when a.total>0 then a.timely::numeric/a.total else null end,
 'automaticPromotionReady',s.enabled and s.measurement_started_at is not null and now()>=s.measurement_started_at+interval '7 days 5 minutes'
   and c.total>=10080 and c.timely::numeric/greatest(c.total,1)>=0.99
   and a.total>=100 and a.sample_days>=7 and a.timely::numeric/greatest(a.total,1)>=0.99,
 'lastStartedAt',(select max(worker_started_at) from work_scheduler_probes),
 'scope','Rolling seven days: missing scheduler slots and all registered due attention items, including unclaimed/cancelled failures; minimum 100 due samples across 7 JST dates. Provider/device display is separate.')
 from work_scheduler_state s cross join counts c cross join attention a where s.singleton
$$;
revoke all on function public.dispatch_work_tick(),public.configure_work_scheduler(boolean,text,text),public.ack_work_tick(timestamptz,boolean),public.work_scheduler_health() from public,anon,authenticated;
grant execute on function public.dispatch_work_tick(),public.configure_work_scheduler(boolean,text,text),public.ack_work_tick(timestamptz,boolean),public.work_scheduler_health() to service_role;
