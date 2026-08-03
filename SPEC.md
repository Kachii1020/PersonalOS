# Personal OS — 제품/기술 스펙 v1.0

**작성일**: 2026-08-02
**대상 사용자**: 단일 사용자 (Jun)
**구현 도구**: Claude Code (주), Codex (보조)

---

## 0. 한 줄 정의

커리어 관련 학습, 스케줄, 시사·금융 정보, 개인 투자 리서치, SWE 실무 지식을 하나의 웹앱에서 관리하는 단일 사용자용 대시보드. PWA로 폰에서도 접근 가능.

---

## 1. 확정된 결정 사항

| 항목 | 결정 |
|---|---|
| 사용자 | 단일 계정, 화이트리스트 인증 |
| 플랫폼 | Next.js 웹앱 + PWA (네이티브 앱 없음) |
| 데이터 | 하이브리드: Notion(사람이 쓰는 것) + Supabase(기계가 쓰는 것) |
| 캘린더 | iCloud CalDAV 직결 (읽기+쓰기) |
| 첫 화면 | 이번 달 달력 + 오늘 일정 + 이번 주 마감 + AI 브리핑 + 퀴즈 + 지수·환율 + GitHub 잔디 |
| 시간 블로킹 | **제외** |
| UI | 한국어, 라이트 기본 + 다크 토글, 글래스모피즘(절제 적용) |
| 브리핑 | 매일 06:00 JST, 요약 언어 한국어, 원문 링크 병기 |
| 시사 소스 | 일본어/영어/한국어 각 1개 + 섹터 5개 |
| 퀴즈 | 하루 5문제 객관식, 오답 1/3/7일 후 재출제 |
| 실무지식 | 위키형 (커리큘럼형 아님) |
| 알고리즘 | 패턴별 정리 노트 중심 |
| 투자 | 페이퍼 리서치 노트, 티커 기준, 20개 이하 |
| 기준 통화 | KRW / USD 병기 |
| 시세 | Yahoo Finance (`yahoo-finance2`) |
| GitHub | 전체 공개 레포 자동 수집 |
| 학점 | 와세다 A+/A/B/C/F, 4.0 스케일 |
| 강의자료 | 업로드 즉시 텍스트 추출, 요약은 수동 트리거 |
| 학교 시간표 | MyWaseda ICS 내보내기 → 앱이 직접 파싱, 읽기 전용 |
| 배포 | Vercel 무료 + Supabase 무료, 커스텀 도메인 없음 |
| 앤트로픽 API | 꼭 필요한 곳만, 월 $10 하드캡 |

---

## 2. 기술 스택

```
Frontend   Next.js 15 (App Router) + TypeScript strict
Styling    Tailwind CSS v4 + CSS 변수 토큰
State      React Server Components 우선, 클라이언트 상태는 최소
DB         Supabase (Postgres) — 기계 데이터
Docs       Notion API — 사람이 쓰는 데이터
Auth       Supabase Auth (Google OAuth) + 이메일 화이트리스트 1개
Calendar   tsdav + ical-generator + ical.js
Finance    yahoo-finance2 (npm)
PWA        manifest.json + service worker (수동 구성)
Deploy     Vercel Hobby
Scheduler  GitHub Actions cron → Vercel API 라우트 호출
AI         Anthropic API (claude-sonnet-4-6 등급)
```

### 스케줄러를 GitHub Actions로 두는 이유

Vercel Hobby 티어의 크론 잡은 개수와 실행 빈도에 제한이 있는 것으로 알고 있음. **이 수치는 내 기억 기준이고 확인이 필요함** — 구현 시작 시 Vercel 문서에서 현재 제한을 확인할 것. 어느 쪽이든 GitHub Actions의 스케줄 워크플로가 무료이고 빈도 제어가 자유로우므로, 크론 로직을 Vercel에 묶지 않는 편이 안전하다.

- GitHub Actions 워크플로가 `CRON_SECRET` 헤더를 붙여 `POST /api/jobs/{name}` 호출
- API 라우트는 헤더 검증 후 실행
- 로컬에서도 같은 엔드포인트를 호출해 수동 실행 가능

---

## 3. 데이터 소유권 경계

**규칙: 한 레코드는 한쪽에만 산다. 양방향 동기화는 금지.**

### Notion (사람이 직접 쓰는 것)

