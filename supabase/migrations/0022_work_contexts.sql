-- Phase 7: explicitly confirmed work state, bounded reminders and existing
-- approval links. No raw conversation or duplicated task/calendar records.
create table public.work_contexts (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
  goal text not null check(length(goal)<=200), progress text not null default '' check(length(progress)<=2000),
  next_step text not null default '' check(length(next_step)<=2000),
  status text not null default 'active' check(status in ('active','paused','completed','cancelled')),
  revision integer not null default 1 check(revision>0),
  deadline_at timestamptz, reminder_at timestamptz,
  deadline_reminder boolean not null default false, resume_reminder boolean not null default false,
  missing_fields text[] not null default '{}', source_refs jsonb not null default '[]' check(jsonb_typeof(source_refs)='array'),
  last_progress_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  expires_at timestamptz, forgotten_at timestamptz,
  check(forgotten_at is not null or length(trim(goal))>0)
);
create index work_contexts_owner on public.work_contexts(owner_id,updated_at desc);

-- Opaque request hashes and result IDs survive forgetting. A replay must not
-- resurrect forgotten content. This ledger never stores the original input.
create table public.work_context_requests (
  owner_id uuid not null references auth.users(id), request_id uuid not null,
  operation text not null check(operation in ('create','update','status','forget','link')),
  request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'), input_hash text not null,
  context_id uuid not null references public.work_contexts(id), result_revision integer not null,
  result_ids uuid[] not null default '{}', created_at timestamptz not null default now(),
  primary key(owner_id,request_id,operation)
);
create table public.work_context_actions (
  id uuid primary key default gen_random_uuid(), context_id uuid not null references public.work_contexts(id),
  owner_id uuid not null references auth.users(id), context_revision integer not null,
  request_id uuid not null, ordinal integer not null check(ordinal between 1 and 3),
  draft_id uuid not null unique references public.dialogue_action_drafts(id) on delete cascade,
  approval_id uuid references public.approval_requests(id), created_at timestamptz not null default now(),
  unique(owner_id,request_id,ordinal)
);
create table public.attention_items (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
  context_id uuid not null references public.work_contexts(id), source_revision integer not null,
  kind text not null check(kind in ('explicit','deadline','resume')), due_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','processing','ready','failed','cancelled','acknowledged')),
  reason text not null, dedupe_key text not null unique, snoozed_until timestamptz,
  acknowledged_at timestamptz, quota_reserved_at timestamptz,
  locked_by text, locked_until timestamptz, claim_count integer not null default 0,
  next_attempt_at timestamptz not null default now(), last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index work_attention_due on public.attention_items(due_at) where status in ('pending','processing','failed');
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(), attention_id uuid not null references public.attention_items(id),
  owner_id uuid not null references auth.users(id), subscription_id uuid not null,
  attempt integer not null check(attempt between 1 and 3), attempt_token uuid not null,
  provider_state text not null check(provider_state in ('attempted','accepted','failed','gone','uncertain')),
  worker_id text not null, attempted_at timestamptz not null, finished_at timestamptz,
  retry_after timestamptz, received_at timestamptz, opened_at timestamptz, error text,
  unique(attention_id,subscription_id)
);

