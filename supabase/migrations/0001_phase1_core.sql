-- Phase 1 — 캘린더, 태스크, 뉴스, 브리핑, 운영 로그
-- SPEC.md 4절. Phase 2·3 테이블(quiz_*, semesters, courses, course_materials,
-- tickers, price_snapshots, fx_rates, github_*)은 해당 Phase의 마이그레이션에서 만든다.
--
-- events.course_id / tasks.course_id는 courses가 Phase 2라 여기서 뺐다.
-- Phase 2 마이그레이션에서 alter table로 추가한다. 이 파일은 수정하지 않는다.

-- ============ 화이트리스트 ============
-- 단일 사용자지만 RLS는 켠다 (SPEC.md 4절 말미).
-- 허용 이메일은 커밋하지 않는다. supabase/seed.sql이 채우고, 그 파일은 .gitignore에 있다.
-- 값이 없으면 is_allowed_user()가 false를 반환해 전부 막힌다 (fail-closed).

create table app_config (
  key   text primary key,
  value text not null
);

alter table app_config enable row level security;
-- 정책 없음: 서비스 롤만 접근한다.

create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_config
    where key = 'allowed_email'
      and value = (auth.jwt() ->> 'email')
  );
$$;

-- ============ 캘린더 ============
create table calendars (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null default 'caldav',  -- 'caldav' | 'ics'
  source_url    text not null unique,            -- CalDAV href 또는 ICS 피드 URL
  display_name  text not null,
  color         text,
  is_writable   boolean not null default false,  -- 앱 전용 캘린더만 true
  ctag          text,                            -- caldav 전용
  content_hash  text,                            -- ics 전용, 변경 감지
  last_synced_at timestamptz,
  check (kind = 'caldav' or is_writable = false) -- ICS는 절대 쓰기 불가
);

create table events (
  id            uuid primary key default gen_random_uuid(),
  calendar_id   uuid not null references calendars(id) on delete cascade,
  caldav_uid    text not null,
  caldav_href   text not null,
  etag          text,
  summary       text not null,
  description   text,
  location      text,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  is_all_day    boolean not null default false,
  rrule         text,
  source        text not null default 'icloud',  -- 'icloud' | 'app' | 'waseda'
  updated_at    timestamptz not null default now(),
  unique (calendar_id, caldav_uid)
);
create index on events (starts_at);

-- ============ 태스크/마감 ============
create table tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  notes         text,
  due_at        timestamptz,
  status        text not null default 'open',   -- open | done | dropped
  category      text,                           -- school | career | study | invest | etc
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index on tasks (due_at) where status = 'open';

-- ============ 뉴스 / 브리핑 ============
create table news_items (
  id            uuid primary key default gen_random_uuid(),
  source_key    text not null,      -- 소스 식별자
  lang          text not null,      -- ko | en | ja
  sector        text not null,      -- finance | ai | semiconductor | it | rotating
  title         text not null,
  url           text not null unique,
  published_at  timestamptz,
  raw_summary   text,               -- RSS description 원문
  fetched_at    timestamptz not null default now()
);
create index on news_items (fetched_at desc);

create table briefings (
  id            uuid primary key default gen_random_uuid(),
  briefing_date date not null unique,
  status        text not null default 'pending', -- pending | ready | failed
  generated_at  timestamptz,
  input_token   int,
  output_token  int,
  cost_usd      numeric(10,4)
);

create table briefing_sections (
  id            uuid primary key default gen_random_uuid(),
  briefing_id   uuid not null references briefings(id) on delete cascade,
  sector        text not null,
  lang          text not null,
  headline      text not null,      -- 한국어
  bullets       text[] not null,    -- 3줄
  why_it_matters text not null,     -- 1줄
  source_urls   text[] not null,
  position      int not null
);

-- ============ 운영 ============
create table sync_state (
  key           text primary key,     -- 'caldav', 'rss', 'prices', 'github'
  last_run_at   timestamptz,
  last_status   text,                 -- ok | failed
  last_error    text,
  cursor        jsonb                 -- ctag, etag, etc
);

create table job_runs (
  id            bigserial primary key,
  job_name      text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text,                 -- ok | failed
  error         text,
  meta          jsonb
);

create table ai_usage (
  id            bigserial primary key,
  used_at       timestamptz not null default now(),
  purpose       text not null,        -- briefing | quiz | material_summary
  model         text not null,
  input_token   int not null,
  output_token  int not null,
  cost_usd      numeric(10,4) not null
);

-- ============ RLS + 권한 ============
-- 화이트리스트 이메일의 인증 세션만 통과. 서비스 롤은 RLS를 우회하므로
-- 잡 엔드포인트는 영향받지 않는다.
--
-- 주의: 마이그레이션으로 만든 테이블에는 anon/authenticated/service_role의
-- 기본 권한이 없다. RLS만 켜고 GRANT를 빼면 service_role까지 42501로 막혀
-- 잡 엔드포인트가 전부 죽는다. 그래서 GRANT를 여기서 같이 준다.

grant usage on schema public to authenticated, service_role;

-- service_role은 BYPASSRLS. 서버 전용 잡이 이 롤로 붙는다. app_config도 포함된다.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

do $$
declare t text;
begin
  foreach t in array array[
    'calendars', 'events', 'tasks', 'news_items', 'briefings',
    'briefing_sections', 'sync_state', 'job_runs', 'ai_usage'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy allowed_user_all on %I for all to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user())',
      t
    );
    -- 정책이 한 번 더 거른다. app_config는 이 목록에 없다 (service_role 전용).
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated;

-- anon에는 아무 권한도 주지 않는다.
