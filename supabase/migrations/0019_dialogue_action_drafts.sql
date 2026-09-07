-- Phase 6A: server-validated proposals, never raw conversation history.
create table public.dialogue_action_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  action_type text not null check (action_type in ('CREATE_TASK','CREATE_CALENDAR_EVENT','UPDATE_CALENDAR_EVENT')),
  title text not null check (length(title) between 1 and 300),
  explanation text not null check (length(explanation) <= 4000),
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=16000),
  source_snapshot jsonb not null default '{}' check (octet_length(source_snapshot::text)<=16000),
  executable boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '15 minutes',
  approval_request_id uuid unique references public.approval_requests(id),
  check (expires_at>created_at and expires_at<=created_at+interval '15 minutes')
);
alter table public.dialogue_action_drafts enable row level security;
revoke all on public.dialogue_action_drafts from public, anon, authenticated;
grant select on public.dialogue_action_drafts to authenticated;
grant all on public.dialogue_action_drafts to service_role;
create policy dialogue_draft_owner on public.dialogue_action_drafts for select to authenticated
  using (public.is_allowed_user() and owner_id=auth.uid());

create function public.request_dialogue_approval(p_draft_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare d dialogue_action_drafts; c calendars; e events; event_id uuid; run_id uuid; approval_id uuid;
begin
  if not public.is_allowed_user() then raise exception 'not allowed' using errcode='42501'; end if;
  select * into d from dialogue_action_drafts where id=p_draft_id and owner_id=auth.uid() for update;
  if not found then raise exception 'draft not found' using errcode='42501'; end if;
  if d.approval_request_id is not null then return d.approval_request_id; end if;
  if not d.executable then raise exception 'executor not enabled'; end if;
  if d.expires_at<=clock_timestamp() then raise exception 'draft expired; regenerate'; end if;
  if d.action_type in ('CREATE_CALENDAR_EVENT','UPDATE_CALENDAR_EVENT') then
    select * into c from calendars where id=(d.payload->>'calendarId')::uuid for share;
    if not found or c.kind<>'caldav' or not c.is_writable
      or encode(sha256(convert_to(c.source_url,'UTF8')),'hex') is distinct from d.source_snapshot->>'calendarUrlHash'
      then raise exception 'calendar changed; regenerate'; end if;
    if d.action_type='UPDATE_CALENDAR_EVENT' then
      select * into e from events where id=(d.payload->>'eventId')::uuid for share;
      if not found or e.calendar_id<>c.id or e.source<>'app' or e.rrule is not null or e.is_all_day
        or e.caldav_uid is distinct from d.payload->>'expectedUid'
        or e.etag is distinct from d.payload->>'expectedEtag'
        or e.updated_at is distinct from (d.source_snapshot->>'eventUpdatedAt')::timestamptz
        then raise exception 'event changed; regenerate'; end if;
    end if;
  end if;
  if d.expires_at<=clock_timestamp() then raise exception 'draft expired while waiting; regenerate'; end if;
  -- Owner requests a pending approval; this is not approval or execution.
  insert into system_events(event_type,source_type,source_id,dedupe_key,status,processed_at)
    values ('dialogue.proposed','dialogue_draft',d.id::text,'dialogue:draft:'||d.id::text,'processed',now()) returning id into event_id;
  insert into agent_runs(run_type,trigger_event_id,status,current_step,state)
    values ('dialogue.proposed',event_id,'waiting_approval','wait_approval',jsonb_build_object('draftId',d.id)) returning id into run_id;
  insert into approval_requests(agent_run_id,action_type,title,explanation,payload,risk_level,idempotency_key,expires_at)
    values (run_id,d.action_type,d.title,d.explanation,d.payload,'low','dialogue:draft:'||d.id::text,d.expires_at) returning id into approval_id;
  update agent_runs set output=jsonb_build_object('approvalId',approval_id) where id=run_id;
  update dialogue_action_drafts set approval_request_id=approval_id where id=d.id;
  return approval_id;
end $$;
revoke all on function public.request_dialogue_approval(uuid) from public, anon, service_role;
grant execute on function public.request_dialogue_approval(uuid) to authenticated;

-- Only never-submitted expired proposal payloads are purged. Approved/audited
-- actions retain the existing audit lifecycle; no raw chat is stored here.
create function public.prune_dialogue_drafts()
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  delete from dialogue_action_drafts where approval_request_id is null and expires_at<now()-interval '24 hours';
  get diagnostics n=row_count;
  return n;
end $$;
revoke all on function public.prune_dialogue_drafts() from public, anon, authenticated;
grant execute on function public.prune_dialogue_drafts() to service_role;
