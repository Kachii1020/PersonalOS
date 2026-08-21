Phase 4 코드 스택 완료 (PWA + Trust + Phase 4). G1·G2·G3 통과. G4 1·4·5 수동 통과 + 2·6 라이브 통과 (2026-08-20 Actions). **8만 남음 — G4 미통과.** 호스티드 EXDATE는 `0010` (`docs/SHIP.md` 2·4절).

업그레이드(`docs/UPGRADE-PLAN.html`) Tier 1–2 구현 완료: 스트릭(1-A), 퀵 캡처(1-B), 커맨드 팔레트(1-C), 주간 뷰(2-A), 칸반(2-B), 알림 세분화(2-C), 키보드 내비(2-D), 자료 열기·삭제(2-E). 마이그레이션 `0011` — 호스티드 `db push` 필요. Tier 3은 실데이터 2주 후 (`docs/DEFERRED.md`).
**Phase 4 종료.** G1·G2·G3 통과. G4는 7/8 통과 + 조건 8 운영자 면제 (2026-08-20) — 판정과 면제 사유는 `docs/G4-REPORT.md`. 다음 작업은 업그레이드 Tier 3 (실데이터 2주 후, `docs/DEFERRED.md`).

SPEC 완성 작업 중 (Phase 1·2·3은 G1·G2·G3 통과로 종료, 미구현 항목 해소 중)

**G3 통과 — 판정은 `docs/G3-REPORT.md`.** 5개 조건 전부 통과.

**G2 통과 — 판정은 `docs/G2-REPORT.md`.** 11개 조건 전부 통과 (자동 10 + 수동 1).

AGENTS.md Phase 1 실행 순서 전부 완료. **G1 통과 — 판정은 `docs/G1-REPORT.md`.**

## 완료

### Phase 0
- 스펙·하네스 배치, 서브에이전트 9개 분할
- caldav-spike 7단계 전부 통과 → **CalDAV 직결 채택**
- Next.js 15 스캐폴드 (Next 15.5.22 / React 19.1.0 / TS 5.9.3 strict / Tailwind 4.3.3)

### db-architect
- `supabase/migrations/0001_phase1_core.sql` — Phase 1 테이블 10개
- `lib/types/database.ts` — 생성된 타입 516줄
- 완료 검증 3개 전부 통과 (증거는 아래)

로컬 스택 포트: API 54421 / DB 54422 / Studio 54423 (circle-connect와 겹치지 않게 이동)

### ui-shell
- `app/layout.tsx`(폰트·테마 부트), `app/(dashboard)/layout.tsx`, `components/shell/*`, `components/ui/*` 6종
- `lib/design/tokens.css`, `public/manifest.json`, `public/sw.js`
- 완료 검증 5개 전부 통과 — Lighthouse 접근성 100, axe 위반 0, 가로 스크롤 0, 금지 패턴 0건
- 사이드바 드래그 재정렬 — `user_prefs` 테이블(마이그레이션 0002) 추가 승인 후 구현. 드래그 + Alt+화살표 키보드 대안
- 인증 — 매직 링크 로그인, 미들웨어 세션 가드, 로그아웃. 화이트리스트를 발송 전·미들웨어·RLS 세 곳에서 검사

로컬 스택으로 검증: 비허용 이메일 거부 → 허용 이메일 발송 → Mailpit 링크 → `/auth/callback` 307 → 대시보드 → 로그아웃 시 `sb-*` 쿠키 삭제 후 `/login`

### integration-caldav
- `lib/integrations/caldav/{client,parse,sync}.ts`, `lib/repos/{events,sync-state}.ts`
- `app/api/jobs/sync-calendar/route.ts`, `lib/jobs/cron-auth.ts`, `components/shell/sync-banner.tsx`
- 완료 검증 1~6 통과 (7~9는 ICS라 Phase 2). 캘린더 7개 / 이벤트 69건 미러, 재실행 시 객체 조회 0회
- `scripts/spike-caldav.ts` 삭제 — 프로덕션 코드로 옮겨졌다

