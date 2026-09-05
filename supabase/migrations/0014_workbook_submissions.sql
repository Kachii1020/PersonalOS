-- Learn 엑셀 과제 제출. 그리드 lab_completions와 분리한다.
-- 단일 사용자, 과제당 1행.

create table workbook_submissions (
  id            uuid primary key default gen_random_uuid(),
  task_id       text not null unique,
  storage_path  text not null,
  status        text not null,
  results       jsonb not null default '[]',
  submitted_at  timestamptz not null default now(),
  check (status in ('passed', 'failed'))
);

alter table workbook_submissions enable row level security;
create policy "workbook_submissions_all" on workbook_submissions
  for all to authenticated
  using (public.is_allowed_user())
  with check (public.is_allowed_user());

grant select, insert, update, delete on workbook_submissions to authenticated;
grant all on workbook_submissions to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'learn-workbooks',
  'learn-workbooks',
  false,
  5242880,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do nothing;

create policy learn_workbooks_allowed on storage.objects
  for all to authenticated
  using (bucket_id = 'learn-workbooks' and public.is_allowed_user())
  with check (bucket_id = 'learn-workbooks' and public.is_allowed_user());
