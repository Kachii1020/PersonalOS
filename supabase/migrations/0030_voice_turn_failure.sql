-- Keep failed Phase 7 processing visible without storing provider response bodies.
create function public.fail_voice_turn(p_owner_id uuid,p_turn_id uuid,p_error_code text)
returns public.voice_turns language plpgsql security definer set search_path=public,pg_temp as $$
declare current public.voice_turns;
begin
  update voice_turns
    set status='failed',completed_at=clock_timestamp(),error_code=left(coalesce(nullif(trim(p_error_code),''),'VoiceTurnError'),80)
    where id=p_turn_id and owner_id=p_owner_id and status in ('processing','failed')
    returning * into current;
  if not found then raise exception 'voice turn unavailable' using errcode='PT409'; end if;
  return current;
end $$;

revoke all on function public.fail_voice_turn(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.fail_voice_turn(uuid,uuid,text) to service_role;
