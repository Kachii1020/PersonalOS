-- Phase 5A — JARVIS Core
--
-- 0014 is reserved by the open Learn workbook PR. Do not apply this migration
-- to hosted Supabase until the 0014 merge/renumber decision is settled.

-- ============ Capture inbox ============
create table inbox_items (
  id                    uuid primary key default gen_random_uuid(),
  kind                  text not null default 'text',
  raw_text              text,
  source_url            text,
  attachment_path       text,
  status                text not null default 'unprocessed',
  summary               text,
  classification_reason text,
  created_at            timestamptz not null default now(),
  processed_at          timestamptz,
  check (kind in ('text', 'url', 'note', 'file', 'image', 'command')),
  check (status in ('unprocessed', 'act_now', 'learn', 'monitor', 'archive', 'failed')),
  check (raw_text is null or char_length(raw_text) <= 5000),
  check (source_url is null or (char_length(source_url) <= 2048 and source_url ~ '^https?://')),
  check (raw_text is not null or source_url is not null or attachment_path is not null)
);
create index inbox_items_created_idx on inbox_items (created_at desc);
create index inbox_items_status_idx on inbox_items (status, created_at desc);

-- ============ Internal event queue ============
create table system_events (
  id            uuid primary key default gen_random_uuid(),
  event_type    text not null,
  source_type   text not null,
  source_id     text,
  payload       jsonb not null default '{}'::jsonb,
  dedupe_key    text not null unique,
  status        text not null default 'pending',
  available_at  timestamptz not null default now(),
  attempts      integer not null default 0,
  locked_by     text,
  locked_until  timestamptz,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz,
  error         text,
  check (status in ('pending', 'processing', 'processed', 'failed')),
  check (attempts >= 0)
);
create index system_events_runnable_idx
  on system_events (available_at, created_at)
  where status in ('pending', 'processing');

-- ============ Durable agent runs ============
create table agent_runs (
  id                uuid primary key default gen_random_uuid(),
  run_type          text not null,
  trigger_event_id  uuid not null unique references system_events(id) on delete restrict,
  status            text not null default 'queued',
  current_step      text not null default 'classify',
  state             jsonb not null default '{}'::jsonb,
  output            jsonb,
  attempts          integer not null default 0,
  locked_by         text,
  locked_until      timestamptz,
  started_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  finished_at       timestamptz,
  error             text,
  check (status in (
    'queued', 'collecting', 'verifying', 'planning',
    'waiting_approval', 'executing', 'completed', 'failed'
  )),
  check (attempts >= 0)
);
create index agent_runs_runnable_idx
  on agent_runs (updated_at)
  where status in ('queued', 'collecting', 'verifying', 'planning', 'executing');

-- ============ Human approval gateway ============
create table approval_requests (
  id                uuid primary key default gen_random_uuid(),
  agent_run_id      uuid references agent_runs(id) on delete set null,
  action_type       text not null,
  title             text not null,
  explanation       text not null,
  payload           jsonb not null,
  risk_level        text not null default 'low',
  status            text not null default 'pending',
  idempotency_key   text not null unique,
  requested_at      timestamptz not null default now(),
  expires_at        timestamptz,
  decided_at        timestamptz,
  decision_note     text,
  locked_by         text,
  locked_until      timestamptz,
  executed_at       timestamptz,
  result            jsonb,
  error             text,
  check (risk_level in ('low', 'medium', 'high', 'critical')),
  check (status in (
    'pending', 'approved', 'rejected', 'expired',
    'executing', 'executed', 'failed'
  ))
);
create index approval_requests_pending_idx
  on approval_requests (requested_at)
  where status in ('pending', 'approved', 'executing');

create table action_audit_logs (
  id                  bigserial primary key,
  approval_request_id uuid references approval_requests(id) on delete set null,
  event               text not null,
  actor               text not null,
  detail              jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  check (event in ('requested', 'approved', 'rejected', 'executing', 'executed', 'verified', 'failed')),
  check (actor in ('jarvis', 'user', 'worker', 'system'))
);
create index action_audit_logs_request_idx
  on action_audit_logs (approval_request_id, created_at);