| DB | 용도 | 주요 속성 |
|---|---|---|
| `Research Notes` | 투자 리서치 | 티커, 회사명, 테마 태그, 논지, 리스크, 업데이트일 |
| `Practical Wiki` | 실무 지식 (RAG, 벡터DB, 시스템설계 등) | 제목, 카테고리, 상태(미완/작성중/완료), 관련 항목 |
| `Course Notes` | 과목별 노트 | 과목, 주차, 내용 |
| `Algo Patterns` | 알고리즘 패턴 정리 | 패턴명, 핵심 아이디어, 대표 문제, 코드 스니펫 |
| `Applications` | 지원 파이프라인 (Phase 3) | 회사, 직무, 단계, 마감일, 제출 문서 |

앱은 Notion을 **읽기 전용**으로 다룬다. 예외는 `Applications`의 단계 변경 하나뿐이며, 이것도 Phase 3에서 필요성이 확인되면 넣는다.

### Supabase (기계가 쓰는 것)

시계열, 캐시, 집계가 필요한 모든 것.

---

## 4. 데이터베이스 스키마

```sql
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
  course_id     uuid references courses(id) on delete set null,
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
  category      text,                            -- school | career | study | invest | etc
  course_id     uuid references courses(id) on delete set null,
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

-- ============ 퀴즈 ============
create table quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  domain        text not null,   -- ib | accounting | macro | ai_ml | system_design
  question      text not null,
  choices       text[] not null, -- 4지선다
  answer_index  int not null,
  explanation   text not null,
  difficulty    int not null default 2,  -- 1..3
  created_at    timestamptz not null default now()
);

create table quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references quiz_questions(id) on delete cascade,
  attempted_at  timestamptz not null default now(),
  chosen_index  int not null,
  is_correct    boolean not null
);

create table quiz_review_queue (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references quiz_questions(id) on delete cascade,
  due_on        date not null,
  stage         int not null,   -- 1 → +1일, 2 → +3일, 3 → +7일
  unique (question_id, stage)
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

-- ============ 사용자 설정 ============
-- 2026-08-03 추가: 6.1의 사이드바 순서 저장을 위해 필요한데 이 절에 없었다.
create table user_prefs (
  key           text primary key,     -- 'sidebar_order'
  value         jsonb not null,
  updated_at    timestamptz not null default now()
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
```

**RLS**: 단일 사용자지만 RLS는 켜고, 화이트리스트 이메일의 `auth.uid()`만 통과시킨다. 서비스 롤 키는 서버 라우트에서만 사용.

---

## 5. 외부 연동 상세

### 5.1 iCloud CalDAV

```
serverUrl   https://caldav.icloud.com
authMethod  Basic
username    Apple ID 이메일
password    앱 전용 암호 16자리 (환경변수 APPLE_APP_PASSWORD)
```

**안정성 규칙 (구현 필수)**

1. **UI는 iCloud를 직접 조회하지 않는다.** 항상 `events` 미러 테이블만 읽는다. iCloud 장애 시에도 앱이 뜬다.
2. **ctag 기반 증분 동기화.** 캘린더의 ctag가 이전과 같으면 이벤트를 하나도 가져오지 않는다.
3. **쓰기는 앱 전용 캘린더 1개에만.** iCloud에 `Personal OS`라는 캘린더를 새로 만들고, `calendars.is_writable = true`인 행은 그것 하나뿐이어야 한다. 코드는 다른 캘린더에 PUT을 시도하면 예외를 던진다.
4. **모든 CalDAV 호출은 서버 라우트에서만.** 브라우저 직접 호출은 CORS로 막히고, 앱 전용 암호가 노출된다.
5. **동기화 실패는 조용히 넘어가지 않는다.** `sync_state.last_status`를 `failed`로 쓰고 UI 상단에 배너를 띄운다.

**폴백 설계**: 인증 또는 PUT이 실패하면 읽기는 ICS 공개 URL 구독으로, 쓰기는 `events.source = 'app'`인 로컬 전용 이벤트로 격하한다. UI 컴포넌트는 이 두 경로를 구분하지 않도록 리포지토리 레이어에서 흡수한다.

### 5.1b MyWaseda 시간표 ICS (Phase 2)

**우선순위 낮음.** 학기 일정은 이 앱의 주 목적이 아니다. Phase 1에서는 구현하지 않고, `calendars.kind` 컬럼과 `events.course_id`만 스키마에 미리 넣어둔다 (나중에 마이그레이션을 안 쪼개려고).

**iCloud에 구독시키지 않고 앱이 직접 파싱한다.** 이유는 두 가지.

