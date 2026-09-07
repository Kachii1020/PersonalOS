-- Phase 6 integration forward fix: retain established app provenance on sync.
-- No UID-pattern backfill: existing icloud rows without receipt proof stay icloud.
-- Rollback: disable JARVIS_CALENDAR_ACTIONS_ENABLED first; retain receipts/audits.
create function public.preserve_app_event_provenance()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.source='app' and new.source='icloud'
    and old.calendar_id=new.calendar_id and old.caldav_uid=new.caldav_uid then
    new.source:='app';
    -- DAV may spell the same @ as %40. Keep an established reviewed href stable;
    -- do not decode any other escaped path character.
    if replace(old.caldav_href,'%40','@')=replace(new.caldav_href,'%40','@') then
      new.caldav_href:=old.caldav_href;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.preserve_app_event_provenance() from public,anon,authenticated;
create trigger preserve_app_event_provenance
  before update on public.events for each row
  execute function public.preserve_app_event_provenance();

create or replace function public.finish_calendar_execution(p_approval_id uuid,p_worker_id text,p_claim_token uuid,p_proof jsonb)
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
      where replace(events.caldav_href,'%40','@')=replace(excluded.caldav_href,'%40','@') and not events.is_all_day and events.rrule is null
        and coalesce(cardinality(events.exdates),0)=0
        and (events.source='app' or (
          -- A normal sync may observe our successful PUT before receipt finish.
          -- Adopt only an exact mirror of this attempted, approved remote write;
          -- neither an app-looking UID nor mismatched local content is evidence.
          events.source='icloud' and r.write_attempts=1
          and events.etag is not distinct from excluded.etag
          and events.summary is not distinct from excluded.summary
          and events.description is not distinct from excluded.description
          and events.location is not distinct from excluded.location
          and events.starts_at is not distinct from excluded.starts_at
          and events.ends_at is not distinct from excluded.ends_at
        ))
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
