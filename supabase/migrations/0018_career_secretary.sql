-- Phase 5B. Additive; legacy Notion applications and Learn/Quiz are untouched.
-- Forward recovery: disable career monitoring, retain snapshots/cases, forward-fix.
create table public.career_profile (
  singleton boolean primary key default true check (singleton),
  facts jsonb not null default '{}' check (jsonb_typeof(facts) = 'object' and octet_length(facts::text) <= 30000),
  revision integer not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.career_profile (singleton) values (true);

create table public.company_watchlist (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 160),
  reason text not null default '' check (length(reason) <= 1000),
  official_prefixes jsonb not null check (jsonb_typeof(official_prefixes) = 'array' and jsonb_array_length(official_prefixes) between 1 and 10),
  tier smallint not null default 2 check (tier in (1, 2, 3)),
  enabled boolean not null default true,
  window_start timestamptz,
  window_end timestamptz,
  verified_at timestamptz not null default now(),
  check (tier <> 3 or (window_start is not null and window_end is not null and window_end > window_start))
);
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_watchlist(id),
  canonical_url text not null unique check (length(canonical_url) <= 2048 and canonical_url ~ '^https://'),
  title text not null check (length(title) between 1 and 300),
  opportunity_type text not null default 'job' check (opportunity_type in ('job','internship','program','event','other')),
  source_class text not null default 'official_posting' check (source_class in ('official_posting','official_program','official_faq')),
  lifecycle text not null default 'unknown' check (lifecycle in ('open','upcoming','closed','unknown')),
  deadline timestamptz, location text, work_mode text,
  fit smallint not null default 0 check (fit between 0 and 100),
  value smallint not null default 0 check (value between 0 and 100),
  effort smallint not null default 0 check (effort between 0 and 100),
  deliverable_key text,
  decision text not null default 'none' check (decision in ('none','reject','defer')),
  decision_reason text, defer_until timestamptz,
  decision_history jsonb not null default '[]',
  revision integer not null default 0,
  current_source_id uuid,
  source_available boolean not null default false,
  source_reviewed boolean not null default false,
  requirements_complete boolean not null default false,
  extracted_source_id uuid,
  last_checked_at timestamptz, last_error text,
  last_meaningful_change_at timestamptz,
  etag text, last_modified text,
  next_check_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (decision = 'none' or (decision_reason is not null and length(trim(decision_reason)) > 0))
);
create index opportunities_due_idx on public.opportunities (next_check_at);
create table public.opportunity_sources (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id),
  source_url text not null,
  source_class text not null check (source_class in ('official_posting','official_program','official_faq')),
  http_status integer not null default 200,
  etag text, last_modified text,
  supersedes_source_id uuid,
  title text not null,
  content_text text not null check (octet_length(content_text) <= 2100000),
  content_hash text not null check (length(content_hash) = 64),
  retrieved_at timestamptz not null default now(),
  unique (opportunity_id, content_hash),
  unique (opportunity_id, id),
  foreign key (opportunity_id, supersedes_source_id) references public.opportunity_sources(opportunity_id, id)
);
alter table public.opportunities add constraint opportunities_source_fk
  foreign key (id, current_source_id) references public.opportunity_sources(opportunity_id, id);
