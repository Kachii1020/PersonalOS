-- Preserve existing manual task writes while protecting the approval linkage.
create function public.guard_task_approval_link()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if (tg_op = 'INSERT' and new.approval_request_id is not null)
      or (tg_op = 'UPDATE' and new.approval_request_id is distinct from old.approval_request_id) then
      raise exception 'approval link is managed by the executor' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger tasks_guard_approval_link
before insert or update on public.tasks
for each row execute function public.guard_task_approval_link();
revoke all on function public.guard_task_approval_link() from public, anon, authenticated;
