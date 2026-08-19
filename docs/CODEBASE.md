# PersonalOS — Codebase Reference

**Last updated**: 2026-08-19
**Repository**: `kachii1020/personalos`

This document describes the entire application: what it does, how it is built, what every directory and file does, and what has been verified. It is written for coding agents that need to understand the codebase from zero context.

---

## 1. Product Summary

Single-user personal dashboard web app. Aggregates calendar, tasks, news briefing, quizzes, courses/grades, investment tickers, GitHub activity, Notion knowledge bases, and a job application pipeline into one PWA.

- **User**: one person (whitelisted email)
- **Language**: Korean UI, code comments in Korean
- **Timezone**: Asia/Tokyo (JST, no DST, +09:00 fixed)
- **Platform**: Next.js 15 web app, PWA (standalone, installable on iPhone)
- **Data split**: Notion = human-written content (read-only), Supabase = machine-written data
- **AI**: Anthropic API, 3 call sites only, $10/month hard cap

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.22 |
| Language | TypeScript (strict) | ^5 |
| React | React + React DOM | 19.1.0 |
| Styling | Tailwind CSS v4 + CSS custom properties | ^4 |
| Database | Supabase (Postgres) | ^2.111.0 |
| Auth | Supabase Auth (magic link) | via @supabase/ssr |
| Calendar sync | tsdav (CalDAV) + ical.js (ICS parse) + ical-generator (event write) | |
| Finance | yahoo-finance2 v4, frankfurter.app (fx), FRED, ECOS | |
| AI | @anthropic-ai/sdk | ^0.115.0 |
| Document parsing | unpdf (PDF), fflate + fast-xml-parser (PPTX) | |
| Fonts | Pretendard Variable (Korean body), JetBrains Mono (numbers) | |
| Icons | lucide-react (SVG only, no emoji — SPEC rule) | |
| Deploy target | Vercel Hobby | |
| Scheduler | GitHub Actions cron → POST /api/jobs/{name} | |
| PWA | manifest.json + service worker (manual) | |

### Key constraints from SPEC

- No gradients anywhere
- No emoji icons (lucide-react SVG only)
- No purple-blue color combos
- Glass effect on calendar card and briefing card only; everything else uses opaque `--surface`
- Light glass opacity ≥ 0.80
- Card shadow max 1 level (`shadow-sm`)
- Transitions 150–300ms
- All clickables need `cursor-pointer` + visible focus ring
- Numbers use monospace font + right-align
- Empty states must suggest next action (not "no data")
- Errors describe what failed and how to fix (no apologies)
- `prefers-reduced-motion` respected

---

## 3. Directory Structure

