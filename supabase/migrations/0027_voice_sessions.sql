-- Phase 8: foreground voice session metadata. Never stores raw audio, transcript
-- text, spoken text, provider secrets, or generated audio.
create table public.voice_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('push_to_talk','automatic')),
  status text not null default 'active' check (status in ('active','ended','expired','failed')),
  transcription_model text not null,
  stt_reserved_usd numeric(10,4) not null default 0.1000 check (stt_reserved_usd >= 0),
  started_at timestamptz not null default clock_timestamp(),
  last_activity_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '5 minutes'),
  ended_at timestamptz,
  end_reason text check (end_reason is null or length(end_reason) between 1 and 80)
);
create unique index voice_sessions_one_active_owner on public.voice_sessions(owner_id) where status='active';
create index voice_sessions_owner_started on public.voice_sessions(owner_id,started_at desc);

create table public.voice_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.voice_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  context_id uuid references public.work_contexts(id) on delete set null,
  request_id uuid not null,
  provider_item_hash text not null check (provider_item_hash ~ '^[0-9a-f]{64}$'),
  transcript_hash text not null check (transcript_hash ~ '^[0-9a-f]{64}$'),
  reply_hash text check (reply_hash is null or reply_hash ~ '^[0-9a-f]{64}$'),
  outcome text,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  tts_attempts integer not null default 0 check (tts_attempts between 0 and 4),
  tts_reserved_usd numeric(10,4) not null default 0 check (tts_reserved_usd between 0 and 0.0800),
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  error_code text,
  unique(owner_id,request_id),
  unique(session_id,provider_item_hash)
);
create index voice_turns_session_started on public.voice_turns(session_id,started_at);

alter table public.voice_sessions enable row level security;
alter table public.voice_turns enable row level security;
revoke all on public.voice_sessions,public.voice_turns from public,anon,authenticated;
grant select on public.voice_sessions,public.voice_turns to authenticated;
grant all on public.voice_sessions,public.voice_turns to service_role;
create policy voice_sessions_owner_select on public.voice_sessions for select to authenticated using(owner_id=auth.uid() and public.is_allowed_user());
create policy voice_turns_owner_select on public.voice_turns for select to authenticated using(owner_id=auth.uid() and public.is_allowed_user());