### integration-ingest (Phase 1 범위 = 뉴스만)
- `config/news-sources.ts`, `lib/integrations/news/{rss,fetch-news}.ts`, `lib/repos/{news,job-runs}.ts`
- `app/api/jobs/fetch-news/route.ts`, `.github/workflows/cron.yml`
- 완료 검증 1·2·6 통과. 3~5(시세·GitHub)는 SPEC 7절상 Phase 3
- 소스 18개 전부 실제 호출로 200 확인 후 커밋. 수집 270건 (lang 3종 × sector 5종)

### ai-pipeline (Phase 1 범위 = 브리핑만)
- `lib/ai/{client,budget}.ts`, `lib/ai/prompts/briefing.ts`, `lib/repos/{ai-usage,briefings}.ts`
- `app/api/jobs/generate-briefing/route.ts`, `cron.yml`에 06:40 JST 등록
- 완료 검증 1·2·3·6 통과 (4·5는 퀴즈·자료요약이라 Phase 2)
- AI 호출 지점은 `lib/ai/client.ts` 하나뿐. 예산 검사 → 호출 → 사용량 기록 순서를 이 파일이 강제한다

**결정 대기 2건**: 브리핑 모델(Opus 5 vs Sonnet 5, `docs/DECISIONS.md`), G1의 섹션 6건 조건(`docs/DEFERRED.md`).

### ui-widgets
- 위젯 7개 (`components/widgets/*`) + SPEC 6.1 배치의 대시보드
- Phase 1 페이지 5개 실제 화면으로 교체: `/`, `/calendar`, `/tasks`, `/briefing`, `/settings`
- `lib/time.ts`(JST 기준 날짜 계산), `lib/repos/tasks.ts` 추가
- 완료 검증 5개 통과 — 375px 가로 스크롤 0, 모바일 순서 스펙 일치, 글래스 2곳,
  외부 SDK import 0건, Tab 포커스 링 확인, axe 위반 0(라이트·다크)
- 쓰기 경로: `/calendar` 일정 추가(iCloud PUT), `/tasks` 추가·완료. UI에서 만든 일정이
  재동기화에서 되읽히는 것까지 확인 (G1 조건 3)

### verifier (G1)
- `tests/gates/g1.test.ts` + `npm run test:g1` — 조건 1~7 자동, 조건 8은 Lighthouse·브라우저 측정
- **8개 조건 전부 통과.** 판정과 증거는 `docs/G1-REPORT.md`

## Phase 2 (게이트 G2)

범위: 퀴즈·오답노트, 위키(Notion 미러), 과목·자료·성적, MyWaseda ICS 시간표.
실행 순서 전부 완료: ~~db-architect~~ → ~~ai-pipeline(퀴즈)~~ → ~~integration-caldav(ICS)~~ →
~~강의자료·과목~~ → ~~notion-bridge~~ → ~~ui-widgets~~ → ~~verifier(G2)~~

### db-architect (Phase 2)
- `supabase/migrations/0003_phase2_learning.sql` — 퀴즈 3종, 학기·과목·자료 3종
- 0001에서 미룬 `events.course_id` / `tasks.course_id`를 alter로 추가
- `answer_index`는 `0 <= answer_index < array_length(choices,1)` 제약으로 강제 (G2 조건)
- 완료 검증 3개 통과: db reset 성공, 타입 17개 테이블 생성 후 typecheck 통과,
  anon은 6개 테이블 전부 401

### ai-pipeline (Phase 2 — 퀴즈)
- `lib/ai/prompts/quiz.ts`, `lib/repos/quiz.ts`, `app/api/jobs/generate-quiz/route.ts`
- `/quiz` 화면 + 서버 채점 (`app/(dashboard)/quiz/actions.ts`, `components/widgets/quiz-card.tsx`)
- G2 조건 1·2·3 통과: 5문제/도메인 5종(\$0.027), 오답 시 복습 큐 +1/+3/+7일,
  복습 문항이 오늘의 퀴즈 1번 자리에 편입