create or replace function public.audit_approval_requested()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into action_audit_logs (approval_request_id, event, actor, detail)
  values (
    new.id,
    'requested',
    'jarvis',
    jsonb_build_object('action_type', new.action_type, 'risk_level', new.risk_level)
  );
  return new;
end;
$$;

create trigger approval_requests_audit_insert
  after insert on approval_requests
  for each row execute function public.audit_approval_requested();

-- ============ Daily command brief ============
create table command_briefs (
  id               uuid primary key default gen_random_uuid(),
  brief_date       date not null unique,
  headline         text not null,
  top_actions      jsonb not null default '[]'::jsonb,
  prepared_items   jsonb not null default '[]'::jsonb,
  postponed_items  jsonb not null default '[]'::jsonb,
  warnings         jsonb not null default '[]'::jsonb,
  source_snapshot  jsonb not null default '{}'::jsonb,
  generated_at     timestamptz not null default now()
);

-- ============ Existing task model extension ============
alter table tasks
  add column if not exists priority smallint,
  add column if not exists estimated_minutes integer,
  add column if not exists defer_until timestamptz,
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists generated_by text,
  add column if not exists priority_reason text,
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists approval_request_id uuid references approval_requests(id) on delete set null;

create unique index if not exists tasks_approval_request_unique
  on tasks (approval_request_id)
  where approval_request_id is not null;

create index if not exists tasks_jarvis_priority_idx
  on tasks (priority desc nulls last, due_at)
  where status = 'open';

-- Existing rows may be null. New values are bounded when present.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_priority_range') then
    alter table tasks add constraint tasks_priority_range
      check (priority is null or priority between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_estimated_minutes_range') then
    alter table tasks add constraint tasks_estimated_minutes_range
      check (estimated_minutes is null or estimated_minutes between 1 and 1440);
  end if;
end $$;

-- ============ Inbox → event trigger ============
create or replace function public.enqueue_inbox_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into system_events (
    event_type,
    source_type,
    source_id,
    payload,
    dedupe_key
  ) values (
    'inbox.created',
    'inbox_item',
    new.id::text,
    jsonb_build_object('inbox_item_id', new.id, 'kind', new.kind),
    'inbox.created:' || new.id::text
  ) on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

create trigger inbox_items_enqueue_event
  after insert on inbox_items
  for each row execute function public.enqueue_inbox_event();

-- ============ Atomic claim functions ============
create or replace function public.claim_next_system_event(
  p_worker_id text,
  p_lease_seconds integer default 90
)
returns setof public.system_events
language plpgsql
security definer
set search_path = public
as $$
begin
  update system_events
  set status = 'failed',
      error = coalesce(error, 'retry limit exceeded'),
      locked_by = null,
      locked_until = null
  where status in ('pending', 'processing')
    and attempts >= 5
    and (locked_until is null or locked_until < now());

  return query
  with candidate as (
    select id
    from system_events
    where available_at <= now()
      and attempts < 5
      and (
        status = 'pending'
        or (status = 'processing' and locked_until < now())
      )
    order by created_at
    for update skip locked
    limit 1
  )
  update system_events e
  set status = 'processing',
      locked_by = p_worker_id,
      locked_until = now() + make_interval(secs => greatest(p_lease_seconds, 15)),
      attempts = e.attempts + 1,
      error = null
  from candidate c
  where e.id = c.id
  returning e.*;
end;
$$;

create or replace function public.claim_next_agent_run(
  p_worker_id text,
  p_lease_seconds integer default 90
)
returns setof public.agent_runs
language plpgsql
security definer
set search_path = public
as $$
begin
  update agent_runs
  set status = 'failed',
      error = coalesce(error, 'retry limit exceeded'),
      finished_at = now(),
      updated_at = now(),
      locked_by = null,
      locked_until = null
  where status in ('queued', 'collecting', 'verifying', 'planning', 'executing')
    and attempts >= 10
    and (locked_until is null or locked_until < now());

  return query
  with candidate as (
    select id
    from agent_runs
    where status in ('queued', 'collecting', 'verifying', 'planning', 'executing')
      and (locked_until is null or locked_until < now())
      and attempts < 10
    order by updated_at, started_at
    for update skip locked
    limit 1
  )
  update agent_runs r
  set locked_by = p_worker_id,
      locked_until = now() + make_interval(secs => greatest(p_lease_seconds, 15)),
      attempts = r.attempts + 1,
      updated_at = now(),
      error = null
  from candidate c
  where r.id = c.id
  returning r.*;
end;
$$;

create or replace function public.claim_next_approved_action(
  p_worker_id text,
  p_lease_seconds integer default 90
)
returns setof public.approval_requests
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select id
    from approval_requests
    where (
        status = 'approved'
        or (status = 'executing' and locked_until < now())
      )
      and (expires_at is null or expires_at > now())
      and (locked_until is null or locked_until < now())
    order by requested_at
    for update skip locked
    limit 1
  )
  update approval_requests a
  set status = 'executing',
      locked_by = p_worker_id,
      locked_until = now() + make_interval(secs => greatest(p_lease_seconds, 15)),
      error = null
  from candidate c
  where a.id = c.id
  returning a.*;
