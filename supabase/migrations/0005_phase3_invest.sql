-- Phase 3 — 투자·포트폴리오·지원 파이프라인
-- SPEC.md 4절의 tickers, price_snapshots, fx_rates, github_repos, github_daily_commits.

-- ============ 투자 ============
create table tickers (
  id            uuid primary key default gen_random_uuid(),
  symbol        text not null unique,
  display_name  text not null,
  currency      text not null,          -- USD | KRW | JPY
  is_index      boolean not null default false,
  notion_page_id text,
  position      int not null default 0
);

create table price_snapshots (
  id            bigserial primary key,
  ticker_id     uuid not null references tickers(id) on delete cascade,
  as_of         date not null,
  close         numeric(18,4) not null,
  change_pct    numeric(8,4),
  unique (ticker_id, as_of)
);

create table fx_rates (
  id            bigserial primary key,
  as_of         date not null,
  base          text not null,
  quote         text not null,
  rate          numeric(18,6) not null,
  unique (as_of, base, quote)
);

-- ============ GitHub ============
create table github_repos (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null unique,
  description   text,
  language      text,
  stars         int not null default 0,
  pushed_at     timestamptz,
  html_url      text not null
);

create table github_daily_commits (
  id            bigserial primary key,
  as_of         date not null unique,
  commit_count  int not null
);

-- ============ RLS + 권한 ============
-- 0001에서 grant all on all tables는 그 시점 테이블만 커버한다.
-- 뒤에 만든 테이블은 별도로 GRANT 해야 service_role이 접근 가능하다.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

do $$
declare t text;
begin
  foreach t in array array[
    'tickers', 'price_snapshots', 'fx_rates',
    'github_repos', 'github_daily_commits'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy allowed_user_all on %I for all to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user())',
      t
    );
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated;
