-- Migration: Interactive Excel Lab completions
-- Tracks which hardcoded lab exercises the single user has passed.
-- Does not alter existing learn_* or quiz_* tables.

create table lab_completions (
  id           uuid primary key default gen_random_uuid(),
  exercise_id  text not null unique,     -- 'basic-fn-sum' (단일 유저, 문제당 1행)
  module_slug  text not null,            -- 'basic-fn'
  completed_at timestamptz not null default now()
);

create index on lab_completions (module_slug);

alter table lab_completions enable row level security;
create policy "lab_completions_all" on lab_completions
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

grant select, insert, update, delete on lab_completions to authenticated;
grant all on lab_completions to service_role;