```
app/
  layout.tsx                 Root layout (fonts, theme boot script, SW registration)
  globals.css                Tailwind imports, design tokens bridge, animations, safe areas
  fonts.ts                   Pretendard + JetBrains Mono config
  login/                     Login page (magic link)
    page.tsx                 Login form page
    login-form.tsx           Client component: email input + submit
    actions.ts               Server action: send magic link (whitelist check)
  auth/callback/route.ts     Supabase auth callback handler
  (dashboard)/               Authenticated area (layout checks session)
    layout.tsx               Shell: sidebar (desktop), bottom tab bar (mobile), banners
    template.tsx             Page transition animation wrapper
    actions.ts               Shared server actions (sidebar reorder, sign out)
    page.tsx                 Dashboard (7 widgets in grid)
    calendar/
      page.tsx               Month calendar + today schedule + event form
      actions.ts             Create/update/delete events (iCloud PUT)
    tasks/
      page.tsx               Task list bucketed by due date
      actions.ts             Add task, complete task
    briefing/page.tsx        Briefing archive list + today's briefing detail
    quiz/
      page.tsx               Today's quiz (5 questions)
      actions.ts             Submit answer, server-side grading
      review/page.tsx        Wrong answer review (spaced repetition)
    courses/
      page.tsx               Course list + GPA
      [id]/page.tsx          Course detail (schedule, materials, notes)
      actions.ts             Add course, upload material, trigger summary, set grade
    wiki/
      page.tsx               Practical wiki (Notion mirror)
      actions.ts             Revalidate cache
    invest/page.tsx          Ticker table, FX, macro indicators, research notes
    portfolio/page.tsx       GitHub repos + 90-day commit heatmap
    apply/page.tsx           Job application pipeline (Notion mirror)
    settings/
      page.tsx               Sync status, API budget, ICS upload
      actions.ts             Upload ICS file
    more/page.tsx            "More" tab destination (lists remaining nav items)
    loading.tsx              Global loading skeleton
    error.tsx                Global error boundary

  api/jobs/                  Cron-triggered endpoints (POST, x-cron-secret auth)
    sync-calendar/route.ts   iCloud CalDAV incremental sync
    fetch-news/route.ts      RSS news collection (18 sources × 3 languages)
    generate-briefing/route.ts  AI briefing generation
    generate-quiz/route.ts   AI quiz generation (5 questions/day)
    fetch-prices/route.ts    Yahoo Finance quotes + frankfurter.app FX
    sync-github/route.ts     GitHub public repos + daily commit count
    sync-ics/route.ts        MyWaseda ICS import
    fetch-macro/route.ts     FRED + ECOS macro indicators

components/
  shell/                     App shell components
    sidebar.tsx              Desktop sidebar (collapsible, drag-reorder, sign out)
    bottom-tab-bar.tsx       iOS-style bottom tab bar (mobile only, <lg)
    nav-items.ts             Navigation item definitions (NAV_ITEMS, TAB_BAR_ITEMS, MORE_*)
    theme-toggle.tsx         Light/dark toggle
    sync-banner.tsx          Sync failure warning banner
    budget-banner.tsx        AI budget 80%+ warning banner
  ui/                        Primitive components (no business logic)
    card.tsx                 Card, CardHeader, CardTitle, CardHint (glass prop)
    button.tsx               Button
    input.tsx                Input
    badge.tsx                Badge
    change-badge.tsx         +/- percentage badge (positive/negative colors)
    count-up.tsx             Animated number counter
    skeleton.tsx             Loading skeleton lines
    empty-state.tsx          Empty state with action suggestion
    error-state.tsx          Error display with fix guidance
    toast.tsx                Toast notification system
  widgets/                   Dashboard cards and page-specific UI
    month-calendar.tsx       Calendar grid (glass, dots on mobile, chips on desktop)
    interactive-calendar.tsx Client-side calendar with date selection
    today-schedule.tsx       Today's events timeline
    week-deadlines.tsx       This week's due tasks
    daily-briefing.tsx       AI briefing card (glass)
    quiz-summary.tsx         Dashboard quiz status widget
    quiz-card.tsx            Individual quiz question card
    quiz-flow.tsx            Quiz session flow (5 questions)
    wrong-answer-card.tsx    Spaced repetition review card
    domain-lesson-card.tsx   Domain lesson display
    market-snapshot.tsx      Stock indices + FX rates widget
    github-heatmap.tsx       90-day commit heatmap
    event-form.tsx           Create/edit calendar event
    task-form.tsx            Create task
    course-form.tsx          Create course
    semester-form.tsx        Create semester
    material-panel.tsx       Course materials upload + summary
    grade-select.tsx         Grade selector (A+/A/B/C/F)
    ics-upload.tsx           ICS file upload form
    phase-placeholder.tsx    Placeholder for unbuilt widgets (none remain)

lib/
  design/
    tokens.css               CSS custom properties (light + dark palettes)
    cn.ts                    className merge utility
  time.ts                    Date math (JST-based: today, week, month boundaries, formatters)
  grades.ts                  GPA calculation (Waseda 4.0 scale)
  supabase/
    client.ts                Browser Supabase client
    server.ts                Server Supabase client (cookie-based session)
    admin.ts                 Service-role client (jobs only)
    middleware.ts            Session refresh + route protection
  types/
    database.ts              Generated Supabase types (17 tables)
  repos/                     Data access layer (all external SDK access goes through here)
    events.ts                Calendar events CRUD
    tasks.ts                 Tasks CRUD
    news.ts                  News items read
    briefings.ts             Briefings read
    quiz.ts                  Quiz questions, attempts, review queue
    courses.ts               Courses + semesters
    materials.ts             Course materials + storage
    wiki.ts                  Notion wiki mirror (6h cache)
    research.ts              Notion research notes (6h cache, optional)
    algo-patterns.ts         Notion algo patterns (6h cache, optional)
    course-notes.ts          Notion course notes (6h cache, optional)
    applications.ts          Notion job applications (6h cache, optional)
    tickers.ts               Stock tickers
    prices.ts                Price snapshots
    fx.ts                    FX rates
    macro.ts                 Macro indicators
    github.ts                GitHub repos + daily commits
    ai-usage.ts              AI cost tracking
    job-runs.ts              Job execution logs
    sync-state.ts            Sync status per integration
    user-prefs.ts            User preferences (sidebar order)
  integrations/
    caldav/
      client.ts              tsdav wrapper (connect, list calendars, list events, PUT, DELETE)
      parse.ts               VEVENT → event row mapping
      sync.ts                Full sync orchestration (ctag-based incremental)
    ics/
      parse.ts               ICS file parsing (ical.js VEVENT expansion)
      ingest.ts              ICS → events + course matching
    notion/
      client.ts              Notion API client (database ID → data source ID resolution)
      properties.ts          Notion property extractors (type-based, not name-based)
    news/
      rss.ts                 RSS XML parser
      fetch-news.ts          Multi-source news fetcher with per-source failure isolation
    finance/
      prices.ts              yahoo-finance2 quote fetcher (per-ticker failure isolation)
      fx.ts                  frankfurter.app FX rate fetcher
      fred.ts                FRED API client
      ecos.ts                ECOS (Bank of Korea) API client
    materials/
      extract.ts             PDF text extraction (unpdf), PPTX text extraction (fflate + XML)
    github/
      collect.ts             GitHub public repos + PushEvent daily aggregation
  ai/
    client.ts                Anthropic API wrapper (single call point, budget guard enforced)
    budget.ts                Monthly budget check ($10 cap, 80% warning)
    prompts/
      briefing.ts            Briefing generation prompt (index-based source references)
      quiz.ts                Quiz generation prompt (5 questions, 5 domains)
      material.ts            Material summary prompt (24,000 char limit)
      domain-lesson.ts       Domain lesson prompt
  jobs/
    cron-auth.ts             x-cron-secret header validation

config/
  news-sources.ts            18 RSS sources (3 languages × 5 sectors + 3 direct feeds)
  tickers.ts                 20 default stock tickers (auto-seeded)
  macro-series.ts            FRED (4) + ECOS (2) macro indicator series

supabase/
  config.toml                Local stack config (ports 54421–54429)
  migrations/
    0001_phase1_core.sql      10 tables: calendars, events, tasks, news_items, briefings,
                              briefing_sections, sync_state, job_runs, ai_usage, app_config
                              + RLS policies, GRANT, is_allowed_user() function
    0002_user_prefs.sql       user_prefs table (sidebar order)
    0003_phase2_learning.sql  quiz_questions, quiz_attempts, quiz_review_queue,
                              semesters, courses, course_materials
                              + events.course_id, tasks.course_id ALTER
    0004_materials_storage.sql Storage bucket 'materials' (private, 50MB, PDF/PPTX)
    0005_phase3_invest.sql    tickers, price_snapshots, fx_rates, github_repos,
                              github_daily_commits + service_role GRANT
    0006_macro.sql            macro_snapshots table
    0007_quiz_learning.sql    Quiz learning enhancements

scripts/
  gen-seed.ts                Generates supabase/seed.sql from ALLOWED_EMAIL env var
  check-notion.ts            Notion connection verification (npm run notion:check)
  gen-lessons.ts             Domain lesson generation script

tests/
  grades.test.ts             GPA calculation unit tests (5 cases)
  gates/
    g1.test.ts               Gate 1: calendar sync, briefing, budget guard, resilience (8 conditions)
    g2.test.ts               Gate 2: quiz, ICS, courses, grades, wiki (11 conditions)
    g3.test.ts               Gate 3: tickers, prices, FX, GitHub, applications (5 conditions)

.github/workflows/
  cron.yml                   GitHub Actions scheduler (7 jobs, see section 8)

public/
  manifest.json              PWA manifest (standalone, portrait, scope /)
  sw.js                      Service worker (cache-first for /_next/static/ only)
  icon.svg                   App icon (SVG)
  icon-192.png               App icon 192×192
  icon-512.png               App icon 512×512

middleware.ts                Next.js middleware (session refresh, route guard)
```