- 복습만으로 5문제가 차면 AI를 부르지 않는다
- 대시보드 '오늘의 퀴즈' 칸을 실제 위젯으로 교체 (`components/widgets/quiz-summary.tsx`).
  숫자는 `/quiz`와 같은 `todaysQuiz`를 세므로 두 화면이 어긋나지 않는다.
  `PhasePlaceholder`에 남은 건 Phase 3 두 칸뿐이다

### integration-caldav (Phase 2 — MyWaseda ICS)
- `lib/integrations/ics/{parse,ingest}.ts`, `lib/repos/courses.ts`, `app/api/jobs/sync-ics/route.ts`
- `/settings` 업로드 폼 (`components/widgets/ics-upload.tsx` + `settings/actions.ts`)
- G2 조건 6·7·8 통과: 수업 5건 `source='waseda'`, 같은 내용 재실행 시 `skipped: true`,
  과목 연결 3건 / 미매칭 2건이 `job_runs.meta`에 표본까지 기록.
  `kind='ics'`에 `is_writable=true`는 insert·update 양쪽 다 check 제약으로 거부
- 크론 스케줄에는 안 넣었다 — 이유는 `docs/DECISIONS.md`

### 강의자료 · 과목 (Phase 2)
- `supabase/migrations/0004_materials_storage.sql` — 'materials' 버킷(비공개, 50MB, PDF·PPTX만)
- `lib/integrations/materials/extract.ts` — unpdf(PDF) / fflate+fast-xml-parser(PPTX)
- `lib/grades.ts` + `tests/grades.test.ts`, `lib/repos/materials.ts`, `lib/ai/prompts/material.ts`
- `/courses`, `/courses/[id]` + `components/widgets/{course-form,material-panel,grade-select}.tsx`
- G2 조건 4·5·9·10 통과:
  - PDF 275자 / PPTX 218자 추출, 업로드 시점 `ai_usage` 증가 0행
  - 요약 버튼 클릭 후에만 `material_summary` 1행 ($0.0189)
  - 과목 상세에 다음 수업 `9/7 (월) 10:40 · 11号館 402`
  - 과목 3개(4학점 A+ / 2학점 B / 4학점 C) → GPA 2.40 (수기 (16+4+4)/10과 일치)
- 텍스트 추출은 AI를 쓰지 않는다. 업로드만으로 돈이 나가면 안 된다
- 검증 픽스처는 LibreOffice로 만든 실제 PDF·PPTX를 썼다

### notion-bridge
- `lib/integrations/notion/{client,properties}.ts`, `lib/repos/wiki.ts`, `/wiki` 화면
- `scripts/check-notion.ts` + `npm run notion:check`, `docs/NOTION-SETUP.md`
- SPEC 12절대로 Supabase에 미러하지 않고 6시간 캐시. `revalidateTag("wiki")` 새로고침 버튼
- 속성은 이름이 아니라 **타입**으로 찾는다. Notion에서 컬럼 이름을 바꿔도 안 깨진다
- 쓰기 경로 0건 (G2 조건 11)

**Phase 3에서 필요한 값**: `NOTION_DB_{COURSE_NOTES,RESEARCH,ALGO,APPLICATIONS}`.
지금은 없어도 `notion:check`가 넘어간다.

## Phase 3 (게이트 G3)

범위: 티커·시세·환율, GitHub 수집, 지원 파이프라인.
실행 순서: ~~db-architect~~ → ~~integration-ingest(시세·GitHub)~~ → ~~notion-bridge(지원)~~ →
~~ui-widgets~~ → ~~verifier(G3)~~

### db-architect (Phase 3)
- `supabase/migrations/0005_phase3_invest.sql` — tickers, price_snapshots, fx_rates, github_repos, github_daily_commits
- service_role GRANT를 별도로 추가 (0001의 `GRANT ALL ON ALL TABLES`는 당시 테이블만 커버)

