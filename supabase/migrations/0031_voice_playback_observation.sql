alter table public.voice_turns
  add column speech_received_at timestamptz,
  add column playback_started_at timestamptz,
  add column playback_completed_at timestamptz,
  add column playback_interrupted_at timestamptz,
  add column playback_error_code text check (playback_error_code is null or length(playback_error_code) between 1 and 80);

create function public.observe_voice_playback(p_owner_id uuid,p_session_id uuid,p_turn_id uuid,p_event text,p_error_code text default null)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare current public.voice_turns;
begin
  select * into current from voice_turns where id=p_turn_id and session_id=p_session_id and owner_id=p_owner_id for update;
  if not found or current.status<>'completed' then return false; end if;
  if p_event='received' then
    update voice_turns set speech_received_at=coalesce(speech_received_at,clock_timestamp()) where id=p_turn_id;
  elsif p_event='started' then
    update voice_turns set speech_received_at=coalesce(speech_received_at,clock_timestamp()),playback_started_at=coalesce(playback_started_at,clock_timestamp()) where id=p_turn_id;
  elsif p_event='completed' then
    update voice_turns set speech_received_at=coalesce(speech_received_at,clock_timestamp()),playback_started_at=coalesce(playback_started_at,clock_timestamp()),playback_completed_at=coalesce(playback_completed_at,clock_timestamp()) where id=p_turn_id;
  elsif p_event='interrupted' then
    update voice_turns set playback_interrupted_at=coalesce(playback_interrupted_at,clock_timestamp()) where id=p_turn_id;
  elsif p_event='failed' then
    update voice_turns set playback_error_code=left(coalesce(nullif(trim(p_error_code),''),'PlaybackError'),80) where id=p_turn_id;
  else
    return false;
  end if;
  return true;
end $$;

revoke all on function public.observe_voice_playback(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.observe_voice_playback(uuid,uuid,uuid,text,text) to service_role;
