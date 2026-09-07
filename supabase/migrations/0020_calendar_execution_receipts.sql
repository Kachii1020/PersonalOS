-- Phase 6B: one conditional write allowance per approved immutable request.
-- Remote I/O is outside this transaction. A consumed allowance is never reset.
create table public.calendar_execution_receipts (
  approval_id uuid primary key references public.approval_requests(id),
  draft_id uuid not null unique references public.dialogue_action_drafts(id),
  owner_id uuid not null references auth.users(id),
  action_type text not null check (action_type in ('CREATE_CALENDAR_EVENT','UPDATE_CALENDAR_EVENT')),
  payload jsonb not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  calendar_id uuid not null references public.calendars(id),
  calendar_source_url text not null,
  uid text not null,
  href text not null,
  state text not null default 'prepared' check (state in ('prepared','attempted','uncertain','conflict','verified')),
  write_attempts integer not null default 0 check (write_attempts between 0 and 1),
  attempted_at timestamptz,
  locked_by text,
  locked_until timestamptz,
  claim_token uuid,
  claim_mode text check (claim_mode in ('execute','reconcile')),
  mirror_event_id uuid,
  remote_etag text,
  verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((write_attempts=0 and attempted_at is null) or (write_attempts=1 and attempted_at is not null)),
  check (state<>'verified' or (verified_at is not null and mirror_event_id is not null and remote_etag is not null))
);
alter table public.calendar_execution_receipts enable row level security;
revoke all on public.calendar_execution_receipts from public, anon, authenticated;
grant select on public.calendar_execution_receipts to authenticated;
grant all on public.calendar_execution_receipts to service_role;
create policy calendar_receipt_owner on public.calendar_execution_receipts for select to authenticated
  using (public.is_allowed_user() and owner_id=auth.uid());

-- Internal invariant check; neither authenticated nor service callers invoke it
-- directly. Public worker RPCs take the approval lock before the receipt lock.
create function public.check_calendar_receipt(r public.calendar_execution_receipts, p_before_write boolean)
returns void language plpgsql security definer set search_path=public as $$
declare a approval_requests; d dialogue_action_drafts; c calendars; e events;
begin
  select * into strict a from approval_requests where id=r.approval_id;
  select * into d from dialogue_action_drafts where id=r.draft_id for share;
  if not found or d.approval_request_id is distinct from a.id or not d.executable
    or d.owner_id is distinct from r.owner_id or d.action_type is distinct from a.action_type
    or a.action_type is distinct from r.action_type or a.payload is distinct from d.payload
    or a.payload is distinct from r.payload or d.source_snapshot->'requiresRemoteSnapshot'='true'::jsonb
    or encode(sha256(convert_to(a.payload::text,'UTF8')),'hex') is distinct from r.payload_hash
    or a.decided_at is null
    or not exists(select 1 from action_audit_logs where approval_request_id=a.id and event='approved' and actor='user')
    or a.status in ('pending','rejected','approved') then
    raise exception 'calendar approval provenance changed' using errcode='42501';
  end if;
  if r.payload->'version' is distinct from '1'::jsonb or r.payload->>'timezone' is distinct from 'Asia/Tokyo'
    or jsonb_typeof(r.payload->'summary') is distinct from 'string' or length(trim(r.payload->>'summary')) not between 1 and 300
    or r.payload->>'startsAt' is null or r.payload->>'endsAt' is null
    or r.payload->>'startsAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([.]0+)?(Z|[+-]\d{2}:\d{2})$'
    or r.payload->>'endsAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([.]0+)?(Z|[+-]\d{2}:\d{2})$'
    or not isfinite((r.payload->>'startsAt')::timestamptz) or not isfinite((r.payload->>'endsAt')::timestamptz)
    or date_trunc('second',(r.payload->>'startsAt')::timestamptz)<>(r.payload->>'startsAt')::timestamptz
    or date_trunc('second',(r.payload->>'endsAt')::timestamptz)<>(r.payload->>'endsAt')::timestamptz
    or (r.payload->>'endsAt')::timestamptz<=(r.payload->>'startsAt')::timestamptz
    or (r.payload->>'endsAt')::timestamptz>(r.payload->>'startsAt')::timestamptz+interval '7 days'
    then raise exception 'invalid timed calendar payload'; end if;
  select * into c from calendars where id=r.calendar_id for share;
  if not found or c.kind<>'caldav' or not c.is_writable
    or c.id is distinct from (r.payload->>'calendarId')::uuid
    or c.source_url is distinct from r.calendar_source_url
    or encode(sha256(convert_to(c.source_url,'UTF8')),'hex') is distinct from d.source_snapshot->>'calendarUrlHash'
    or c.source_url !~ '^https://[^/?#@]+/.*[/]$'
    or left(r.href,length(c.source_url))<>c.source_url
    or substring(r.href from length(c.source_url)+1) !~ '^[^/\\?#]+[.]ics$'
    or position('%' in replace(lower(substring(r.href from length(c.source_url)+1)),'%40',''))>0
    then raise exception 'calendar target changed' using errcode='42501'; end if;
  if r.action_type='CREATE_CALENDAR_EVENT' then
    if r.uid is distinct from 'jarvis-'||a.id::text||'@personal-os'
      or r.href is distinct from c.source_url||r.uid||'.ics' then raise exception 'create identity changed'; end if;
  else
    select * into e from events where id=(r.payload->>'eventId')::uuid for share;
    if not found or e.calendar_id<>c.id or e.source<>'app' or e.rrule is not null or e.is_all_day
      or coalesce(cardinality(e.exdates),0)<>0 or e.ends_at<=e.starts_at
      or e.caldav_uid is distinct from r.uid or e.caldav_href is distinct from r.href
      or encode(sha256(convert_to(e.caldav_href,'UTF8')),'hex') is distinct from d.source_snapshot->>'eventHrefHash'
      or r.uid is distinct from r.payload->>'expectedUid'
      or (p_before_write and (e.etag is distinct from r.payload->>'expectedEtag'
        or e.updated_at is distinct from (d.source_snapshot->>'eventUpdatedAt')::timestamptz))
      then raise exception 'update target changed; regenerate approval'; end if;
  end if;