---

## 4. Authentication

- **Method**: Supabase magic link (email OTP). No password.
- **Whitelist**: Single email stored in `app_config` table. Generated by `scripts/gen-seed.ts` from `ALLOWED_EMAIL` env var.
- **3-layer defense**:
  1. Server action checks email before sending magic link
  2. Middleware checks session on every route (except `/login`, `/auth/callback`, `/api/jobs/*`, static assets)
  3. RLS function `is_allowed_user()` checks `auth.uid()` email against `app_config`
- **Login flow**: `/login` → enter email → server action sends magic link → email link → `/auth/callback` → redirect to `/`
- **Logout**: Server action clears `sb-*` cookies, redirects to `/login`

---

## 5. Database

17 tables across 7 migrations. All have RLS enabled. `anon` role has zero access. `authenticated` role has CRUD on user-facing tables. `service_role` has full access (used by job endpoints only).

### Tables by domain

| Domain | Tables |
|---|---|
| Calendar | `calendars`, `events` |
| Tasks | `tasks` |
| News/Briefing | `news_items`, `briefings`, `briefing_sections` |
| Quiz | `quiz_questions`, `quiz_attempts`, `quiz_review_queue` |
| Courses | `semesters`, `courses`, `course_materials` |
| Finance | `tickers`, `price_snapshots`, `fx_rates`, `macro_snapshots` |
| GitHub | `github_repos`, `github_daily_commits` |
| Operations | `sync_state`, `job_runs`, `ai_usage`, `app_config`, `user_prefs` |