do $$ declare t text; begin
  foreach t in array array['work_contexts','work_context_requests','work_context_actions','attention_items','notification_deliveries'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('create policy work_owner on public.%I for select to authenticated using(public.is_allowed_user() and owner_id=auth.uid())',t);
  end loop;
end $$;

create function public.work_refresh_attention(p_context_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare w work_contexts; explicit_key text; deadline_key text; resume_key text;
begin
  select * into strict w from work_contexts where id=p_context_id;
  if w.status<>'active' or w.forgotten_at is not null or (w.expires_at is not null and w.expires_at<=clock_timestamp()) then
    update attention_items set status='cancelled',locked_by=null,locked_until=null,updated_at=now()
      where context_id=w.id and status in ('pending','processing','ready','failed'); return;
  end if;
  explicit_key:=case when w.reminder_at is not null then w.id||':explicit:'||extract(epoch from w.reminder_at)::text end;
  deadline_key:=case when w.deadline_reminder and w.deadline_at>clock_timestamp() then w.id||':deadline:'||extract(epoch from w.deadline_at)::text end;
  resume_key:=case when w.resume_reminder then w.id||':resume:'||extract(epoch from w.last_progress_at)::text end;
  update attention_items set status='cancelled',locked_by=null,locked_until=null,updated_at=now()
    where context_id=w.id and status in ('pending','processing','ready','failed')
      and dedupe_key is distinct from explicit_key and dedupe_key is distinct from deadline_key and dedupe_key is distinct from resume_key;
  if w.reminder_at is not null then
    insert into attention_items(owner_id,context_id,source_revision,kind,due_at,reason,dedupe_key)
      values(w.owner_id,w.id,w.revision,'explicit',w.reminder_at,'직접 지정한 시각이 되었습니다.',explicit_key)
      on conflict(dedupe_key) do update set source_revision=excluded.source_revision,
        status=case when attention_items.status='cancelled' and attention_items.acknowledged_at is null and attention_items.snoozed_until is null
          and not exists(select 1 from notification_deliveries where attention_id=attention_items.id) then 'pending' else attention_items.status end;
  end if;
  if w.deadline_reminder and w.deadline_at is not null and w.deadline_at>clock_timestamp() then
    insert into attention_items(owner_id,context_id,source_revision,kind,due_at,reason,dedupe_key)
      values(w.owner_id,w.id,w.revision,'deadline',w.deadline_at-interval '24 hours','업무 마감 전 확인할 시간입니다.',deadline_key)
      on conflict(dedupe_key) do update set source_revision=excluded.source_revision,
        status=case when attention_items.status='cancelled' and attention_items.acknowledged_at is null and attention_items.snoozed_until is null
          and not exists(select 1 from notification_deliveries where attention_id=attention_items.id) then 'pending' else attention_items.status end;
  end if;
  if w.resume_reminder then
    insert into attention_items(owner_id,context_id,source_revision,kind,due_at,reason,dedupe_key)
      values(w.owner_id,w.id,w.revision,'resume',w.last_progress_at+interval '48 hours','마지막 진행 기록 이후 이틀이 지났습니다.',resume_key)
      on conflict(dedupe_key) do update set source_revision=excluded.source_revision,
        status=case when attention_items.status='cancelled' and attention_items.acknowledged_at is null and attention_items.snoozed_until is null
          and not exists(select 1 from notification_deliveries where attention_id=attention_items.id) then 'pending' else attention_items.status end;
  end if;
end $$;
revoke all on function public.work_refresh_attention(uuid) from public,anon,authenticated,service_role;

create function public.mutate_work_context(p_operation text,p_context_id uuid,p_expected_revision integer,p_request_id uuid,p_request_hash text,p_input jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare w work_contexts; prior work_context_requests; fingerprint text; new_status text; new_deadline timestamptz; new_reminder timestamptz;
begin
  if not public.is_allowed_user() or auth.uid() is null then raise exception 'not allowed' using errcode='42501'; end if;
  if p_operation not in ('create','update','status','forget') or p_request_id is null or p_request_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid request'; end if;
  if jsonb_typeof(p_input) is distinct from 'object' then raise exception 'input must be object'; end if;
  fingerprint:=encode(sha256(convert_to(jsonb_build_object('operation',p_operation,'contextId',p_context_id,'expectedRevision',p_expected_revision,'input',p_input)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text||p_operation,0));
  select * into prior from work_context_requests where owner_id=auth.uid() and request_id=p_request_id and operation=p_operation;
  if found then
    if prior.request_hash is distinct from p_request_hash or prior.input_hash is distinct from fingerprint then raise exception 'request id reused with different input'; end if;
    if exists(select 1 from work_contexts where id=prior.context_id and forgotten_at is null and (expires_at is null or expires_at>clock_timestamp())) then return prior.context_id; end if;
    return null;
  end if;
  if p_operation='create' then
    if p_context_id is not null or p_expected_revision is not null then raise exception 'new work cannot name existing revision'; end if;
  else
    select * into w from work_contexts where id=p_context_id and owner_id=auth.uid() for update;
    if not found or w.forgotten_at is not null or (w.expires_at is not null and w.expires_at<=clock_timestamp()) then raise exception 'work not available'; end if;
    if p_expected_revision is null or w.revision<>p_expected_revision then raise exception 'work revision changed' using errcode='PT409'; end if;
  end if;
  if p_operation in ('create','update') then
    if p_operation='update' and w.status in ('completed','cancelled') then raise exception 'finished work cannot be updated; create new work'; end if;
    if not(p_input ?& array['goal','progress','nextStep','deadlineAt','reminderAt','deadlineReminder','resumeReminder'])
      or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('goal','progress','nextStep','deadlineAt','reminderAt','deadlineReminder','resumeReminder'))
      or jsonb_typeof(p_input->'goal') is distinct from 'string' or length(p_input->>'goal')>200 or length(trim(p_input->>'goal'))=0
      or jsonb_typeof(p_input->'progress') is distinct from 'string' or length(p_input->>'progress')>2000
      or jsonb_typeof(p_input->'nextStep') is distinct from 'string' or length(p_input->>'nextStep')>2000
      or jsonb_typeof(p_input->'deadlineReminder') is distinct from 'boolean' or jsonb_typeof(p_input->'resumeReminder') is distinct from 'boolean'
      then raise exception 'invalid work fields'; end if;
    if p_input->>'deadlineAt' is not null and (p_input->>'deadlineAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([.]0{1,6})?(Z|[+-]\d{2}:\d{2})$' or right(p_input->>'deadlineAt',6)='-00:00') then raise exception 'deadline requires whole seconds and known timezone'; end if;
    if p_input->>'reminderAt' is not null and (p_input->>'reminderAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([.]0{1,6})?(Z|[+-]\d{2}:\d{2})$' or right(p_input->>'reminderAt',6)='-00:00') then raise exception 'reminder requires whole seconds and known timezone'; end if;
    if p_input->>'deadlineAt' is not null and (substring(p_input->>'deadlineAt' from 12 for 2)::integer>23 or substring(p_input->>'deadlineAt' from 15 for 2)::integer>59 or substring(p_input->>'deadlineAt' from 18 for 2)::integer>59) then raise exception 'invalid deadline time'; end if;
    if p_input->>'reminderAt' is not null and (substring(p_input->>'reminderAt' from 12 for 2)::integer>23 or substring(p_input->>'reminderAt' from 15 for 2)::integer>59 or substring(p_input->>'reminderAt' from 18 for 2)::integer>59) then raise exception 'invalid reminder time'; end if;
    new_deadline:=(p_input->>'deadlineAt')::timestamptz; new_reminder:=(p_input->>'reminderAt')::timestamptz;
    if (p_input->>'deadlineReminder')::boolean and new_deadline is null then raise exception 'deadline reminder requires deadline'; end if;
    if p_operation='create' then
      insert into work_contexts(owner_id,goal,progress,next_step,deadline_at,reminder_at,deadline_reminder,resume_reminder)
        values(auth.uid(),trim(p_input->>'goal'),trim(p_input->>'progress'),trim(p_input->>'nextStep'),new_deadline,new_reminder,(p_input->>'deadlineReminder')::boolean,(p_input->>'resumeReminder')::boolean) returning * into w;
    else
      update work_contexts set goal=trim(p_input->>'goal'),progress=trim(p_input->>'progress'),next_step=trim(p_input->>'nextStep'),
        last_progress_at=case when progress is distinct from trim(p_input->>'progress') then clock_timestamp() else last_progress_at end,
        deadline_at=new_deadline,reminder_at=new_reminder,deadline_reminder=(p_input->>'deadlineReminder')::boolean,resume_reminder=(p_input->>'resumeReminder')::boolean,
        revision=revision+1,updated_at=clock_timestamp() where id=w.id returning * into w;
    end if;
    update work_contexts set missing_fields=(case when length(trim(next_step))=0 then array['nextStep'] else '{}'::text[] end)
        ||(case when deadline_reminder and deadline_at is null then array['deadlineAt'] else '{}'::text[] end),
      source_refs=jsonb_build_array(jsonb_build_object('kind','user_confirmed','contextId',w.id,'revision',w.revision,'confirmedAt',clock_timestamp())) where id=w.id returning * into w;
  elsif p_operation='status' then
    new_status:=p_input->>'status';
    if new_status is null or new_status not in ('active','paused','completed','cancelled') or p_input- 'status'<>'{}'::jsonb then raise exception 'invalid work status'; end if;
    if w.status in ('completed','cancelled') and new_status<>w.status then raise exception 'finished work cannot reopen; create new work'; end if;
    update work_contexts set status=new_status,revision=revision+1,updated_at=clock_timestamp(),
      reminder_at=case when new_status in ('completed','cancelled') then null else reminder_at end,
      deadline_reminder=case when new_status in ('completed','cancelled') then false else deadline_reminder end,
      resume_reminder=case when new_status in ('completed','cancelled') then false else resume_reminder end,
      expires_at=case when new_status in ('completed','cancelled') then clock_timestamp()+interval '30 days' else null end where id=w.id returning * into w;
  else
    if p_input<>'{}'::jsonb then raise exception 'forget takes no content'; end if;
    update work_contexts set goal='',progress='',next_step='',status='cancelled',deadline_at=null,reminder_at=null,
      deadline_reminder=false,resume_reminder=false,missing_fields='{}',source_refs='[]',revision=revision+1,
      forgotten_at=clock_timestamp(),expires_at=clock_timestamp(),updated_at=clock_timestamp() where id=w.id returning * into w;
  end if;
  perform work_refresh_attention(w.id);
  insert into work_context_requests(owner_id,request_id,operation,request_hash,input_hash,context_id,result_revision)
    values(auth.uid(),p_request_id,p_operation,p_request_hash,fingerprint,w.id,w.revision);
  return case when w.forgotten_at is null then w.id else null end;
end $$;

create function public.link_work_drafts(p_context_id uuid,p_revision integer,p_request_id uuid,p_request_hash text,p_draft_ids uuid[])
returns uuid language plpgsql security definer set search_path=public as $$
declare w work_contexts; d dialogue_action_drafts; prior work_context_requests; fingerprint text; draft_id uuid; i integer:=0; ids uuid[]:='{}'; action_id uuid;
begin
  if not public.is_allowed_user() or auth.uid() is null then raise exception 'not allowed' using errcode='42501'; end if;
  if p_request_id is null or p_request_hash !~ '^[0-9a-f]{64}$' or cardinality(p_draft_ids) not between 1 and 3 then raise exception 'one to three drafts required'; end if;
  fingerprint:=encode(sha256(convert_to(jsonb_build_object('contextId',p_context_id,'revision',p_revision,'draftIds',p_draft_ids)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text||'link',0));
  select * into prior from work_context_requests where owner_id=auth.uid() and request_id=p_request_id and operation='link';
  if found then
    if prior.request_hash is distinct from p_request_hash or prior.input_hash is distinct from fingerprint then raise exception 'request id reused'; end if;
    if exists(select 1 from work_contexts where id=prior.context_id and forgotten_at is null and status='active' and (expires_at is null or expires_at>clock_timestamp())) then return prior.context_id; end if;
    return null;
  end if;
  select * into w from work_contexts where id=p_context_id and owner_id=auth.uid() for update;
  if not found or w.forgotten_at is not null or w.status<>'active' or w.revision is distinct from p_revision
    or (w.expires_at is not null and w.expires_at<=clock_timestamp()) then raise exception 'work changed or inactive'; end if;
  foreach draft_id in array p_draft_ids loop
    select * into d from dialogue_action_drafts where id=draft_id and owner_id=auth.uid() for update;
    if not found or d.approval_request_id is not null or d.expires_at<=clock_timestamp()
      or d.source_snapshot->>'workContextId' is distinct from w.id::text
      or d.source_snapshot->>'contextRevision' is distinct from w.revision::text then raise exception 'draft is not a current server work proposal'; end if;
    i:=i+1;
    insert into work_context_actions(context_id,owner_id,context_revision,request_id,ordinal,draft_id)
      values(w.id,w.owner_id,w.revision,p_request_id,i,d.id) returning id into action_id;
    ids:=array_append(ids,action_id);
  end loop;
  insert into work_context_requests(owner_id,request_id,operation,request_hash,input_hash,context_id,result_revision,result_ids)
    values(auth.uid(),p_request_id,'link',p_request_hash,fingerprint,w.id,w.revision,ids);
  return w.id;
end $$;

-- These guards apply only to proposals linked to work, preserving standalone
-- Phase 6 behavior and allowing read-only receipt reconciliation after cancel.
create function public.assert_work_draft_current(p_draft_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare w work_contexts; a work_context_actions; d dialogue_action_drafts;
begin
  select * into d from dialogue_action_drafts where id=p_draft_id;
  select * into a from work_context_actions where draft_id=p_draft_id;
  if not found then
    if d.source_snapshot ? 'workContextId' then raise exception 'work proposal must be linked before approval' using errcode='42501'; end if;
    return;
  end if;
  select * into strict w from work_contexts where id=a.context_id for share;
  if w.owner_id is distinct from d.owner_id or w.id::text is distinct from d.source_snapshot->>'workContextId'
    or a.context_revision::text is distinct from d.source_snapshot->>'contextRevision'
    or w.status<>'active' or w.forgotten_at is not null or w.revision<>a.context_revision
    or (w.expires_at is not null and w.expires_at<=clock_timestamp()) then raise exception 'work is inactive or changed; review a new proposal' using errcode='42501'; end if;
end $$;
create function public.guard_work_approval()
returns trigger language plpgsql security definer set search_path=public as $$
declare d dialogue_action_drafts;
begin
  if new.status not in ('pending','approved','executing') then return new; end if;
  if new.status='executing' and exists(select 1 from calendar_execution_receipts where approval_id=new.id and state='verified') then return new; end if;
  select * into d from dialogue_action_drafts where approval_request_id=new.id or 'dialogue:draft:'||id::text=new.idempotency_key limit 1;
  if found then perform assert_work_draft_current(d.id); end if;
  return new;
end $$;
create trigger work_approval_guard before insert or update of status on public.approval_requests for each row execute function public.guard_work_approval();
create function public.sync_work_approval_link()
returns trigger language plpgsql security definer set search_path=public as $$
begin update work_context_actions set approval_id=new.approval_request_id where draft_id=new.id; return new; end $$;
create trigger work_approval_link after update of approval_request_id on public.dialogue_action_drafts for each row execute function public.sync_work_approval_link();
create function public.guard_work_domain_write()
returns trigger language plpgsql security definer set search_path=public as $$
declare approval_id uuid; draft_id uuid;
begin
  if tg_table_name='tasks' then approval_id:=new.approval_request_id;
  else
    if new.state not in ('prepared','attempted') then return new; end if;
    approval_id:=new.approval_id;
  end if;
  if approval_id is not null then
    select id into draft_id from dialogue_action_drafts where approval_request_id=approval_id;
    if found then perform assert_work_draft_current(draft_id); end if;
  end if;
  return new;
end $$;
create trigger work_task_write_guard before insert on public.tasks for each row execute function public.guard_work_domain_write();
create trigger work_calendar_write_guard before insert or update of state on public.calendar_execution_receipts for each row execute function public.guard_work_domain_write();

create function public.work_attention_valid(w public.work_contexts,a public.attention_items)
returns boolean language sql volatile set search_path=public as $$
  select w.status='active' and w.forgotten_at is null and (w.expires_at is null or w.expires_at>clock_timestamp())
    and w.revision=a.source_revision and w.owner_id=a.owner_id and a.acknowledged_at is null
    and case a.kind when 'explicit' then w.reminder_at is not null
      when 'deadline' then w.deadline_reminder and w.deadline_at>clock_timestamp()
      when 'resume' then w.resume_reminder else false end
$$;

create function public.claim_work_attention(p_worker_id text,p_allow_automatic boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare candidate attention_items; a attention_items; w work_contexts; clock timestamptz; jst_day date; hour integer; used integer;
begin
  if p_worker_id is null or length(trim(p_worker_id)) not between 1 and 200 then raise exception 'worker required'; end if;
  for candidate in select * from attention_items where status in ('pending','processing','failed') and due_at<=clock_timestamp()
    and (kind='explicit' or p_allow_automatic is true)
    and next_attempt_at<=clock_timestamp() and (locked_until is null or locked_until<=clock_timestamp()) and claim_count<5 order by due_at,id limit 30 loop
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
      select count(*) into used from attention_items where owner_id=w.owner_id and kind<>'explicit' and (quota_reserved_at at time zone 'Asia/Tokyo')::date=jst_day;
      if (a.quota_reserved_at is null or (a.quota_reserved_at at time zone 'Asia/Tokyo')::date<>jst_day) and used>=3 then continue; end if;
    end if;
    update attention_items set status='processing',locked_by=p_worker_id,locked_until=clock+interval '90 seconds',claim_count=claim_count+1,
      quota_reserved_at=case when kind='explicit' then null when (quota_reserved_at at time zone 'Asia/Tokyo')::date=jst_day then quota_reserved_at else clock end,updated_at=clock where id=a.id returning * into a;
    return jsonb_build_object('id',a.id,'contextId',a.context_id,'ownerId',a.owner_id,'kind',a.kind,'dueAt',a.due_at,'status',a.status,'reason',a.reason,'acknowledgedAt',a.acknowledged_at,'lockedUntil',a.locked_until);
  end loop;
  return null;
end $$;

create function public.begin_work_delivery(p_attention_id uuid,p_worker_id text,p_subscription_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a attention_items; w work_contexts; d notification_deliveries; clock timestamptz; hour integer; used integer;
begin
  select * into a from attention_items where id=p_attention_id;
  if not found then return null; end if;
  select * into strict w from work_contexts where id=a.context_id for update;
  select * into strict a from attention_items where id=p_attention_id for update;
  if a.status<>'processing' or a.locked_by is distinct from p_worker_id or a.locked_until is null or a.locked_until<=clock_timestamp()
    or not coalesce(work_attention_valid(w,a),false) then return null; end if;
  if not exists(select 1 from push_subscriptions where id=p_subscription_id)
    or not exists(select 1 from auth.users u join app_config c on c.key='allowed_email' and c.value=u.email where u.id=w.owner_id) then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(w.owner_id::text||':work-attention',0));
  clock:=clock_timestamp(); hour:=extract(hour from clock at time zone 'Asia/Tokyo');
  if a.locked_until<=clock or a.due_at>clock or not coalesce(work_attention_valid(w,a),false) then return null; end if;
  if a.kind<>'explicit' then
    if hour>=22 or hour<8 then return null; end if;
    select count(*) into used from attention_items where owner_id=w.owner_id and kind<>'explicit'
      and (quota_reserved_at at time zone 'Asia/Tokyo')::date=(clock at time zone 'Asia/Tokyo')::date;
    if a.quota_reserved_at is null or (a.quota_reserved_at at time zone 'Asia/Tokyo')::date<>(clock at time zone 'Asia/Tokyo')::date or used>3 then return null; end if;
  end if;
  select * into d from notification_deliveries where attention_id=a.id and subscription_id=p_subscription_id for update;
  -- The delivery row may itself have waited on a concurrent provider result.
  -- Re-evaluate wall-clock authorization after every potentially blocking lock.
  clock:=clock_timestamp(); hour:=extract(hour from clock at time zone 'Asia/Tokyo');
  if a.locked_until<=clock or a.due_at>clock or not coalesce(work_attention_valid(w,a),false) then return null; end if;
  if a.kind<>'explicit' then
    select count(*) into used from attention_items where owner_id=w.owner_id and kind<>'explicit'
      and (quota_reserved_at at time zone 'Asia/Tokyo')::date=(clock at time zone 'Asia/Tokyo')::date;
    if hour>=22 or hour<8 or used>3 or a.quota_reserved_at is null
      or (a.quota_reserved_at at time zone 'Asia/Tokyo')::date<>(clock at time zone 'Asia/Tokyo')::date then return null; end if;
  end if;
  if d.id is not null then
    -- A lost provider response is not permission to resend. Only a recorded
    -- rejection can retry, with a stable logical ID and bounded backoff.
    if d.provider_state<>'failed' or d.attempt>=3 or d.retry_after is null or d.retry_after>clock then return null; end if;
    update notification_deliveries set attempt=attempt+1,attempt_token=gen_random_uuid(),provider_state='attempted',worker_id=p_worker_id,
      attempted_at=clock,finished_at=null,error=null where id=d.id returning * into d;
  else
    insert into notification_deliveries(attention_id,owner_id,subscription_id,attempt,attempt_token,provider_state,worker_id,attempted_at)
      values(a.id,w.owner_id,p_subscription_id,1,gen_random_uuid(),'attempted',p_worker_id,clock) returning * into d;
  end if;
  return jsonb_build_object('deliveryId',d.id,'attemptToken',d.attempt_token,'attempt',d.attempt,'subscriptionId',d.subscription_id);
end $$;

create function public.finish_work_delivery(p_delivery_id uuid,p_worker_id text,p_attempt_token uuid,p_status text,p_error text default null)
returns void language plpgsql security definer set search_path=public as $$
declare d notification_deliveries;
begin
  if p_status not in ('accepted','failed','gone','uncertain') then raise exception 'invalid provider state'; end if;
  select * into strict d from notification_deliveries where id=p_delivery_id for update;
  if d.worker_id is distinct from p_worker_id or d.attempt_token is distinct from p_attempt_token then raise exception 'delivery attempt changed'; end if;
  if d.provider_state<>'attempted' then
    if d.provider_state=p_status then return; end if;
    raise exception 'provider result already recorded';
  end if;
  update notification_deliveries set provider_state=p_status,finished_at=clock_timestamp(),error=left(p_error,1000),
    retry_after=case when p_status='failed' and attempt<3 then clock_timestamp()+make_interval(secs=>60*attempt) else null end where id=d.id;
end $$;

create function public.finish_work_attention(p_attention_id uuid,p_worker_id text,p_status text,p_error text default null)
returns void language plpgsql security definer set search_path=public as $$
declare a attention_items; w work_contexts;
begin
  if p_status not in ('ready','failed') then raise exception 'invalid attention result'; end if;
  select * into a from attention_items where id=p_attention_id;
  if not found then return; end if;
  select * into strict w from work_contexts where id=a.context_id for update;
  select * into strict a from attention_items where id=p_attention_id for update;
  if a.status='cancelled' then return; end if;
  if a.locked_by is distinct from p_worker_id or a.locked_until is null or a.locked_until<=clock_timestamp() then raise exception 'attention lease lost'; end if;
  update attention_items set status=case when not coalesce(work_attention_valid(w,a),false) then 'cancelled' else p_status end,
    last_error=left(p_error,1000),locked_by=null,locked_until=null,next_attempt_at=clock_timestamp()+interval '2 minutes',updated_at=now() where id=a.id;
end $$;

create function public.ack_work_delivery(p_delivery_id uuid,p_event text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_allowed_user() or auth.uid() is null then raise exception 'not allowed' using errcode='42501'; end if;
  if p_event not in ('received','opened') then raise exception 'invalid client observation'; end if;
  update notification_deliveries set
    received_at=case when p_event='received' then coalesce(received_at,clock_timestamp()) else received_at end,
    opened_at=case when p_event='opened' then coalesce(opened_at,clock_timestamp()) else opened_at end
    where id=p_delivery_id and owner_id=auth.uid();
  if not found then raise exception 'delivery not found' using errcode='42501'; end if;
end $$;

create function public.get_claimed_work_subscriptions(p_attention_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a attention_items; w work_contexts; subscriptions jsonb;
begin
  select * into a from attention_items where id=p_attention_id;
  if not found or a.status<>'processing' or a.locked_by is null or a.locked_until is null or a.locked_until<=clock_timestamp() then return '[]'; end if;
  select * into strict w from work_contexts where id=a.context_id;
  if not coalesce(work_attention_valid(w,a),false)
    or not exists(select 1 from auth.users u join app_config c on c.key='allowed_email' and c.value=u.email where u.id=w.owner_id) then return '[]'; end if;
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into subscriptions from
    (select id,endpoint,p256dh,auth from push_subscriptions order by created_at,id limit 20) s;
  return subscriptions;
end $$;

create function public.mutate_work_attention(p_attention_id uuid,p_operation text)
returns void language plpgsql security definer set search_path=public as $$
declare a attention_items; w work_contexts; next_time timestamptz;
begin
  if not public.is_allowed_user() or auth.uid() is null then raise exception 'not allowed' using errcode='42501'; end if;
  if p_operation not in ('hour','tomorrow','disable','ack') then raise exception 'invalid attention choice'; end if;
  select * into a from attention_items where id=p_attention_id and owner_id=auth.uid();
  if not found then raise exception 'attention not found'; end if;
  select * into strict w from work_contexts where id=a.context_id and owner_id=auth.uid() for update;
  select * into strict a from attention_items where id=p_attention_id for update;
  if w.forgotten_at is not null then raise exception 'work forgotten'; end if;
  if a.source_revision<>w.revision and p_operation<>'ack' then raise exception 'attention revision changed' using errcode='PT409'; end if;
  if p_operation='ack' then
    update attention_items set status='acknowledged',acknowledged_at=clock_timestamp(),locked_by=null,locked_until=null,updated_at=now() where id=a.id;
  elsif p_operation='disable' then
    update work_contexts set reminder_at=case when a.kind='explicit' then null else reminder_at end,
      deadline_reminder=case when a.kind='deadline' then false else deadline_reminder end,
      resume_reminder=case when a.kind='resume' then false else resume_reminder end,revision=revision+1,updated_at=now() where id=w.id;
    perform work_refresh_attention(w.id);
  else
    if not coalesce(work_attention_valid(w,a),false) then raise exception 'attention no longer current'; end if;
    next_time:=case when p_operation='hour' then clock_timestamp()+interval '1 hour'
      else (((clock_timestamp() at time zone 'Asia/Tokyo')::date+1)+(a.due_at at time zone 'Asia/Tokyo')::time) at time zone 'Asia/Tokyo' end;
    -- Snoozing is a new explicit user-selected schedule. A separate item keeps
    -- previous device delivery receipts immutable and permits one new delivery.
    update attention_items set status='cancelled',snoozed_until=next_time,locked_by=null,locked_until=null,updated_at=now() where id=a.id;
    update work_contexts set reminder_at=next_time,revision=revision+1,updated_at=now() where id=w.id;
    perform work_refresh_attention(w.id);
  end if;
end $$;

create function public.prune_work_contexts()
returns integer language plpgsql security definer set search_path=public as $$
declare w work_contexts; n integer:=0;
begin
  for w in select * from work_contexts where forgotten_at is null and expires_at<=clock_timestamp() limit 100 for update skip locked loop
    update work_contexts set goal='',progress='',next_step='',source_refs='[]',missing_fields='{}',deadline_at=null,reminder_at=null,
      deadline_reminder=false,resume_reminder=false,forgotten_at=clock_timestamp(),revision=revision+1,updated_at=now() where id=w.id;
    perform work_refresh_attention(w.id); n:=n+1;
  end loop;
  return n;
end $$;

-- Owner read RPCs return the stored rows and current approval projection. They
-- never invent success or copy current task/calendar contents into memory.
create function public.list_work_contexts()
returns jsonb language sql stable security invoker set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(w) order by w.updated_at desc),'[]') from work_contexts w
    where w.owner_id=auth.uid() and w.forgotten_at is null and (w.expires_at is null or w.expires_at>now())
$$;
create function public.get_work_snapshot(p_context_id uuid)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare w work_contexts; actions jsonb; attention jsonb;
begin
  select * into w from work_contexts where id=p_context_id and owner_id=auth.uid() and forgotten_at is null and (expires_at is null or expires_at>now());
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('action',to_jsonb(a),'draft',to_jsonb(d),'approval',to_jsonb(p)) order by a.created_at,a.ordinal),'[]') into actions
    from work_context_actions a join dialogue_action_drafts d on d.id=a.draft_id left join approval_requests p on p.id=a.approval_id where a.context_id=w.id;
  select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('deliveries',(select jsonb_build_object(
    'accepted',count(*) filter(where provider_state='accepted'),'received',count(*) filter(where received_at is not null),
    'opened',count(*) filter(where opened_at is not null),'failed',count(*) filter(where provider_state in ('failed','gone')),
    'uncertain',count(*) filter(where provider_state in ('uncertain','attempted'))) from notification_deliveries where attention_id=a.id)) order by a.due_at desc),'[]')
    into attention from attention_items a where a.context_id=w.id and a.status<>'cancelled';
  return jsonb_build_object('context',to_jsonb(w),'actions',actions,'attention',attention);
end $$;
create function public.list_work_attention()
returns jsonb language sql stable security invoker set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('deliveries',(select jsonb_build_object(
    'accepted',count(*) filter(where provider_state='accepted'),'received',count(*) filter(where received_at is not null),
    'opened',count(*) filter(where opened_at is not null),'failed',count(*) filter(where provider_state in ('failed','gone')),
    'uncertain',count(*) filter(where provider_state in ('uncertain','attempted'))) from notification_deliveries where attention_id=a.id)) order by a.due_at desc),'[]') from
    (select a.* from attention_items a join work_contexts w on w.id=a.context_id where a.owner_id=auth.uid()
      and w.forgotten_at is null and (w.expires_at is null or w.expires_at>now()) and a.status not in ('cancelled','acknowledged')
      and a.due_at<=now() order by a.due_at desc limit 100) a
