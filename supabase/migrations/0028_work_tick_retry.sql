-- Make scheduler claim retries safe when the API Gateway loses a response.
-- Existing claims are returned only to the same scheduler slot worker while
-- its lease is live; no reminder is re-claimed and no Push is re-sent here.
create or replace function public.claim_measured_work_attention(p_worker_id text,p_slot timestamptz,p_allow_automatic boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; existing attention_items;
begin
  if p_slot is null or p_slot>clock_timestamp() or p_slot<clock_timestamp()-interval '5 minutes'
    or not exists(select 1 from work_scheduler_state where singleton and enabled)
    or not exists(select 1 from work_scheduler_probes where slot=p_slot and request_id is not null
    and worker_started_at is not null and worker_finished_at is null) then raise exception 'active dispatched scheduler slot required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('work-tick:'||p_slot::text,0));
  select * into existing from attention_items where status='processing' and locked_by=p_worker_id
    and locked_until>clock_timestamp() and (not is_measurement or measurement_slot=p_slot)
    order by due_at,id limit 1;
  if found then
    return jsonb_build_object('id',existing.id,'contextId',existing.context_id,'ownerId',existing.owner_id,'kind',existing.kind,
      'dueAt',existing.due_at,'status',existing.status,'reason',existing.reason,'acknowledgedAt',existing.acknowledged_at,
      'lockedUntil',existing.locked_until,'isMeasurement',existing.is_measurement);
  end if;
  perform set_config('personalos.canary_slot',p_slot::text,true);
  result:=claim_work_attention(p_worker_id,p_allow_automatic);
  perform set_config('personalos.canary_slot','',true);
  return result;
end $$;
revoke all on function public.claim_measured_work_attention(text,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.claim_measured_work_attention(text,timestamptz,boolean) to service_role;

-- Completion can commit even if the Gateway loses its response. Returning the
-- already-recorded target status makes the exact retry safe and prevents a
-- false lease-lost failure from replacing a completed result.
create or replace function public.finish_work_attention(p_attention_id uuid,p_worker_id text,p_status text,p_error text default null)
returns void language plpgsql security definer set search_path=public as $$
declare a attention_items; w work_contexts;
begin
  if p_status not in ('ready','failed') then raise exception 'invalid attention result'; end if;
  select * into a from attention_items where id=p_attention_id;
  if not found or (a.status=p_status and a.locked_by is null) then return; end if;
  select * into strict w from work_contexts where id=a.context_id for update;
  select * into strict a from attention_items where id=p_attention_id for update;
  if a.status='cancelled' or (a.status=p_status and a.locked_by is null) then return; end if;
  if a.locked_by is distinct from p_worker_id or a.locked_until is null or a.locked_until<=clock_timestamp() then raise exception 'attention lease lost'; end if;
  update attention_items set status=case when not coalesce(work_attention_valid(w,a),false) then 'cancelled' else p_status end,
    last_error=left(p_error,1000),locked_by=null,locked_until=null,next_attempt_at=clock_timestamp()+interval '2 minutes',updated_at=now() where id=a.id;
end $$;
revoke all on function public.finish_work_attention(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_work_attention(uuid,text,text,text) to service_role;
