-- Migration: Learn module (Excel for Finance curriculum)
-- Adds curriculum tracking tables and excel_finance quiz domain.
-- Does NOT modify existing quiz_questions schema — only adds rows.

-- ============ 커리큘럼 구조 ============
create table learn_tracks (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,          -- 'excel-finance'
  title         text not null,                 -- 'Excel for Finance'
  description   text,
  position      int not null default 0,
  created_at    timestamptz not null default now()
);

create table learn_phases (
  id            uuid primary key default gen_random_uuid(),
  track_id      uuid not null references learn_tracks(id) on delete cascade,
  phase_number  int not null,
  title         text not null,                 -- 'Excel 기초 체력'
  description   text,
  weeks_label   text,                          -- '1–2주차'
  position      int not null default 0,
  unique (track_id, phase_number)
);

create table learn_modules (
  id            uuid primary key default gen_random_uuid(),
  phase_id      uuid not null references learn_phases(id) on delete cascade,
  slug          text not null,                 -- 'nav', 'basic-fn', ...
  title         text not null,
  concepts      text[] not null default '{}',  -- ordered list of concept strings
  position      int not null default 0,
  unique (phase_id, slug)
);

-- ============ 진행률 ============
create table learn_progress (
  id            uuid primary key default gen_random_uuid(),
  module_id     uuid not null references learn_modules(id) on delete cascade,
  status        text not null default 'not_started',  -- not_started | in_progress | complete
  completed_at  timestamptz,
  updated_at    timestamptz not null default now(),
  unique (module_id)  -- single user, one row per module
);

-- ============ 퀴즈 연결 ============
-- quiz_questions.domain에 'excel_finance' 값 추가.
-- domain은 text 타입이라 enum 변경 불필요, 값만 넣으면 됨.
-- learn_modules와 quiz_questions의 연결은 module_slug 태그로.
alter table quiz_questions add column if not exists module_slug text;
comment on column quiz_questions.module_slug is 'learn_modules.slug — links quiz to curriculum module';

-- ============ RLS ============
alter table learn_tracks enable row level security;
alter table learn_phases enable row level security;
alter table learn_modules enable row level security;
alter table learn_progress enable row level security;

-- 읽기는 인증된 사용자, 쓰기(progress만)도 인증된 사용자
create policy "learn_tracks_read" on learn_tracks for select using (true);
create policy "learn_phases_read" on learn_phases for select using (true);
create policy "learn_modules_read" on learn_modules for select using (true);
create policy "learn_progress_all" on learn_progress for all using (auth.uid() is not null);