### Key constraints

- `events`: unique on `(calendar_id, caldav_uid)`, indexed on `starts_at`
- `news_items`: unique on `url` (dedup)
- `briefings`: unique on `briefing_date`
- `quiz_questions`: `answer_index >= 0 AND answer_index < array_length(choices, 1)`
- `calendars`: `kind = 'caldav' OR is_writable = false` (ICS calendars are never writable)
- `quiz_review_queue`: unique on `(question_id, stage)`

---

## 6. Data Flow Architecture

### Data ownership rule

**One record lives in one place. No bidirectional sync.**

- **Notion** (human writes, app reads only): Research Notes, Practical Wiki, Course Notes, Algo Patterns, Applications
- **Supabase** (machine writes): Everything else
- **iCloud CalDAV**: Bidirectional for the app's own calendar only (`Personal OS`, `is_writable = true`). All other calendars are read-only mirrors.

### Supabase client separation

- `lib/supabase/server.ts` — cookie-based session client (UI routes, respects RLS)
- `lib/supabase/admin.ts` — service-role client (job endpoints only, bypasses RLS)
- `lib/supabase/client.ts` — browser client
- UI repos use session client. Job-specific repos use admin client. A repo function name ending in `ForJob` uses admin.

### External API access rule

No component imports `tsdav`, `yahoo-finance2`, Notion SDK, or `@anthropic-ai/sdk` directly. All external SDK calls go through `lib/repos/*.ts` or `lib/integrations/*/`. Direct import in a component is a rejection.