### integration-ingest (Phase 3)
- `lib/integrations/finance/{prices,fx}.ts` — yahoo-finance2 v4 + frankfurter.app
- `lib/integrations/github/collect.ts` — repos + PushEvent 일별 집계
- `app/api/jobs/{fetch-prices,sync-github}/route.ts`
- `config/tickers.ts` — 기본 20종목 (시드 자동)
- `cron.yml`에 07:30/07:45 JST 추가

### notion-bridge (Phase 3 — 지원 파이프라인)
- `lib/repos/applications.ts` — Notion Applications DB 읽기 전용, 6시간 캐시, 단계별 그룹핑

### ui-widgets (Phase 3)
- 대시보드: `MarketSnapshotWidget` + `GithubHeatmapWidget`으로 PhasePlaceholder 전부 교체
- `/invest` — 20종목 시세 테이블, USD/KRW 환율, ₩ 환산
- `/portfolio` — 90일 커밋 잔디 히트맵 + 레포 목록
- `/apply` — Notion 지원 파이프라인 단계별 그룹핑
- 사이드바에 투자/포트폴리오/지원 추가

### verifier (G3)
- `tests/gates/g3.test.ts` + `npm run test:g3` — 5개 조건 전부 통과
- **판정과 증거는 `docs/G3-REPORT.md`**

## 크론 배포 시 필요한 GitHub Secrets

`APP_URL` (배포 주소), `CRON_SECRET` (`.env.local`과 같은 값)

## Phase 1에서 아직 필요한 값

- ai-pipeline: `ANTHROPIC_API_KEY`, `AI_MONTHLY_BUDGET_USD=10`
- integration-ingest: `CRON_SECRET`

## SPEC 완성 (Post-Gate)

게이트 3개를 전부 통과한 뒤, SPEC에 있지만 게이트 범위 밖이었던 항목을 해소.

### AI 예산 80% 경고 배너 (SPEC 5.5)
- `components/shell/budget-banner.tsx` — budgetStatus() 80% 이상이면 대시보드 상단에 배너
- `app/(dashboard)/layout.tsx`에 SyncBanner 아래 추가

### PWA 아이콘 (SPEC 1)
- `public/icon-192.png`, `public/icon-512.png` — qlmanage로 SVG에서 변환
- `public/manifest.json`에 3종 아이콘 등록

### Notion DB 미러 3개 (SPEC 3)
- `lib/repos/algo-patterns.ts` → `/wiki`에 알고리즘 패턴 섹션 추가
- `lib/repos/research.ts` → `/invest`에 리서치 노트 섹션 추가
- `lib/repos/course-notes.ts` → `/courses/[id]`에 과목 노트 섹션 추가
- `lib/integrations/notion/properties.ts`에 `richTextOf` 헬퍼 추가
- 모든 Notion DB는 환경변수 미설정 시 빈 배열 반환 (앱 안 깨짐)

### FRED + ECOS API (SPEC 5.3)
- `supabase/migrations/0006_macro.sql` — macro_snapshots 테이블
- `config/macro-series.ts` — FRED 4개 + ECOS 2개 시리즈
- `lib/integrations/finance/{fred,ecos}.ts` — API 클라이언트, 키 없으면 에러 반환
- `lib/repos/macro.ts` — upsert + 최신 조회
- `app/api/jobs/fetch-macro/route.ts` — 잡 엔드포인트
- `/invest`에 매크로 지표 테이블 추가
- `cron.yml`에 07:50 JST 월요일 추가
- `sync-banner.tsx`에 macro 키 추가

## 호스티드 Supabase 반영

로컬에서만 검증했다. `leitsqwmtxqsgnsvzdfc` 프로젝트에는 아직 안 올렸다.

```bash
npx supabase link --project-ref leitsqwmtxqsgnsvzdfc
npx supabase db push
```

`db push`는 마이그레이션만 올린다. 시드는 별도로 넣어야 한다 (`app_config`에 allowed_email 1행).