create table public.opportunity_requirements (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id),
  source_id uuid not null,
  field text not null check (field in ('graduation_date','academic_year','degree','major','university','residence','work_authorization','languages','available_from','available_until','weekly_days','skills')),
  operator text not null check (operator in ('eq','one_of','all_of','gte','lte','between','not_required','unknown')),
  expected jsonb not null default 'null',
  hard boolean not null default true,
  quote text not null check (length(quote) <= 4000),
  reviewed boolean not null default false check (not reviewed or length(trim(quote)) > 0),
  foreign key (opportunity_id, source_id) references public.opportunity_sources(opportunity_id, id)
);
create table public.application_cases (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.opportunities(id),
  stage text not null default 'preparing' check (stage in ('preparing','submitted','interview','offer','rejected','withdrawn')),
  next_action text not null check (length(next_action) between 1 and 300),
  due_at timestamptz,
  documents text not null default '', interviews text not null default '', contact text not null default '',
  result text not null default '', decision_reason text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Authenticated clients may read their single-user domain, but cannot forge worker evidence.
do $$ declare t text; begin
  foreach t in array array['career_profile','company_watchlist','opportunities','opportunity_sources','opportunity_requirements','application_cases'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format('create policy career_owner_read on public.%I for select to authenticated using (public.is_allowed_user())', t);
  end loop;
end $$;

-- Mutations are intentionally enumerated: no generic table/column update API.
create function public.career_mutate(p_action text, p_id uuid default null, p_input jsonb default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_opp opportunities; v_source opportunity_sources; r jsonb;
begin
  if not public.is_allowed_user() then raise exception 'not allowed' using errcode = '42501'; end if;
  if octet_length(p_input::text) > 100000 then raise exception 'input too large'; end if;
  case p_action
  when 'profile' then
    update career_profile set facts = p_input->'facts', revision = revision + 1, updated_at = now() where singleton;
    return null;
  when 'company' then
    insert into company_watchlist (name, reason, official_prefixes, tier, window_start, window_end)
      values (p_input->>'name', coalesce(p_input->>'reason',''), p_input->'officialPrefixes', (p_input->>'tier')::smallint,
        (p_input->>'windowStart')::timestamptz, (p_input->>'windowEnd')::timestamptz) returning id into v_id;
    return v_id;
  when 'capture' then
    insert into opportunities (company_id, canonical_url, title, opportunity_type, source_class)
      values ((p_input->>'companyId')::uuid, p_input->>'url', p_input->>'title',
        coalesce(p_input->>'opportunityType','job'), coalesce(p_input->>'sourceClass','official_posting'))
      on conflict (canonical_url) do nothing returning id into v_id;
    if v_id is null then
      select id into v_id from opportunities where canonical_url = p_input->>'url';
      return v_id;
    end if;
    insert into system_events (event_type, source_type, source_id, dedupe_key)
      values ('career.refresh','opportunity',v_id::text,'career:capture:' || v_id::text);
    return v_id;
  when 'case_update' then
    update application_cases set stage = p_input->>'stage', next_action = p_input->>'nextAction',
      due_at = (p_input->>'dueAt')::timestamptz, documents = p_input->>'documents',
      interviews = p_input->>'interviews', contact = p_input->>'contact', result = p_input->>'result',
      decision_reason = p_input->>'decisionReason', updated_at = now() where id = p_id returning id into v_id;
    if v_id is null then raise exception 'case missing'; end if;
    return v_id;
  else null;
  end case;
  select * into strict v_opp from opportunities where id = p_id for update;
  case p_action
  when 'refresh' then
    insert into system_events (event_type, source_type, source_id, dedupe_key)
      values ('career.refresh','opportunity',p_id::text,'career:manual:' || p_id::text || ':' || floor(extract(epoch from now()) / 60)::text)
      on conflict (dedupe_key) do nothing;
  when 'review' then
    if v_opp.revision is distinct from (p_input->>'revision')::integer or not v_opp.source_available
      or v_opp.last_checked_at < now() - interval '8 days' then raise exception 'source changed or stale; refresh first'; end if;
    select * into strict v_source from opportunity_sources where id = v_opp.current_source_id;
    if jsonb_typeof(p_input->'requirements') <> 'array' or jsonb_array_length(p_input->'requirements') > 50 then raise exception 'invalid requirements'; end if;
    delete from opportunity_requirements where opportunity_id = p_id;
    for r in select value from jsonb_array_elements(p_input->'requirements') loop
      if (r->>'sourceId')::uuid is distinct from v_source.id or not coalesce((r->>'reviewed')::boolean,false)
        or position(regexp_replace(normalize(trim(r->>'quote'), NFKC), '\s+', ' ', 'g') in
          regexp_replace(normalize(v_source.content_text, NFKC), '\s+', ' ', 'g')) = 0 then raise exception 'unverified quote'; end if;
      insert into opportunity_requirements (opportunity_id, source_id, field, operator, expected, hard, quote, reviewed)
        values (p_id,v_source.id,r->>'field',r->>'operator',r->'expected',(r->>'hard')::boolean,r->>'quote',true);
    end loop;
    update opportunities set title = p_input->>'title', lifecycle = p_input->>'lifecycle',
      deadline = (p_input->>'deadline')::timestamptz, location = p_input->>'location', work_mode = p_input->>'workMode',
      fit = (p_input->>'fit')::smallint, value = (p_input->>'value')::smallint, effort = (p_input->>'effort')::smallint,
      deliverable_key = nullif(trim(p_input->>'deliverableKey'),''),
      source_reviewed = true, requirements_complete = (p_input->>'complete')::boolean,
      extracted_source_id = v_source.id, revision = revision + 1 where id = p_id;
  when 'decision' then
    update opportunities set decision = p_input->>'decision',
      decision_reason = case when p_input->>'decision' = 'none' then coalesce(nullif(trim(p_input->>'reason'),''),decision_reason) else p_input->>'reason' end,
      decision_history = decision_history || jsonb_build_array(jsonb_build_object('decision',p_input->>'decision','reason',p_input->>'reason','at',now())),
      defer_until = (p_input->>'deferUntil')::timestamptz where id = p_id;
  when 'case' then
    if not v_opp.source_reviewed or not v_opp.requirements_complete or not v_opp.source_available
      or v_opp.lifecycle <> 'open' or v_opp.decision <> 'none' or v_opp.last_checked_at < now() - interval '8 days'
      or (v_opp.deadline is not null and v_opp.deadline <= now()) then raise exception 'review current eligibility first'; end if;
    insert into application_cases (opportunity_id,next_action,due_at)
      values (p_id,p_input->>'nextAction',(p_input->>'dueAt')::timestamptz)
      on conflict (opportunity_id) do nothing returning id into v_id;
    if v_id is null then select id into v_id from application_cases where opportunity_id = p_id; end if;
    insert into system_events (event_type,source_type,source_id,dedupe_key)
      values ('career.application_started','application_case',v_id::text,'career:case:' || v_id::text)
      on conflict (dedupe_key) do nothing;
    return v_id;
  else raise exception 'unsupported career command';
  end case;
  return p_id;
end $$;
revoke all on function public.career_mutate(text,uuid,jsonb) from public, anon, service_role;
grant execute on function public.career_mutate(text,uuid,jsonb) to authenticated;

-- A checked source and its run progress are committed together. Compare-and-set
-- prevents a late network response or expired lease from replacing newer review.
create function public.commit_career_step(p_run_id uuid, p_worker_id text, p_opportunity_id uuid, p_revision integer, p_kind text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_run agent_runs; v_opp opportunities; v_source uuid; v_changed boolean; r jsonb;
begin
  select * into strict v_run from agent_runs where id = p_run_id for update;
  if v_run.locked_by is distinct from p_worker_id or v_run.locked_until is null
    or v_run.locked_until <= clock_timestamp() or v_run.current_step <> 'classify'
    or v_run.state->>'sourceId' is distinct from p_opportunity_id::text
    then raise exception 'career lease lost'; end if;
  select * into strict v_opp from opportunities where id = p_opportunity_id for update;
  if v_run.locked_until <= clock_timestamp() then raise exception 'career lease expired while waiting'; end if;
  if v_opp.revision is distinct from p_revision then
    update agent_runs set status='completed',current_step='done',output='{"superseded":true}',finished_at=now(),locked_by=null,locked_until=null where id=p_run_id;
    return false;
  end if;
  if p_kind = 'source' then
    if p_data->>'kind' in ('ok','not_modified') and p_data->>'checkedAt' is null then
      raise exception 'source check timestamp required';
    end if;
    if p_data->>'kind' = 'ok' then
      insert into opportunity_sources (opportunity_id,source_url,source_class,http_status,etag,last_modified,
        supersedes_source_id,retrieved_at,title,content_text,content_hash)
        values (v_opp.id,p_data->>'url',v_opp.source_class,200,p_data->>'etag',p_data->>'lastModified',
          v_opp.current_source_id,(p_data->>'checkedAt')::timestamptz,p_data->>'title',p_data->>'text',p_data->>'contentHash')
        on conflict (opportunity_id,content_hash) do nothing returning id into v_source;
      if v_source is null then select id into v_source from opportunity_sources where opportunity_id=v_opp.id and content_hash=p_data->>'contentHash'; end if;
      v_changed := v_source is distinct from v_opp.current_source_id;
      update opportunities set current_source_id=v_source,source_available=true,last_error=null,
        -- Use the collecting worker's observed check time, not the DB server's
        -- clock (which can be milliseconds ahead and look like future evidence).
        last_checked_at=(p_data->>'checkedAt')::timestamptz,etag=p_data->>'etag',last_modified=p_data->>'lastModified',
        last_meaningful_change_at=case when v_changed then (p_data->>'checkedAt')::timestamptz else last_meaningful_change_at end,
        source_reviewed=case when v_changed then false else source_reviewed end,
        requirements_complete=case when v_changed then false else requirements_complete end,
        revision=revision+1,next_check_at=(p_data->>'nextCheckAt')::timestamptz where id=v_opp.id;
      if v_changed or (v_opp.extracted_source_id is distinct from v_source and not v_opp.source_reviewed) then
        insert into system_events (event_type,source_type,source_id,payload,dedupe_key)
          values ('opportunity.source_changed','opportunity',v_opp.id::text,jsonb_build_object('sourceId',v_source,'supersedesSourceId',v_opp.current_source_id),
            'career:changed:' || v_opp.id::text || ':' || (v_opp.revision+1)::text);
      end if;
    elsif p_data->>'kind' = 'not_modified' and v_opp.current_source_id is not null then
      update opportunities set source_available=true,last_checked_at=(p_data->>'checkedAt')::timestamptz,last_error=null,
        revision=revision+1,next_check_at=(p_data->>'nextCheckAt')::timestamptz where id=v_opp.id;
      if v_opp.extracted_source_id is distinct from v_opp.current_source_id and not v_opp.source_reviewed then
        insert into system_events (event_type,source_type,source_id,dedupe_key)
          values ('opportunity.source_changed','opportunity',v_opp.id::text,
            'career:changed:' || v_opp.id::text || ':' || (v_opp.revision+1)::text);
      end if;
    else
      update opportunities set source_available=false,last_error=coalesce(p_data->>'error','Official source unavailable'),
        revision=revision+1,next_check_at=(p_data->>'nextCheckAt')::timestamptz where id=v_opp.id;
    end if;
  elsif p_kind = 'extraction' then
    if v_opp.source_reviewed then raise exception 'source already reviewed'; end if;
    delete from opportunity_requirements where opportunity_id=v_opp.id;
    for r in select value from jsonb_array_elements(p_data->'requirements') loop
      insert into opportunity_requirements (opportunity_id,source_id,field,operator,expected,hard,quote,reviewed)
        values (v_opp.id,v_opp.current_source_id,r->>'field',r->>'operator',r->'expected',(r->>'hard')::boolean,r->>'quote',false);
    end loop;
    update opportunities set extracted_source_id=current_source_id, title=p_data->>'title', lifecycle='unknown',
      deadline=(p_data->>'deadline')::timestamptz,requirements_complete=false,last_error=null,revision=revision+1 where id=v_opp.id;
  else raise exception 'unsupported career step'; end if;
  update agent_runs set status=case when p_kind='source' and p_data->>'kind'='unavailable' then 'failed' else 'completed' end,
    current_step='done',output=jsonb_build_object('kind',p_kind,'opportunityId',v_opp.id),
    finished_at=now(),updated_at=now(),locked_by=null,locked_until=null,
    error=case when p_kind='source' and p_data->>'kind'='unavailable' then coalesce(p_data->>'error','Official source unavailable') else null end where id=p_run_id;
  return true;
end $$;
revoke all on function public.commit_career_step(uuid,text,uuid,integer,text,jsonb) from public, anon, authenticated;
grant execute on function public.commit_career_step(uuid,text,uuid,integer,text,jsonb) to service_role;

create function public.queue_due_career_sources(p_limit integer default 10)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in select o.id,o.next_check_at from opportunities o join company_watchlist c on c.id=o.company_id
    where c.enabled and o.next_check_at<=now()
      and (c.tier<>3 or now() between c.window_start and c.window_end)
    order by o.next_check_at limit greatest(1,least(p_limit,20)) for update of o skip locked loop
    insert into system_events(event_type,source_type,source_id,dedupe_key)
      values ('career.refresh','opportunity',r.id::text,'career:due:' || r.id::text || ':' || r.next_check_at::text)
      on conflict(dedupe_key) do nothing;
    n := n + 1;
    -- A failed worker is retried after one hour; successful checks set the cadence.
    update opportunities set next_check_at=now()+interval '1 hour' where id=r.id;
  end loop;
  return n;
end $$;
revoke all on function public.queue_due_career_sources(integer) from public, anon, authenticated;
grant execute on function public.queue_due_career_sources(integer) to service_role;