---

## 7. AI Pipeline

### Single call point

All Anthropic API calls go through `lib/ai/client.ts`. This file enforces: budget check → API call → usage recording. No other file calls the Anthropic SDK.

### Budget guard

- Before every call: query `ai_usage` for current month's `cost_usd` sum
- If ≥ $10: throw `BudgetExceededError` (HTTP 402 from job endpoints)
- After every call: record input_token, output_token, cost_usd in `ai_usage`
- 80% warning: `components/shell/budget-banner.tsx` shows banner when ≥ $8

### Call sites

| Purpose | Frequency | Prompt file | Model |
|---|---|---|---|
| Briefing | 1/day, 06:40 JST | `prompts/briefing.ts` | claude-sonnet-5, effort: low |
| Quiz | 1/day, 07:00 JST | `prompts/quiz.ts` | claude-sonnet-5 |
| Material summary | Manual (button click) | `prompts/material.ts` | claude-sonnet-5 |

### Cost optimization

Briefing prompt uses article indices instead of URLs (79% of input tokens were URLs). Measured: $0.038/call vs $0.125/call. Monthly: $1.14 vs $3.75.

---

## 8. Cron Schedule

All times JST. GitHub Actions calls `POST $APP_URL/api/jobs/{name}` with `x-cron-secret` header.

| Time (JST) | Job | Frequency |
|---|---|---|
| Every hour | `sync-calendar` | Hourly |
| 06:20 | `fetch-news` | Daily |
| 06:40 | `generate-briefing` | Daily |
| 07:00 | `generate-quiz` | Daily |
| 07:30 | `fetch-prices` | Daily |
| 07:45 | `sync-github` | Daily |
| 07:50 Mon | `fetch-macro` | Weekly |
| Manual only | `sync-ics` | On demand |

### Error handling

- Partial failure (some sources fail): HTTP 200, failures logged in `job_runs.meta`
- Total failure: HTTP 500
- Budget exceeded: HTTP 402, cron treats as warning (not failure)
- Per-item isolation: each calendar, each news source, each ticker fails independently

---

## 9. Navigation Architecture

### Desktop (≥ 1024px)

Left sidebar (`components/shell/sidebar.tsx`):
- 11 nav items with icons + labels
- Drag reorder (saved to `user_prefs` in Supabase)
- Keyboard reorder (Alt + arrow keys)
- Collapsible (state in localStorage)
- Theme toggle, collapse button, logout

### Mobile (< 1024px)

Bottom tab bar (`components/shell/bottom-tab-bar.tsx`):
- 5 tabs: 홈, 캘린더, 퀴즈, 브리핑, 더보기
- Fixed bottom, 50px height + safe area padding
- `bg-surface/95 backdrop-blur-md` (frosted glass)
- Active = `--accent`, inactive = `--text-muted`
- "더보기" → `/more` page with the remaining 7 items in a list

### Nav items defined in

`components/shell/nav-items.ts` exports:
- `NAV_ITEMS` (11 items — full set)
- `TAB_BAR_ITEMS` (4 primary tabs)
- `MORE_TAB` (the "more" tab definition)
- `MORE_ITEMS` (7 items = NAV_ITEMS − TAB_BAR_ITEMS)

---

## 10. PWA Configuration