end $$;
revoke all on function public.check_calendar_receipt(public.calendar_execution_receipts,boolean) from public,anon,authenticated,service_role;

create function public.begin_calendar_execution(p_approval_id uuid,p_worker_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a approval_requests; d dialogue_action_drafts; c calendars; e events; r calendar_execution_receipts;
begin
  if p_worker_id is null or length(trim(p_worker_id)) not between 1 and 200 then raise exception 'worker required'; end if;
  select * into strict a from approval_requests where id=p_approval_id for update;
  select * into r from calendar_execution_receipts where approval_id=a.id for update;
  if found and r.state='verified' then
    perform check_calendar_receipt(r,false);
    return to_jsonb(r);
  end if;
  if a.action_type not in ('CREATE_CALENDAR_EVENT','UPDATE_CALENDAR_EVENT') or a.status<>'executing'
    or a.decided_at is null or a.locked_by is distinct from p_worker_id
    or a.locked_until is null or a.locked_until<=clock_timestamp()
    or a.expires_at is null or a.expires_at<=clock_timestamp() then
    raise exception 'calendar approval expired or lease lost' using errcode='P0002';
  end if;
  if r.approval_id is null then
    select * into strict d from dialogue_action_drafts where approval_request_id=a.id for share;
    select * into strict c from calendars where id=(a.payload->>'calendarId')::uuid for share;
    r.approval_id:=a.id; r.draft_id:=d.id; r.owner_id:=d.owner_id;
    r.action_type:=a.action_type; r.payload:=a.payload;
    r.payload_hash:=encode(sha256(convert_to(a.payload::text,'UTF8')),'hex');
    r.calendar_id:=c.id; r.calendar_source_url:=c.source_url;
    if a.action_type='CREATE_CALENDAR_EVENT' then
      r.uid:='jarvis-'||a.id::text||'@personal-os'; r.href:=c.source_url||r.uid||'.ics';
    else
      select * into strict e from events where id=(a.payload->>'eventId')::uuid for share;
      r.uid:=e.caldav_uid; r.href:=e.caldav_href;
    end if;
    perform check_calendar_receipt(r,true);
    insert into calendar_execution_receipts(approval_id,draft_id,owner_id,action_type,payload,payload_hash,calendar_id,calendar_source_url,uid,href)
      values(r.approval_id,r.draft_id,r.owner_id,r.action_type,r.payload,r.payload_hash,r.calendar_id,r.calendar_source_url,r.uid,r.href)
      returning * into r;
  else
    perform check_calendar_receipt(r,false);
    if r.locked_until>clock_timestamp() and r.locked_by is distinct from p_worker_id then raise exception 'receipt lease held'; end if;
    if r.state='conflict' then raise exception 'conflicting receipt requires new approval'; end if;
  end if;
  update calendar_execution_receipts set locked_by=p_worker_id,locked_until=a.locked_until,claim_token=gen_random_uuid(),
    claim_mode=case when write_attempts>0 or state<>'prepared' then 'reconcile' else 'execute' end,updated_at=now()
    where approval_id=a.id returning * into r;
  return to_jsonb(r);
end $$;

-- This transaction is called from the transport's PUT method, after discovery
-- and GET, immediately before its one conditional remote write.
create function public.before_calendar_write(p_approval_id uuid,p_worker_id text,p_claim_token uuid)
returns void language plpgsql security definer set search_path=public as $$
declare a approval_requests; r calendar_execution_receipts;
begin
  select * into strict a from approval_requests where id=p_approval_id for update;
  select * into strict r from calendar_execution_receipts where approval_id=a.id for update;
  if p_claim_token is null or a.status<>'executing' or a.locked_by is distinct from p_worker_id or a.locked_until is null
    or a.locked_until<=clock_timestamp() or a.expires_at is null or a.expires_at<=clock_timestamp()
    or r.locked_by is distinct from p_worker_id or r.claim_token is distinct from p_claim_token
    or r.claim_mode<>'execute' or r.locked_until is null or r.locked_until<=clock_timestamp()
    or r.state<>'prepared' or r.write_attempts<>0 then raise exception 'write capability expired or consumed' using errcode='P0002'; end if;
  perform check_calendar_receipt(r,true);
  -- Validate expiry again after potentially waiting for target row locks.
  if a.locked_until<=clock_timestamp() or a.expires_at<=clock_timestamp() or r.locked_until<=clock_timestamp()
    then raise exception 'write lease expired while validating'; end if;
  update calendar_execution_receipts set state='attempted',write_attempts=1,attempted_at=clock_timestamp(),updated_at=now()
    where approval_id=a.id;
  insert into action_audit_logs(approval_request_id,event,actor,detail)
    values(a.id,'executing','worker',jsonb_build_object('calendarState','attempted','uid',r.uid,'href',r.href,'writeAttempt',1));
end $$;

create function public.finish_calendar_execution(p_approval_id uuid,p_worker_id text,p_claim_token uuid,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a approval_requests; r calendar_execution_receipts; event_proof jsonb; event_id uuid; result jsonb;
begin
  select * into strict a from approval_requests where id=p_approval_id for update;
  select * into strict r from calendar_execution_receipts where approval_id=a.id for update;
  if r.state='verified' then return to_jsonb(r); end if;
  if p_claim_token is null or r.claim_mode is null or r.locked_by is distinct from p_worker_id or r.claim_token is distinct from p_claim_token
    or r.locked_until is null or r.locked_until<=clock_timestamp() then raise exception 'receipt lease lost' using errcode='P0002'; end if;
  if r.claim_mode='execute' and (a.status<>'executing' or a.locked_by is distinct from p_worker_id
    or a.locked_until is null or a.locked_until<=clock_timestamp() or a.expires_at is null or a.expires_at<=clock_timestamp())
    then raise exception 'execution lease expired; reconcile read-only'; end if;
  if r.claim_mode='reconcile' and a.status not in ('executing','failed','expired') then raise exception 'reconciliation not permitted'; end if;
  perform check_calendar_receipt(r,false);
  event_proof:=p_proof->'event';
  if p_proof->>'uid' is distinct from r.uid or p_proof->>'href' is distinct from r.href
    or p_proof->>'etag' is null or length(p_proof->>'etag')>512 or p_proof->>'etag' !~ '^"[!#-~]+"$'
    or event_proof->>'uid' is distinct from r.uid
    or event_proof->>'summary' is distinct from r.payload->>'summary'
    or event_proof->>'description' is distinct from r.payload->>'description'
    or event_proof->>'location' is distinct from r.payload->>'location'
    or (event_proof->>'startsAt')::timestamptz is distinct from (r.payload->>'startsAt')::timestamptz
    or (event_proof->>'endsAt')::timestamptz is distinct from (r.payload->>'endsAt')::timestamptz
    or event_proof->'isAllDay' is distinct from 'false'::jsonb
    or event_proof->'rrule' is distinct from 'null'::jsonb
    or event_proof->'exdates' is distinct from '[]'::jsonb then raise exception 'remote proof does not match immutable approval'; end if;
  if r.locked_until<=clock_timestamp() then raise exception 'receipt lease expired while verifying'; end if;
  if r.claim_mode='execute' and (a.locked_until<=clock_timestamp() or a.expires_at<=clock_timestamp())
    then raise exception 'approval expired while verifying; reconcile read-only'; end if;
  if r.action_type='UPDATE_CALENDAR_EVENT' then
    update events set etag=p_proof->>'etag',summary=event_proof->>'summary',description=event_proof->>'description',
      location=event_proof->>'location',starts_at=(event_proof->>'startsAt')::timestamptz,ends_at=(event_proof->>'endsAt')::timestamptz,
      is_all_day=false,rrule=null,exdates='{}',updated_at=clock_timestamp()
      where id=(r.payload->>'eventId')::uuid and calendar_id=r.calendar_id and caldav_uid=r.uid and caldav_href=r.href returning id into event_id;
    if event_id is null then raise exception 'mirror target changed'; end if;
  else
    insert into events(calendar_id,caldav_uid,caldav_href,etag,summary,description,location,starts_at,ends_at,is_all_day,rrule,exdates,source)
      values(r.calendar_id,r.uid,r.href,p_proof->>'etag',event_proof->>'summary',event_proof->>'description',event_proof->>'location',
        (event_proof->>'startsAt')::timestamptz,(event_proof->>'endsAt')::timestamptz,false,null,'{}','app')
      on conflict(calendar_id,caldav_uid) do update set caldav_href=excluded.caldav_href,etag=excluded.etag,summary=excluded.summary,
        description=excluded.description,location=excluded.location,starts_at=excluded.starts_at,ends_at=excluded.ends_at,
        is_all_day=false,rrule=null,exdates='{}',source='app',updated_at=clock_timestamp()
      where events.caldav_href=excluded.caldav_href and events.source='app' and not events.is_all_day and events.rrule is null
      returning id into event_id;
    if event_id is null then raise exception 'existing mirror identity conflicts'; end if;
  end if;
  result:=jsonb_build_object('calendarState','verified','eventId',event_id,'uid',r.uid,'href',r.href);
  update calendar_execution_receipts set state='verified',mirror_event_id=event_id,remote_etag=p_proof->>'etag',verified_at=clock_timestamp(),
    last_error=null,locked_by=null,locked_until=null,claim_token=null,updated_at=now() where approval_id=a.id returning * into r;
  -- Reconciliation never grants a write lease or returns to approved. This
  -- transient state is visible only within this verified completion transaction.
  if a.status<>'executing' or a.locked_by is distinct from p_worker_id then
    update approval_requests set status='executing',locked_by=p_worker_id where id=a.id;
  end if;
  perform complete_approval_execution(a.id,p_worker_id,result);
  return to_jsonb(r);
end $$;

create function public.fail_calendar_execution(p_approval_id uuid,p_worker_id text,p_claim_token uuid,p_state text,p_error text)
returns void language plpgsql security definer set search_path=public as $$
declare a approval_requests; r calendar_execution_receipts; state_value text; v_result jsonb;
begin
  if p_state not in ('uncertain','conflict') then raise exception 'invalid failure state'; end if;
  if p_claim_token is null or p_worker_id is null or length(trim(p_worker_id))=0 then raise exception 'receipt claim required'; end if;
  select * into strict a from approval_requests where id=p_approval_id for update;
  select * into strict r from calendar_execution_receipts where approval_id=a.id for update;
  if r.state='verified' then return; end if;
  if r.locked_by is null or r.claim_token is null or r.locked_by is distinct from p_worker_id or r.claim_token is distinct from p_claim_token then raise exception 'receipt claim lost'; end if;
  state_value:=p_state;
  v_result:=jsonb_build_object('calendarState',state_value,'uid',r.uid,'href',r.href);
  update calendar_execution_receipts set state=state_value,last_error=left(p_error,2000),locked_by=null,locked_until=null,claim_token=null,updated_at=now()
    where approval_id=a.id;
  if a.status='executing' and a.locked_by=p_worker_id then
    update approval_requests set result=v_result where id=a.id;
    perform fail_approval_execution(a.id,p_worker_id,left(p_error,2000));
  elsif r.claim_mode='reconcile' and a.status in ('failed','expired') then
    update approval_requests set status='failed',result=v_result,error=left(p_error,2000) where id=a.id;
    insert into action_audit_logs(approval_request_id,event,actor,detail)
      values(a.id,'failed','worker',v_result||jsonb_build_object('readOnlyReconciliation',true,'error',left(p_error,2000)));
  end if;
end $$;

create function public.claim_calendar_reconciliation(p_approval_id uuid,p_owner_id uuid,p_worker_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a approval_requests; r calendar_execution_receipts;
begin
  if p_worker_id is null or length(trim(p_worker_id)) not between 1 and 200 then raise exception 'worker required'; end if;
  select * into strict a from approval_requests where id=p_approval_id for update;
  select * into strict r from calendar_execution_receipts where approval_id=a.id for update;
  if r.owner_id is distinct from p_owner_id then raise exception 'receipt owner mismatch' using errcode='42501'; end if;
  if r.state='verified' then return to_jsonb(r); end if;
  if r.state not in ('attempted','uncertain') or a.status not in ('executing','failed','expired')
    or r.locked_until>clock_timestamp() or (a.status='executing' and a.locked_until>clock_timestamp())
    then raise exception 'receipt cannot be reconciled yet'; end if;
  perform check_calendar_receipt(r,false);
  update calendar_execution_receipts set state='uncertain',locked_by=p_worker_id,locked_until=clock_timestamp()+interval '90 seconds',
    claim_token=gen_random_uuid(),claim_mode='reconcile',updated_at=now() where approval_id=a.id returning * into r;
  if a.status='executing' then
    update approval_requests set status='failed',result=jsonb_build_object('calendarState','uncertain','uid',r.uid,'href',r.href),
      error='Prior execution ended without verified completion',locked_by=null,locked_until=null where id=a.id;
    insert into action_audit_logs(approval_request_id,event,actor,detail)
      values(a.id,'failed','system',jsonb_build_object('calendarState','uncertain','reason','read-only reconciliation of expired execution'));
  end if;
  return to_jsonb(r);
end $$;

revoke all on function public.begin_calendar_execution(uuid,text) from public,anon,authenticated;
revoke all on function public.before_calendar_write(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.finish_calendar_execution(uuid,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.fail_calendar_execution(uuid,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.claim_calendar_reconciliation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.begin_calendar_execution(uuid,text) to service_role;
grant execute on function public.before_calendar_write(uuid,text,uuid) to service_role;
grant execute on function public.finish_calendar_execution(uuid,text,uuid,jsonb) to service_role;
grant execute on function public.fail_calendar_execution(uuid,text,uuid,text,text) to service_role;
grant execute on function public.claim_calendar_reconciliation(uuid,uuid,text) to service_role;
