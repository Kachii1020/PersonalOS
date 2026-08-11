-- SPEC.md 5.3 — FRED API (미국 매크로), ECOS API (한국 매크로) 저장용.
-- SPEC 4절 스키마에는 없지만 5.3의 데이터 소스에 포함된 항목이다.

create table macro_snapshots (
  id            bigserial primary key,
  source        text not null,          -- 'fred' | 'ecos'
  series_id     text not null,
  display_name  text not null,
  as_of         date not null,
  value         numeric(18,4) not null,
  unit          text,
  unique (source, series_id, as_of)
);

-- RLS + 권한 (0005와 같은 패턴)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter table macro_snapshots enable row level security;
create policy allowed_user_all on macro_snapshots
  for all to authenticated
  using (public.is_allowed_user())
  with check (public.is_allowed_user());
grant select, insert, update, delete on macro_snapshots to authenticated;
grant usage, select on all sequences in schema public to authenticated;