1. iCloud의 구독 캘린더가 서드파티 CalDAV 클라이언트에 노출되는지 확실하지 않다. 확인 안 된 경로에 의존하지 않는다.
2. 앱이 직접 파싱하면 이벤트 요약에서 **과목 코드를 추출해 `courses` 테이블에 연결**할 수 있다. 이게 성적 추적과 강의자료 관리를 시간표와 묶어주는 고리다.

```
calendars 행 1개를 kind='ics', is_writable=false로 등록
잡: fetch → 본문 SHA-256 해시 비교 → 변경 없으면 파싱 생략
파싱: ical.js로 VEVENT 전개 → events에 source='waseda'로 upsert
링크: summary/description에서 과목 코드 정규식 추출 → courses.code와 매칭 → course_id 채움
```

**매칭 실패는 정상 동작이다.** 코드가 안 잡히면 `course_id`를 null로 두고 이벤트는 그대로 저장한다. 매칭 실패 건수를 `job_runs.meta`에 기록해서 정규식을 나중에 고칠 수 있게 한다.

**학기 갱신**: 학기가 바뀌면 URL 또는 파일을 새로 받는다. `/settings`에서 ICS 소스를 교체할 수 있게 하고, 교체 시 이전 학기 `source='waseda'` 이벤트는 지우지 않고 남긴다.

**미확정 항목**: MyWaseda가 구독 가능한 라이브 URL을 주는지, 아니면 .ics 파일 다운로드만 주는지에 따라 구현이 갈린다.
- 라이브 URL → 잡이 주기적으로 fetch (하루 1회면 충분)
- 파일 다운로드만 → `/settings`에서 수동 업로드, 학기당 1~2회
두 경로 모두 파싱 이후 로직은 동일하므로, 리포지토리 인터페이스를 `ingestIcs(content: string)`로 두고 **입력 획득 방법만 분기**한다.

### 5.2 뉴스 수집

**주 메커니즘: Google News RSS 검색 피드.** 언어와 지역 파라미터를 바꾸는 것만으로 3개 언어를 같은 코드로 처리할 수 있다.

```
https://news.google.com/rss/search?q={QUERY}&hl={HL}&gl={GL}&ceid={CEID}

ko  hl=ko  gl=KR  ceid=KR:ko
en  hl=en-US  gl=US  ceid=US:en
ja  hl=ja  gl=JP  ceid=JP:ja
```

**섹터별 쿼리 (초기값, `config/news-sources.ts`에서 관리)**

| 섹터 | ko | en | ja |
|---|---|---|---|
| finance | 금융시장 금리 | monetary policy markets | 金融政策 市場 |
| ai | 인공지능 | artificial intelligence | 生成AI |
| semiconductor | 반도체 | semiconductor chips | 半導体 |
| it | IT 업계 | tech industry | IT業界 |
| rotating | (요일별 회전) | | |

**회전 섹터**: 월=에너지, 화=바이오·헬스케어, 수=방산, 목=소비재·리테일, 금=부동산·인프라, 토=우주·항공, 일=암호화폐·핀테크.

보조 소스로 언어별 직접 RSS를 하나씩 둔다 (예: 영어 SEC/Fed 공식 피드, 일본어 ITmedia, 한국어 연합뉴스 경제). **RSS URL은 자주 바뀌므로 구현 시점에 실제로 fetch해서 200과 유효한 XML이 오는지 확인한 것만 커밋한다.** 검증 안 된 URL을 넣지 말 것.

### 5.3 금융 데이터

| 목적 | 소스 | 키 필요 |
|---|---|---|
| 주가/지수 | `yahoo-finance2` npm | 불필요 |
| 환율 | frankfurter.app | 불필요 |
| 미국 매크로 | FRED API | 무료 키 |
| 한국 매크로 | 한국은행 ECOS | 무료 키 |

**위험 고지**: `yahoo-finance2`는 Yahoo의 비공식 엔드포인트를 쓰는 라이브러리라 예고 없이 깨질 수 있다. 시세 조회 실패는 앱을 죽이지 않고, 위젯에 "시세 갱신 실패, 마지막 갱신 {날짜}"를 표시하고 `price_snapshots`의 최신 행을 보여준다.

### 5.4 GitHub

```
GET /users/{username}/repos?per_page=100&type=owner&sort=pushed
GET /users/{username}/events   (잔디용 일별 커밋 집계)
```

