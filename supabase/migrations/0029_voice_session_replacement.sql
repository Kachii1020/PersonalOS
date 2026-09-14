-- Phase 8: an owner may explicitly replace an active foreground voice session.
-- Automatic takeover remains forbidden; replacement is serialized with the
-- existing owner budget/session lock and preserves both session audit rows.
drop function public.begin_voice_session(uuid,text,text,numeric);
create function public.begin_voice_session(p_owner_id uuid,p_mode text,p_model text,p_budget numeric,p_replace boolean default false)
returns public.voice_sessions language plpgsql security definer set search_path=public,pg_temp as $$
declare total numeric; existing public.voice_sessions; created public.voice_sessions;
begin
  if p_owner_id is null or p_mode not in ('push_to_talk','automatic') or length(trim(p_model))<1 or p_budget<=0 or p_replace is null then raise exception 'invalid voice session' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text,17));
  update voice_sessions set status='expired',ended_at=clock_timestamp(),end_reason='expired'
    where owner_id=p_owner_id and status='active' and (expires_at<=clock_timestamp() or last_activity_at<clock_timestamp()-interval '30 seconds');
  select * into existing from voice_sessions where owner_id=p_owner_id and status='active' for update;
  if found and not p_replace then raise exception 'voice session already active' using errcode='PT409'; end if;
  if found then
    update voice_sessions set status='ended',ended_at=clock_timestamp(),end_reason='replaced' where id=existing.id;
  end if;
  select coalesce(sum(s.stt_reserved_usd),0)+coalesce((select sum(t.tts_reserved_usd) from voice_turns t where t.owner_id=p_owner_id and t.started_at>=date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC'),0)
    into total from voice_sessions s where s.owner_id=p_owner_id and s.started_at>=date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
  if total+0.10>p_budget then raise exception 'voice budget exceeded' using errcode='PT402'; end if;
  insert into voice_sessions(owner_id,mode,transcription_model) values(p_owner_id,p_mode,trim(p_model)) returning * into created;
  return created;
end $$;
revoke all on function public.begin_voice_session(uuid,text,text,numeric,boolean) from public,anon,authenticated;
grant execute on function public.begin_voice_session(uuid,text,text,numeric,boolean) to service_role;