| Aspect | Value |
|---|---|
| `display` | `standalone` |
| `orientation` | `portrait` |
| `viewport-fit` | `cover` (edge-to-edge) |
| `apple-web-app-status-bar-style` | `black-translucent` (transparent status bar) |
| Service worker | Cache-first for `/_next/static/` only; HTML and API never cached |
| Safe area top | `padding-top: env(safe-area-inset-top)` on `<body>` in standalone mode |
| Safe area bottom | `padding-bottom: env(safe-area-inset-bottom)` on tab bar |
| Tap highlight | Disabled (`-webkit-tap-highlight-color: transparent`) |
| Overscroll | Disabled (`overscroll-behavior: none`) |
| Icons | SVG (any), PNG 192×192, PNG 512×512 (maskable) |

---

## 11. Design Tokens

Defined in `lib/design/tokens.css`, bridged to Tailwind in `globals.css`.

### Light palette

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#f7f8fa` | Page background |
| `--surface` | `#ffffff` | Card background |
| `--glass` | `rgba(255,255,255,0.82)` | Calendar + briefing cards only |
| `--text` | `#0f172a` | Primary text |
| `--text-muted` | `#63738a` | Secondary text (AA compliant) |
| `--accent` | `#2f5d8c` | Interactive elements |
| `--accent-soft` | `#e4edf6` | Active backgrounds |
| `--positive` | `#0e7c66` | Positive change |
| `--negative` | `#b3261e` | Negative change |
| `--line` | `rgba(15,23,42,0.10)` | Borders |

### Dark palette

| Token | Value |
|---|---|
| `--bg` | `#0b0f16` |
| `--surface` | `#141a24` |
| `--glass` | `rgba(24,31,43,0.78)` |
| `--text` | `#e8edf4` |
| `--text-muted` | `#94a3b8` |
| `--accent` | `#7fb0e0` |
| `--accent-soft` | `#1b2a3a` |
| `--positive` | `#3fbfa0` |
| `--negative` | `#f2857c` |
| `--line` | `rgba(255,255,255,0.10)` |

### Typography

- Body: Pretendard Variable (via npm, loaded as local font)
- Numbers: JetBrains Mono (via Google Fonts, loaded as next/font/google)
- Scale: 12 / 14 / 16 / 20 / 28 / 40 px

---

## 12. Pages

| Route | Title | Content |
|---|---|---|
| `/` | 대시보드 | 3-column grid: month calendar (glass, 2×2), today schedule, week deadlines, daily briefing (glass, full-width), quiz summary, market snapshot, github heatmap |
| `/calendar` | 캘린더 | Month calendar + today schedule + event creation form |
| `/tasks` | 마감·할 일 | Tasks bucketed by urgency (overdue / today / this week / later / no due date) |
| `/briefing` | 브리핑 | Today's briefing + archive list with sector badges |
| `/quiz` | 오늘의 퀴즈 | 5-question flow with server-side grading + wrong answer review queue |
| `/quiz/review` | 오답노트 | Spaced repetition review (stage 1/2/3 = +1/+3/+7 days) |
| `/courses` | 과목 | Course list by semester + GPA display |
| `/courses/[id]` | 과목 상세 | Next class schedule, materials (upload/summarize), grades, course notes (Notion) |
| `/wiki` | 위키 | Notion Practical Wiki mirror (6h cache, revalidate button) |
| `/invest` | 투자 | 20 tickers with prices, change %, KRW conversion; FX rates; macro indicators; research notes (Notion) |
| `/portfolio` | 포트폴리오 | GitHub repos list + 90-day commit heatmap |
| `/apply` | 지원 | Notion Applications DB grouped by pipeline stage |
| `/settings` | 설정 | Sync statuses, API budget usage, ICS file upload |
| `/more` | 더보기 | Mobile tab bar overflow: links to tasks, courses, wiki, invest, portfolio, apply, settings |

---

## 13. Verification Status

### Gates

All 3 gates passed. Reports in `docs/G1-REPORT.md`, `docs/G2-REPORT.md`, `docs/G3-REPORT.md`.