create function public.begin_voice_session(p_owner_id uuid,p_mode text,p_model text,p_budget numeric)
returns public.voice_sessions language plpgsql security definer set search_path=public,pg_temp as $$
declare total numeric; existing public.voice_sessions; created public.voice_sessions;
begin
  if p_owner_id is null or p_mode not in ('push_to_talk','automatic') or length(trim(p_model))<1 or p_budget<=0 then raise exception 'invalid voice session' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text,17));
  update voice_sessions set status='expired',ended_at=clock_timestamp(),end_reason='expired'
    where owner_id=p_owner_id and status='active' and (expires_at<=clock_timestamp() or last_activity_at<clock_timestamp()-interval '30 seconds');
  select * into existing from voice_sessions where owner_id=p_owner_id and status='active';
  if found then raise exception 'voice session already active' using errcode='PT409'; end if;
  select coalesce(sum(s.stt_reserved_usd),0)+coalesce((select sum(t.tts_reserved_usd) from voice_turns t where t.owner_id=p_owner_id and t.started_at>=date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC'),0)
    into total from voice_sessions s where s.owner_id=p_owner_id and s.started_at>=date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
  if total+0.10>p_budget then raise exception 'voice budget exceeded' using errcode='PT402'; end if;
  insert into voice_sessions(owner_id,mode,transcription_model) values(p_owner_id,p_mode,trim(p_model)) returning * into created;
  return created;
end $$;

create function public.touch_voice_session(p_owner_id uuid,p_session_id uuid)
returns public.voice_sessions language plpgsql security definer set search_path=public,pg_temp as $$
declare current public.voice_sessions;
begin
  update voice_sessions set last_activity_at=clock_timestamp() where id=p_session_id and owner_id=p_owner_id and status='active' and expires_at>clock_timestamp() returning * into current;
  if not found then raise exception 'voice session unavailable' using errcode='PT409'; end if;
  return current;
end $$;

create function public.finish_voice_session(p_owner_id uuid,p_session_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update voice_sessions set status='ended',ended_at=clock_timestamp(),end_reason=left(coalesce(nullif(trim(p_reason),''),'user'),80)
    where id=p_session_id and owner_id=p_owner_id and status='active';
end $$;

create function public.get_voice_turn_for_owner(p_owner_id uuid,p_session_id uuid,p_turn_id uuid)
returns public.voice_turns language sql stable security definer set search_path=public,pg_temp as $$
  select * from voice_turns where id=p_turn_id and session_id=p_session_id and owner_id=p_owner_id;
$$;

create function public.reserve_voice_turn(p_owner_id uuid,p_session_id uuid,p_request_id uuid,p_provider_hash text,p_transcript_hash text,p_context_id uuid)
returns public.voice_turns language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.voice_sessions; prior public.voice_turns; created public.voice_turns;
begin
  select * into s from voice_sessions where id=p_session_id and owner_id=p_owner_id for update;
  if not found or s.status<>'active' or s.expires_at<=clock_timestamp() then raise exception 'voice session unavailable' using errcode='PT409'; end if;
  select * into prior from voice_turns where owner_id=p_owner_id and request_id=p_request_id;
  if found then
    if prior.session_id is distinct from p_session_id or prior.provider_item_hash is distinct from p_provider_hash or prior.transcript_hash is distinct from p_transcript_hash or prior.context_id is distinct from p_context_id then raise exception 'voice request id reused' using errcode='PT409'; end if;
    return prior;
  end if;
  if (select count(*) from voice_turns where session_id=p_session_id)>=8 then raise exception 'voice turn limit reached' using errcode='PT409'; end if;
  insert into voice_turns(session_id,owner_id,context_id,request_id,provider_item_hash,transcript_hash)
    values(p_session_id,p_owner_id,p_context_id,p_request_id,p_provider_hash,p_transcript_hash) returning * into created;
  update voice_sessions set last_activity_at=clock_timestamp() where id=p_session_id;
  return created;
end $$;

create function public.finish_voice_turn(p_owner_id uuid,p_turn_id uuid,p_reply_hash text,p_outcome text,p_context_id uuid)
returns public.voice_turns language plpgsql security definer set search_path=public,pg_temp as $$
declare current public.voice_turns;
begin
  update voice_turns set reply_hash=p_reply_hash,outcome=left(p_outcome,40),context_id=p_context_id,status='completed',completed_at=clock_timestamp(),error_code=null
    where id=p_turn_id and owner_id=p_owner_id and status in ('processing','completed')
    returning * into current;
  if not found then raise exception 'voice turn unavailable' using errcode='PT409'; end if;
  return current;
end $$;

create function public.reserve_voice_speech(p_owner_id uuid,p_turn_id uuid,p_reply_hash text,p_attempt integer,p_budget numeric)
returns public.voice_turns language plpgsql security definer set search_path=public,pg_temp as $$
declare current public.voice_turns; total numeric;
begin
  if p_attempt not between 1 and 4 or p_budget<=0 then raise exception 'invalid voice speech request' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text,17));
  select * into current from voice_turns where id=p_turn_id and owner_id=p_owner_id for update;
  if not found or current.status<>'completed' or current.reply_hash is distinct from p_reply_hash then raise exception 'voice speech unavailable' using errcode='PT409'; end if;
  if not exists(select 1 from voice_sessions s where s.id=current.session_id and s.owner_id=p_owner_id and s.status='active' and s.expires_at>clock_timestamp()) then raise exception 'voice session unavailable' using errcode='PT409'; end if;
  if current.tts_attempts<>p_attempt-1 then raise exception 'voice speech already used' using errcode='PT409'; end if;
  select coalesce(sum(s.stt_reserved_usd),0)+coalesce((select sum(t.tts_reserved_usd) from voice_turns t where t.owner_id=p_owner_id and t.started_at>=date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC'),0)
    into total from voice_sessions s where s.owner_id=p_owner_id and s.started_at>=date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
  if total+0.02>p_budget then raise exception 'voice budget exceeded' using errcode='PT402'; end if;
  update voice_turns set tts_attempts=p_attempt,tts_reserved_usd=tts_reserved_usd+0.02 where id=p_turn_id returning * into current;
  return current;
end $$;

create function public.prune_voice_metadata()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare affected integer;
begin
  delete from voice_sessions where started_at<clock_timestamp()-interval '30 days';
  get diagnostics affected=row_count; return affected;
end $$;

revoke all on function public.begin_voice_session(uuid,text,text,numeric),public.touch_voice_session(uuid,uuid),public.finish_voice_session(uuid,uuid,text),public.get_voice_turn_for_owner(uuid,uuid,uuid),public.reserve_voice_turn(uuid,uuid,uuid,text,text,uuid),public.finish_voice_turn(uuid,uuid,text,text,uuid),public.reserve_voice_speech(uuid,uuid,text,integer,numeric),public.prune_voice_metadata() from public,anon,authenticated;
grant execute on function public.begin_voice_session(uuid,text,text,numeric),public.touch_voice_session(uuid,uuid),public.finish_voice_session(uuid,uuid,text),public.get_voice_turn_for_owner(uuid,uuid,uuid),public.reserve_voice_turn(uuid,uuid,uuid,text,text,uuid),public.finish_voice_turn(uuid,uuid,text,text,uuid),public.reserve_voice_speech(uuid,uuid,text,integer,numeric),public.prune_voice_metadata() to service_role;
