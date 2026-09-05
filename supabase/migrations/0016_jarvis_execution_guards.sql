-- Phase 5A integration fixes. Keep the supplied 0015 migration immutable.
-- A full unique index supports ON CONFLICT(column); NULLs remain distinct.
drop index public.tasks_approval_request_unique;
create unique index tasks_approval_request_unique on public.tasks (approval_request_id);

-- Revoke explicit Supabase default grants as well as PUBLIC inheritance.
revoke all on function public.enqueue_inbox_event() from anon;
revoke all on function public.audit_approval_requested() from anon;
revoke all on function public.claim_next_system_event(text, integer) from anon;
revoke all on function public.claim_next_agent_run(text, integer) from anon;
revoke all on function public.claim_next_approved_action(text, integer) from anon;
revoke all on function public.claim_approved_action_by_id(uuid, text, integer) from anon;
revoke all on function public.complete_approval_execution(uuid, text, jsonb) from anon;
revoke all on function public.fail_approval_execution(uuid, text, text) from anon;
revoke all on function public.decide_approval(uuid, text, text) from anon;

-- Only capture fields are client-writable, including through direct REST calls.
revoke all on public.inbox_items from anon, authenticated;
grant select on public.inbox_items to authenticated;
grant insert (kind, raw_text, source_url) on public.inbox_items to authenticated;

-- Publish the approval and move its run to waiting in the same transaction.
create function public.prepare_jarvis_approval(
  p_run_id uuid, p_worker_id text, p_proposal jsonb
) returns setof public.approval_requests
language plpgsql security definer set search_path = public
as $$
declare
  v_run agent_runs%rowtype;
  v_approval approval_requests%rowtype;
begin
  select * into v_run from agent_runs where id = p_run_id for update;
  if not found or v_run.current_step <> 'prepare_approval'
    or v_run.locked_by is distinct from p_worker_id
    or v_run.locked_until is null or v_run.locked_until <= clock_timestamp() then
    raise exception 'run lease lost' using errcode = 'P0002';
  end if;
  insert into approval_requests (
    agent_run_id, action_type, title, explanation, payload, risk_level, idempotency_key, expires_at
  ) values (
    p_run_id, p_proposal->>'type', p_proposal->>'title', p_proposal->>'explanation',
    p_proposal->'payload', p_proposal->>'riskLevel', p_proposal->>'idempotencyKey',
    now() + interval '14 days'
  ) on conflict (idempotency_key) do nothing returning * into v_approval;
  if v_approval.id is null then
    select * into strict v_approval from approval_requests
      where idempotency_key = p_proposal->>'idempotencyKey';
    if v_approval.agent_run_id is distinct from p_run_id
      or v_approval.payload is distinct from p_proposal->'payload' then
      raise exception 'idempotency payload mismatch';
    end if;
  end if;
  update agent_runs set status = 'waiting_approval', current_step = 'wait_approval',
    output = jsonb_build_object('approvalId', v_approval.id), attempts = 0,
    updated_at = now(), locked_by = null, locked_until = null, error = null
    where id = p_run_id;
  return next v_approval;
end;
$$;

-- A lease alone is not authorization. Check the saved, immutable approval again
-- under its row lock immediately before inserting. Commit task + audit + run
-- together so a transport failure after commit is safe to retry.
create function public.execute_approved_task(p_approval_id uuid, p_worker_id text)
returns table (id uuid, title text)
language plpgsql security definer set search_path = public
as $$
declare
  v_approval approval_requests%rowtype;
  v_task tasks%rowtype;
  v_payload jsonb;
begin
  select * into v_approval from approval_requests where approval_requests.id = p_approval_id for update;
  if not found or v_approval.action_type <> 'CREATE_TASK' then
    raise exception 'unsupported approval' using errcode = '22023';
  end if;
  if v_approval.status = 'executed' then
    return query select t.id, t.title from tasks t where t.approval_request_id = p_approval_id;
    return;
  end if;
  if v_approval.status <> 'executing' or v_approval.decided_at is null
    or v_approval.locked_by is distinct from p_worker_id
    or v_approval.locked_until is null or v_approval.locked_until <= clock_timestamp()
    or (v_approval.expires_at is not null and v_approval.expires_at <= clock_timestamp()) then
    raise exception 'approval expired or execution lease lost' using errcode = 'P0002';
  end if;
  v_payload := v_approval.payload;
  if jsonb_typeof(v_payload->'title') is distinct from 'string'
    or length(trim(v_payload->>'title')) not between 1 and 300 then
    raise exception 'invalid task title' using errcode = '22023';
  end if;
  insert into action_audit_logs (approval_request_id, event, actor, detail)
    values (p_approval_id, 'executing', 'worker', jsonb_build_object('actionType', 'CREATE_TASK'));
  insert into tasks (
    title, notes, due_at, status, category, priority, estimated_minutes,
    source_type, source_id, generated_by, priority_reason, approval_request_id
  ) values (
    trim(v_payload->>'title'), v_payload->>'notes', (v_payload->>'dueAt')::timestamptz,
    'open', v_payload->>'category', (v_payload->>'priority')::smallint,
    (v_payload->>'estimatedMinutes')::integer, 'jarvis_approval', p_approval_id::text,
    'jarvis', '사용자가 승인한 JARVIS 제안', p_approval_id
  ) on conflict (approval_request_id) do nothing;
  select * into strict v_task from tasks where approval_request_id = p_approval_id;
  perform public.complete_approval_execution(p_approval_id, p_worker_id,
    jsonb_build_object('taskId', v_task.id, 'title', v_task.title));
  return query select v_task.id, v_task.title;
end;
$$;
revoke all on function public.prepare_jarvis_approval(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.execute_approved_task(uuid, text) from public, anon, authenticated;
grant execute on function public.prepare_jarvis_approval(uuid, text, jsonb) to service_role;
grant execute on function public.execute_approved_task(uuid, text) to service_role;