PAT는 `public_repo` 스코프면 충분. 잔디는 GitHub의 contributions 그래프를 그대로 못 가져오므로, `github_daily_commits`에 이벤트 기반으로 누적한다. **완벽히 일치하지 않는다** (private 기여, 이벤트 API의 90일 보존 한계). UI에 "최근 90일" 라벨을 달아 기대치를 맞춘다.

### 5.5 Anthropic API

**호출하는 곳은 3군데뿐이다.**

| 용도 | 빈도 | 배치 방식 |
|---|---|---|
| 브리핑 생성 | 1일 1회 | 5개 섹터 전부를 **1회 호출**에 넣는다 |
| 퀴즈 생성 | 1일 1회 | 5문제를 1회 호출로 |
| 강의자료 요약 | 수동 | 버튼 클릭 시에만 |

**비용 가드 (구현 필수)**
- 모든 호출 전에 `ai_usage`의 이번 달 `cost_usd` 합계를 조회한다.
- 합계가 $10 이상이면 호출하지 않고 예외를 던진다. 브리핑은 "월 예산 소진"으로 표시한다.
- 호출 후 응답의 usage를 `ai_usage`에 기록한다.
- 예산의 80%를 넘으면 대시보드 상단에 경고 배너.

---

## 6. UI 설계

### 6.1 첫 화면 레이아웃

```
데스크톱 (>= 1024px)
┌──────────┬───────────────────────────────┬──────────────┐
│          │                               │  오늘 일정    │
│  사이드   │      이번 달 달력              │  (타임라인)   │
│   바      │      (주 시선)                 ├──────────────┤
│          │                               │  이번 주 마감 │
│          ├───────────────────────────────┴──────────────┤
│          │           오늘의 브리핑 (전폭)                 │
│          ├────────────────┬─────────────────────────────┤
│          │   오늘의 퀴즈   │  지수·환율  │  GitHub 잔디   │
└──────────┴────────────────┴─────────────────────────────┘

모바일 (< 768px) — 세로 스택, 순서 고정
달력 → 오늘 일정 → 이번 주 마감 → 브리핑 → 퀴즈 → 지수·환율 → 잔디
```

사이드바는 접기 가능하고, 페이지 순서를 드래그로 재정렬할 수 있다 (순서는 `localStorage`가 아니라 Supabase의 `user_prefs`에 저장해서 폰과 PC가 같게 유지).

### 6.2 페이지 목록

| 경로 | 내용 | Phase |
|---|---|---|
| `/` | 대시보드 | 1 |
| `/calendar` | 월/주 캘린더 상세, 이벤트 생성·수정 | 1 |
| `/tasks` | 마감·할 일 | 1 |
| `/briefing` | 브리핑 아카이브 | 1 |
| `/quiz` | 오늘의 퀴즈, 오답노트 | 2 |
| `/wiki` | 실무 지식 위키 (Notion 미러) | 2 |
| `/courses` | 과목, 자료, 성적/GPA | 2 |
| `/invest` | 티커 목록, 리서치 노트, 시세 | 3 |
| `/portfolio` | GitHub 레포·활동 | 3 |
| `/apply` | 지원 파이프라인 | 3 |
| `/settings` | 연동 상태, API 예산, 동기화 로그 | 1 |

### 6.3 디자인 토큰

```css
/* Light (기본) */
--bg:            #F7F8FA;   /* 종이 같은 아주 옅은 회청 */
--surface:       #FFFFFF;   /* 불투명 카드 */
--glass:         rgba(255,255,255,0.82);  /* 하한 0.80, 절대 낮추지 말 것 */
--glass-border:  rgba(15,23,42,0.08);
--text:          #0F172A;
--text-muted:    #63738A;   /* 2026-08-03 보정: #64748B는 --bg 위에서 4.48:1로 AA 미달 */
--accent:        #2F5D8C;   /* 차분한 감청 */
--accent-soft:   #E4EDF6;
--positive:      #0E7C66;
--negative:      #B3261E;
--line:          rgba(15,23,42,0.10);

/* Dark */
--bg:            #0B0F16;
--surface:       #141A24;
--glass:         rgba(24,31,43,0.78);
--glass-border:  rgba(255,255,255,0.10);
--text:          #E8EDF4;
--text-muted:    #94A3B8;
--accent:        #7FB0E0;
--accent-soft:   #1B2A3A;
/* 2026-08-03 추가: 미정의 상태로 두면 라이트 값을 상속해 --surface 위에서
   3.40:1 / 2.67:1로 AA에 크게 미달한다. */
--positive:      #3FBFA0;
--negative:      #F2857C;
--line:          rgba(255,255,255,0.10);
```