end;
$$;

create or replace function public.claim_approved_action_by_id(
  p_approval_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 90
)
returns setof public.approval_requests
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update approval_requests a
  set status = 'executing',
      locked_by = p_worker_id,
      locked_until = now() + make_interval(secs => greatest(p_lease_seconds, 15)),
      error = null
  where a.id = p_approval_id
    and (
      a.status = 'approved'
      or (a.status = 'executing' and a.locked_until < now())
    )
    and (a.expires_at is null or a.expires_at > now())
    and (a.locked_until is null or a.locked_until < now())
  returning a.*;
end;
$$;

-- User decision. Payload and action type remain immutable.
create or replace function public.decide_approval(
  p_approval_id uuid,
  p_decision text,
  p_note text default null
)
returns setof public.approval_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row approval_requests%rowtype;
begin
  if not public.is_allowed_user() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'decision note is too long' using errcode = '22001';
  end if;

  update approval_requests
  set status = p_decision,
      decided_at = now(),
      decision_note = nullif(trim(p_note), ''),
      locked_by = null,
      locked_until = null
  where id = p_approval_id
    and status = 'pending'
    and (expires_at is null or expires_at > now())
  returning * into v_row;

  if v_row.id is null then
    raise exception 'approval is not pending or has expired' using errcode = 'P0002';
  end if;

  insert into action_audit_logs (approval_request_id, event, actor, detail)
  values (v_row.id, p_decision, 'user', jsonb_build_object('note', p_note));

  if p_decision = 'rejected' and v_row.agent_run_id is not null then
    update agent_runs
    set status = 'completed',
        current_step = 'approval_rejected',
        output = jsonb_build_object('approval_id', v_row.id, 'decision', 'rejected'),
        finished_at = now(),
        updated_at = now(),
        locked_by = null,
        locked_until = null
    where id = v_row.agent_run_id;
  end if;

  return next v_row;
end;
$$;