| Gate | Conditions | Status |
|---|---|---|
| G1 (calendar, briefing, auth, resilience) | 8/8 | ✅ Passed |
| G2 (quiz, ICS, courses, grades, wiki) | 11/11 | ✅ Passed |
| G3 (tickers, prices, FX, GitHub, applications) | 5/5 | ✅ Passed |

### Test commands

```bash
npm run typecheck        # tsc --noEmit (0 errors)
npm run lint             # eslint (0 errors)
npm run test:unit        # grades.test.ts (5/5)
npm run test:g1          # gate 1 (requires local Supabase)
npm run test:g2          # gate 2 (requires local Supabase)
npm run test:g3          # gate 3 (requires local Supabase)
npm run test             # all above combined
npm run notion:check     # verify Notion API connection
npm run db:reset         # generate seed + reset local DB
```

---

## 14. Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth
ALLOWED_EMAIL=                   # single whitelisted email

# iCloud CalDAV
APPLE_ID=
APPLE_APP_PASSWORD=              # 16-char app-specific password
APP_CALENDAR_NAME=Personal OS

# MyWaseda
WASEDA_ICS_URL=                  # leave empty for manual upload

# Notion
NOTION_TOKEN=
NOTION_DB_RESEARCH=              # optional (empty = hidden section)
NOTION_DB_WIKI=                  # required for /wiki
NOTION_DB_COURSE_NOTES=          # optional
NOTION_DB_ALGO=                  # optional
NOTION_DB_APPLICATIONS=          # optional

# AI
ANTHROPIC_API_KEY=
AI_MONTHLY_BUDGET_USD=10
AI_MODEL=                        # optional, default: claude-sonnet-5

# Finance
FRED_API_KEY=                    # optional (no key = empty macro data)
ECOS_API_KEY=                    # optional

# GitHub
GITHUB_TOKEN=                    # public_repo scope
GITHUB_USERNAME=

# Jobs
CRON_SECRET=

# GitHub Actions secrets
APP_URL=                         # deployed URL
CRON_SECRET=                     # same as above
```

---

## 15. Local Development

```bash
# Prerequisites: Node.js, Supabase CLI

# 1. Install
npm install

# 2. Set up env
cp .env.example .env.development.local   # fill in values
# .env.development.local takes precedence over .env.local (Next.js convention)

# 3. Start local Supabase (ports 54421-54429)
supabase start

# 4. Reset DB with seed
npm run db:reset

# 5. Start dev server
npm run dev
```

Local Supabase ports: API 54421, DB 54422, Studio 54423, SMTP 54424, Pooler 54429. Shadow DB 54420. Chosen to not conflict with other projects.

---

## 16. Deploy

- **Hosting**: Vercel Hobby (free tier)
- **Database**: Supabase hosted project `leitsqwmtxqsgnsvzdfc`
- **Schema push**: `npx supabase link --project-ref leitsqwmtxqsgnsvzdfc && npx supabase db push`
- **Seed**: Manual insert of `app_config` row with allowed email
- **Cron**: GitHub Actions workflow (requires `APP_URL` and `CRON_SECRET` secrets)

---

## 17. Known Limitations

See `docs/DEFERRED.md` for the full list. Key items:

- Recurring event expansion (RRULE) not implemented — single instances only
- iCloud event deletion not mirrored (sync is upsert-only)
- News retention unbounded (270 items/day, no cleanup job)
- Scanned PDFs (image-only) extract 0 characters, rejected on upload
- Semester creation requires direct DB insert (no UI form)
- Material download/delete from UI not implemented
- MyWaseda ICS live URL path untested (manual upload is the confirmed path)
- Production build not verified against hosted Supabase (needs `db push` first)

---

## 18. Decision Log

All architectural decisions are recorded in `docs/DECISIONS.md` with: decision, rationale, rejected alternative. 30+ entries covering CalDAV strategy, AI cost optimization, error handling philosophy, auth design, data isolation, and more.
