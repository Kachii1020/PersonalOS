-- Work chat idempotency. No raw transcript is retained; only structured replies.
alter table public.work_context_requests drop constraint work_context_requests_operation_check;
alter table public.work_context_requests add constraint work_context_requests_operation_check check(operation in ('create','update','status','forget','link','chat'));
alter table public.work_context_requests alter column context_id drop not null;
alter table public.work_context_requests alter column result_revision drop not null;
alter table public.work_context_requests add column response jsonb;
alter table public.work_context_requests add column response_expires_at timestamptz;
alter table public.work_context_requests add column lease_token uuid;
alter table public.work_context_requests add column lease_until timestamptz;
alter table public.work_context_requests add constraint work_request_nonchat_identity check(operation='chat' or (context_id is not null and result_revision is not null));
alter table public.work_context_requests add constraint work_reply_size check(response is null or octet_length(response::text)<=100000);

create function public.reserve_work_chat(p_owner_id uuid,p_request_id uuid,p_hash text,p_context_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r work_context_requests;
begin
  if p_request_id is null or p_hash !~ '^[0-9a-f]{64}$' or not exists(select 1 from auth.users where id=p_owner_id and email=(select value from app_config where key='allowed_email')) then raise exception 'not allowed' using errcode='42501'; end if;
  if p_context_id is not null and not exists(select 1 from work_contexts where id=p_context_id and owner_id=p_owner_id and forgotten_at is null) then raise exception 'context unavailable' using errcode='42501'; end if;
  insert into work_context_requests(owner_id,request_id,operation,request_hash,input_hash,context_id,response_expires_at)
    values(p_owner_id,p_request_id,'chat',p_hash,p_hash,p_context_id,clock_timestamp()+interval '15 minutes') on conflict do nothing;
  select * into strict r from work_context_requests where owner_id=p_owner_id and request_id=p_request_id and operation='chat' for update;
  if r.request_hash is distinct from p_hash or r.context_id is distinct from p_context_id then raise exception 'request id reused with different input'; end if;
  if r.response is not null and r.response_expires_at>clock_timestamp() then return jsonb_build_object('cached',r.response); end if;
  if r.response_expires_at is not null and r.response_expires_at<=clock_timestamp() then raise exception 'request expired; use a new request id'; end if;
  if r.lease_until>clock_timestamp() then raise exception 'request is still processing'; end if;
  update work_context_requests set lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '3 minutes'
   where owner_id=p_owner_id and request_id=p_request_id and operation='chat' returning * into r;
  return jsonb_build_object('token',r.lease_token);
end $$;

create function public.finish_work_chat(p_owner_id uuid,p_request_id uuid,p_token uuid,p_response jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare r work_context_requests;
begin
  select * into strict r from work_context_requests where owner_id=p_owner_id and request_id=p_request_id and operation='chat' for update;
  if p_token is null or r.lease_token is distinct from p_token or r.lease_until is null or r.lease_until<=clock_timestamp() then raise exception 'chat lease lost'; end if;
  if r.context_id is not null and not exists(select 1 from work_contexts where id=r.context_id and owner_id=p_owner_id and forgotten_at is null) then raise exception 'context forgotten'; end if;
  update work_context_requests set response=p_response,response_expires_at=clock_timestamp()+interval '15 minutes',lease_token=null,lease_until=null
    where owner_id=p_owner_id and request_id=p_request_id and operation='chat';
end $$;
create function public.release_work_chat(p_owner_id uuid,p_request_id uuid,p_token uuid)
returns void language sql security definer set search_path=public as $$
 update work_context_requests set lease_token=null,lease_until=null where owner_id=p_owner_id and request_id=p_request_id and operation='chat' and p_token is not null and lease_token=p_token;
$$;
create function public.scrub_forgotten_work_chat()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.forgotten_at is not null then
   update work_context_requests set response=null,response_expires_at=now(),lease_token=null,lease_until=null where context_id=new.id and operation='chat';
   delete from dialogue_action_drafts where owner_id=new.owner_id and source_snapshot->>'workContextId'=new.id::text and approval_request_id is null;
 end if;
 return new;
end $$;
create trigger scrub_forgotten_work_chat after update of forgotten_at on public.work_contexts for each row execute function public.scrub_forgotten_work_chat();
revoke all on function public.reserve_work_chat(uuid,uuid,text,uuid),public.finish_work_chat(uuid,uuid,uuid,jsonb),public.release_work_chat(uuid,uuid,uuid),public.scrub_forgotten_work_chat() from public,anon,authenticated;
grant execute on function public.reserve_work_chat(uuid,uuid,text,uuid),public.finish_work_chat(uuid,uuid,uuid,jsonb),public.release_work_chat(uuid,uuid,uuid) to service_role;

create function public.bind_work_preview(p_owner_id uuid,p_context_id uuid,p_request_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from work_contexts where id=p_context_id and owner_id=p_owner_id and forgotten_at is null) then raise exception 'context unavailable'; end if;
 update work_context_requests set context_id=p_context_id,response=null,response_expires_at=clock_timestamp(),lease_token=null,lease_until=null
  where owner_id=p_owner_id and request_id=p_request_id and operation='chat' and context_id is null and response->>'mode'='preview';
end $$;
create function public.prune_work_chat() returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 update work_context_requests set response=null,lease_token=null,lease_until=null where operation='chat' and response_expires_at<=clock_timestamp() and response is not null;
 get diagnostics n=row_count; return n;
end $$;
revoke all on function public.bind_work_preview(uuid,uuid,uuid),public.prune_work_chat() from public,anon,authenticated;
grant execute on function public.bind_work_preview(uuid,uuid,uuid),public.prune_work_chat() to service_role;