create or replace function public.complete_approval_execution(
  p_approval_id uuid,
  p_worker_id text,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
begin
  update approval_requests
  set status = 'executed',
      result = coalesce(p_result, '{}'::jsonb),
      executed_at = now(),
      locked_by = null,
      locked_until = null,
      error = null
  where id = p_approval_id
    and status = 'executing'
    and locked_by = p_worker_id
  returning agent_run_id into v_run_id;

  if not found then
    raise exception 'approval is not executing' using errcode = 'P0002';
  end if;

  insert into action_audit_logs (approval_request_id, event, actor, detail)
  values (p_approval_id, 'executed', 'worker', coalesce(p_result, '{}'::jsonb));

  insert into action_audit_logs (approval_request_id, event, actor, detail)
  values (p_approval_id, 'verified', 'worker', coalesce(p_result, '{}'::jsonb));

  if v_run_id is not null then
    update agent_runs
    set status = 'completed',
        current_step = 'verified',
        output = jsonb_build_object('approval_id', p_approval_id, 'result', p_result),
        finished_at = now(),
        updated_at = now(),
        locked_by = null,
        locked_until = null,
        error = null
    where id = v_run_id;
  end if;
end;
$$;

create or replace function public.fail_approval_execution(
  p_approval_id uuid,
  p_worker_id text,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
begin
  update approval_requests
  set status = 'failed',
      error = p_error,
      locked_by = null,
      locked_until = null
  where id = p_approval_id
    and status = 'executing'
    and locked_by = p_worker_id
  returning agent_run_id into v_run_id;

  if not found then
    return;
  end if;

  insert into action_audit_logs (approval_request_id, event, actor, detail)
  values (p_approval_id, 'failed', 'worker', jsonb_build_object('error', p_error));

  if v_run_id is not null then
    update agent_runs
    set status = 'failed',
        error = p_error,
        finished_at = now(),
        updated_at = now(),
        locked_by = null,
        locked_until = null
    where id = v_run_id;
  end if;
end;
$$;

-- ============ Grants and RLS ============
grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter table inbox_items enable row level security;
alter table system_events enable row level security;
alter table agent_runs enable row level security;
alter table approval_requests enable row level security;
alter table action_audit_logs enable row level security;
alter table command_briefs enable row level security;

create policy allowed_user_select on inbox_items
  for select to authenticated
  using (public.is_allowed_user());
create policy allowed_user_insert on inbox_items
  for insert to authenticated
  with check (public.is_allowed_user());

create policy allowed_user_select on system_events
  for select to authenticated
  using (public.is_allowed_user());
create policy allowed_user_select on agent_runs
  for select to authenticated
  using (public.is_allowed_user());
create policy allowed_user_select on approval_requests
  for select to authenticated
  using (public.is_allowed_user());
create policy allowed_user_select on action_audit_logs
  for select to authenticated
  using (public.is_allowed_user());
create policy allowed_user_select on command_briefs
  for select to authenticated
  using (public.is_allowed_user());

revoke all on system_events, agent_runs, approval_requests, action_audit_logs, command_briefs from authenticated;
grant select on system_events, agent_runs, approval_requests, action_audit_logs, command_briefs to authenticated;
grant select, insert on inbox_items to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on function public.enqueue_inbox_event() from public, authenticated;
revoke all on function public.audit_approval_requested() from public, authenticated;
revoke all on function public.claim_next_system_event(text, integer) from public, authenticated;
revoke all on function public.claim_next_agent_run(text, integer) from public, authenticated;
revoke all on function public.claim_next_approved_action(text, integer) from public, authenticated;
revoke all on function public.claim_approved_action_by_id(uuid, text, integer) from public, authenticated;
revoke all on function public.complete_approval_execution(uuid, text, jsonb) from public, authenticated;
revoke all on function public.fail_approval_execution(uuid, text, text) from public, authenticated;
revoke all on function public.decide_approval(uuid, text, text) from public, authenticated;

grant execute on function public.claim_next_system_event(text, integer) to service_role;
grant execute on function public.claim_next_agent_run(text, integer) to service_role;
grant execute on function public.claim_next_approved_action(text, integer) to service_role;
grant execute on function public.claim_approved_action_by_id(uuid, text, integer) to service_role;
grant execute on function public.complete_approval_execution(uuid, text, jsonb) to service_role;
grant execute on function public.fail_approval_execution(uuid, text, text) to service_role;
grant execute on function public.decide_approval(uuid, text, text) to authenticated;
