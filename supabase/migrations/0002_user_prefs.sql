-- SPEC.md 6.1의 사이드바 순서 저장소.
-- localStorage가 아니라 여기에 둬야 폰과 PC가 같은 순서를 본다.
--
-- 단일 사용자라 user_id 컬럼을 두지 않는다. 화이트리스트 1명만 통과하므로
-- 키-값 한 벌이면 충분하다.

create table user_prefs (
  key        text primary key,     -- 'sidebar_order'
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table user_prefs enable row level security;

create policy allowed_user_all on user_prefs
  for all to authenticated
  using (public.is_allowed_user())
  with check (public.is_allowed_user());

grant select, insert, update, delete on user_prefs to authenticated;
grant all on user_prefs to service_role;