$$;

revoke all on function public.assert_work_draft_current(uuid) from public,anon,authenticated,service_role;
revoke all on function public.guard_work_approval() from public,anon,authenticated,service_role;
revoke all on function public.sync_work_approval_link() from public,anon,authenticated,service_role;
revoke all on function public.guard_work_domain_write() from public,anon,authenticated,service_role;
revoke all on function public.work_attention_valid(public.work_contexts,public.attention_items) from public,anon,authenticated,service_role;
revoke all on function public.mutate_work_context(text,uuid,integer,uuid,text,jsonb) from public,anon,service_role;
revoke all on function public.link_work_drafts(uuid,integer,uuid,text,uuid[]) from public,anon,service_role;
revoke all on function public.mutate_work_attention(uuid,text) from public,anon,service_role;
revoke all on function public.list_work_contexts() from public,anon,service_role;
revoke all on function public.get_work_snapshot(uuid) from public,anon,service_role;
revoke all on function public.list_work_attention() from public,anon,service_role;
grant execute on function public.mutate_work_context(text,uuid,integer,uuid,text,jsonb) to authenticated;
grant execute on function public.link_work_drafts(uuid,integer,uuid,text,uuid[]) to authenticated;
grant execute on function public.mutate_work_attention(uuid,text) to authenticated;
grant execute on function public.list_work_contexts() to authenticated;
grant execute on function public.get_work_snapshot(uuid) to authenticated;
grant execute on function public.list_work_attention() to authenticated;
revoke all on function public.ack_work_delivery(uuid,text) from public,anon,service_role;
grant execute on function public.ack_work_delivery(uuid,text) to authenticated;
revoke all on function public.claim_work_attention(text,boolean) from public,anon,authenticated;
revoke all on function public.begin_work_delivery(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.finish_work_delivery(uuid,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.finish_work_attention(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.prune_work_contexts() from public,anon,authenticated;
revoke all on function public.get_claimed_work_subscriptions(uuid) from public,anon,authenticated;
grant execute on function public.claim_work_attention(text,boolean) to service_role;
grant execute on function public.begin_work_delivery(uuid,text,uuid) to service_role;
grant execute on function public.finish_work_delivery(uuid,text,uuid,text,text) to service_role;
grant execute on function public.finish_work_attention(uuid,text,text,text) to service_role;
grant execute on function public.prune_work_contexts() to service_role;
grant execute on function public.get_claimed_work_subscriptions(uuid) to service_role;
