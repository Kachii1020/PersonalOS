-- Phase 2 — 퀴즈, 과목·자료·성적
-- SPEC.md 4절. Phase 3 테이블(tickers, price_snapshots, fx_rates, github_*)은 그때 만든다.
--
-- 0001에서 미룬 events.course_id / tasks.course_id를 여기서 붙인다.
-- courses가 Phase 2 테이블이라 0001 시점에는 참조할 대상이 없었다.

-- ============ 퀴즈 ============
create table quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  domain        text not null,   -- ib | accounting | macro | ai_ml | system_design
  question      text not null,
  choices       text[] not null, -- 4지선다
  answer_index  int not null,
  explanation   text not null,
  difficulty    int not null default 2,  -- 1..3
  created_at    timestamptz not null default now(),
  -- 4지선다이므로 정답 인덱스는 0..3이다. G2 조건이 이 범위를 검사한다.
  check (answer_index >= 0 and answer_index < array_length(choices, 1)),
  check (difficulty between 1 and 3)
);

create table quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references quiz_questions(id) on delete cascade,
  attempted_at  timestamptz not null default now(),
  chosen_index  int not null,
  is_correct    boolean not null
);
create index on quiz_attempts (attempted_at desc);

create table quiz_review_queue (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references quiz_questions(id) on delete cascade,
  due_on        date not null,
  stage         int not null,   -- 1 → +1일, 2 → +3일, 3 → +7일
  unique (question_id, stage),
  check (stage between 1 and 3)
);
create index on quiz_review_queue (due_on);

-- ============ 과목 / 성적 ============
create table semesters (
  id            uuid primary key default gen_random_uuid(),
  label         text not null unique,   -- '2026 Spring'
  starts_on     date not null,
  ends_on       date not null,
  is_current    boolean not null default false
);

create table courses (
  id            uuid primary key default gen_random_uuid(),
  semester_id   uuid not null references semesters(id) on delete cascade,
  name          text not null,
  code          text,
  credits       numeric(3,1) not null,
  grade         text,      -- A+ | A | B | C | F | null
  grade_point   numeric(3,2),
  notion_page_id text
);
create index on courses (semester_id);

create table course_materials (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses(id) on delete cascade,
  filename      text not null,
  storage_path  text not null,   -- Supabase Storage
  mime_type     text not null,
  extracted_text text,           -- 업로드 즉시 채움
  summary       text,            -- 버튼 눌렀을 때만 채움
  keywords      text[],
  uploaded_at   timestamptz not null default now()
);
create index on course_materials (course_id);

-- ============ Phase 1에서 미룬 course_id ============
-- ICS로 들어온 수업 일정을 과목에 연결한다 (SPEC.md 5.1b).
-- 매칭 실패는 정상 동작이므로 null을 허용하고 on delete set null로 둔다.
alter table events add column course_id uuid references courses(id) on delete set null;
alter table tasks  add column course_id uuid references courses(id) on delete set null;

-- ============ RLS + 권한 ============
-- 0001과 같은 규칙: service_role은 전체, authenticated는 RLS 정책이 한 번 더 거른다.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

do $$
declare t text;
begin
  foreach t in array array[
    'quiz_questions', 'quiz_attempts', 'quiz_review_queue',
    'semesters', 'courses', 'course_materials'
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