**타이포그래피**
- 본문/UI: Pretendard Variable (한국어 가독성이 이 프로젝트의 핵심 요구사항)
- 숫자/데이터: JetBrains Mono (시세, 학점, 커밋 수 등 자릿수 정렬이 필요한 곳 전부)
- 디스플레이 없음. 헤드라인용 별도 서체를 쓰지 않는 것이 이 프로젝트의 선택이다. 대시보드에서 장식용 서체는 정보 밀도를 떨어뜨린다.
- 스케일: 12 / 14 / 16 / 20 / 28 / 40

### 6.4 "AI 느낌 걷어내기" 규칙 (구현 강제)

이건 취향이 아니라 검사 항목이다. 코드 리뷰에서 위반 시 반려.

1. **글래스는 달력 카드와 브리핑 카드에만.** 나머지는 불투명 `--surface`. 전부 유리면 계층이 사라진다.
2. **라이트 모드 글래스 배경 불투명도 0.80 미만 금지.** `bg-white/10` 같은 값은 읽히지 않는다.
3. **그라디언트 금지.** 배경, 버튼, 텍스트 전부. 예외 없음.
4. **이모지 아이콘 금지.** 아이콘은 SVG(lucide-react)로만.
5. **보라→파랑 계열 조합 금지.** 이게 생성형 AI UI의 가장 강한 신호다.
6. **카드 그림자는 최대 1단계.** `shadow-sm` 수준. 겹겹이 쌓지 않는다.
7. **전환은 150–300ms.** 그 이상은 느리게 느껴지고, 애니메이션은 hover와 페이지 전환에만.
8. **모든 클릭 가능 요소에 `cursor-pointer`와 보이는 키보드 포커스 링.**
9. **숫자는 등폭 폰트 + 우측 정렬.** 표에서 자릿수가 어긋나면 안 된다.
10. **빈 상태에 "아직 데이터가 없습니다" 같은 문장 금지.** 대신 다음 행동을 제시한다. 예: "티커를 추가하면 여기에 시세가 표시됩니다" + 추가 버튼.
11. **에러 메시지는 사과하지 않고, 무엇이 실패했고 어떻게 고치는지 말한다.** "iCloud 동기화 실패. 앱 전용 암호를 확인하세요." 형태.
12. **`prefers-reduced-motion` 존중.**

---

## 7. 구현 단계와 게이트

### Phase 1 — 뼈대와 스케줄 (게이트 G1)

범위: 인증, 레이아웃, 달력, 일정, 마감, 브리핑, 설정 페이지, 동기화 로그.

**G1 통과 조건 (전부 자동 검증 가능해야 함)**
- [ ] iCloud 캘린더 목록을 가져와 `calendars`에 저장하고, 앱 전용 캘린더가 `is_writable = true`로 정확히 1개 존재한다
- [ ] 동기화를 2번 연속 실행했을 때 두 번째는 ctag 비교로 이벤트를 0건 가져온다 (증분 동기화 증명)
- [ ] 앱에서 만든 이벤트가 iCloud에 PUT되고, 재동기화 후 `events`에 같은 uid로 존재한다
- [ ] 브리핑 잡을 실행하면 `briefings`에 오늘 날짜 행이 `ready`로 생기고 `briefing_sections`가 5건(고정 4 + 회전 1) 이상이다
      <!-- 2026-08-03 정정: 원래 "6건(고정 5 + 회전 1)"이었으나 5.2의 고정 섹터는 finance/ai/semiconductor/it 4개다. -->
      <!-- 섹터×언어로 쪼개면 6건을 넘기지만 출력 토큰이 3배가 되어 5.5의 월 $10 예산을 초과한다. -->
      <!-- 마찬가지로 5.5의 "5개 섹터를 1회 호출"은 회전 섹터를 포함한 5개를 뜻한다. -->
      
- [ ] AI 호출 1회당 `ai_usage`에 정확히 1행이 기록된다
- [ ] 이번 달 누적 비용을 $10 이상으로 조작하면 다음 AI 호출이 예외로 차단된다
- [ ] 대시보드가 iCloud를 끄고도(환경변수 제거) 500 없이 렌더된다
- [ ] Lighthouse 접근성 90 이상, 모바일 375px에서 가로 스크롤 없음

### Phase 2 — 학습 (게이트 G2)

범위: 퀴즈, 오답노트, 위키(Notion 미러), 과목·자료·성적.

**G2 통과 조건**
- [ ] 퀴즈 잡이 5문제를 생성하고 도메인이 2개 이상 섞인다
- [ ] 오답 처리 시 `quiz_review_queue`에 stage 1/2/3 행이 각각 +1/+3/+7일로 생성된다
- [ ] 오늘 날짜의 복습 문항이 오늘의 퀴즈에 우선 편입된다
- [ ] PDF와 PPTX를 업로드하면 `extracted_text`가 비어있지 않게 채워진다
- [ ] 요약 버튼을 누르기 전에는 `ai_usage`에 행이 추가되지 않는다
- [ ] MyWaseda ICS를 넣으면 `events`에 `source='waseda'` 행이 생기고, 같은 내용으로 재실행 시 content_hash 비교로 파싱을 건너뛴다
- [ ] `kind='ics'`인 캘린더에 쓰기를 시도하면 DB check 제약으로 막힌다
- [ ] ICS에서 들어온 이벤트 중 과목 코드가 매칭된 건은 `course_id`가 채워지고, 매칭 실패 건수가 `job_runs.meta`에 기록된다
- [ ] 과목 상세 페이지에서 해당 과목의 다음 수업 일정이 표시된다
- [ ] 과목 3개에 학점을 입력하면 GPA가 4.0 스케일로 정확히 계산된다 (수기 계산과 대조하는 단위 테스트 포함)
- [ ] Notion 위키 항목이 앱에 표시되고, 앱에서 Notion을 수정하지 않는다

### Phase 3 — 투자·포트폴리오 (게이트 G3)

범위: 티커, 시세, 리서치 노트 미러, GitHub 수집, 지원 파이프라인.

**G3 통과 조건**
- [ ] 티커 20개의 시세를 1회 잡으로 가져오고 `price_snapshots`에 20행이 들어간다
- [ ] Yahoo 호출을 강제로 실패시켜도 위젯이 마지막 스냅샷과 갱신 실패 표시를 보여준다
- [ ] KRW/USD 병기가 `fx_rates`의 당일 환율로 계산된다
- [ ] GitHub 공개 레포 전체가 수집되고 90일 커밋 잔디가 렌더된다
- [ ] 지원 파이프라인이 Notion에서 읽히고 단계별로 그룹핑된다

---

## 8. 환경변수

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ALLOWED_EMAIL=                 # 화이트리스트 1개

APPLE_ID=
APPLE_APP_PASSWORD=            # 16자리 앱 전용 암호
APP_CALENDAR_NAME=Personal OS

WASEDA_ICS_URL=                # 라이브 URL이 아니면 비워두고 수동 업로드 사용

NOTION_TOKEN=
NOTION_DB_RESEARCH=
NOTION_DB_WIKI=
NOTION_DB_COURSE_NOTES=
NOTION_DB_ALGO=
NOTION_DB_APPLICATIONS=

ANTHROPIC_API_KEY=
AI_MONTHLY_BUDGET_USD=10

GITHUB_TOKEN=
GITHUB_USERNAME=

FRED_API_KEY=
ECOS_API_KEY=

CRON_SECRET=
```

---

## 9. 알려진 리스크

| 리스크 | 영향 | 완화 |
|---|---|---|
| CalDAV 인증/PUT 실패 | 캘린더 쓰기 불가 | 5.1의 폴백 설계, G1 이전에 스파이크로 먼저 검증 |
| `yahoo-finance2` 파손 | 시세 위젯 정지 | 마지막 스냅샷 표시, 앱은 죽지 않음 |
| Vercel Hobby 크론 제한 | 잡 실행 불가 | 스케줄러를 GitHub Actions에 둠 |
| Notion 레이트 리밋 | 위키·노트 로딩 지연 | 6시간 캐시, 서버에서만 호출 |
| Anthropic 비용 초과 | 요금 발생 | 월 $10 하드캡, 호출 전 검사 |
| GitHub 이벤트 90일 한계 | 잔디가 불완전 | "최근 90일" 라벨로 기대치 조정 |
| RSS URL 변경 | 뉴스 수집 실패 | 커밋 전 실제 fetch 검증, 소스별 실패 격리 |
| MyWaseda ICS가 라이브 URL이 아님 | 학기마다 수동 업로드 필요 | 파싱 인터페이스를 입력 획득 방법과 분리 |
| 과목 코드 정규식 미스매치 | 수업-과목 연결 누락 | 매칭 실패를 정상 동작으로 처리, 실패 건수 로깅 |
