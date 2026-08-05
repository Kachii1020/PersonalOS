Phase 2 — 진행 중 (Phase 1은 G1 통과로 종료)

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
실행 순서: ~~db-architect~~ → notion-bridge(막힘) → ~~ai-pipeline(퀴즈)~~ → ~~integration-caldav(ICS)~~ → **강의자료** → ui-widgets → verifier(G2)

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

**막힌 것**: notion-bridge는 `NOTION_TOKEN`과 `NOTION_DB_*` 5종이 있어야 시작한다.
그전까지 스키마·퀴즈·ICS는 진행할 수 있다.

## 크론 배포 시 필요한 GitHub Secrets

`APP_URL` (배포 주소), `CRON_SECRET` (`.env.local`과 같은 값)

## Phase 1에서 아직 필요한 값

- ai-pipeline: `ANTHROPIC_API_KEY`, `AI_MONTHLY_BUDGET_USD=10`
- integration-ingest: `CRON_SECRET`

## 호스티드 Supabase 반영

로컬에서만 검증했다. `leitsqwmtxqsgnsvzdfc` 프로젝트에는 아직 안 올렸다.

```bash
npx supabase link --project-ref leitsqwmtxqsgnsvzdfc
npx supabase db push
```

`db push`는 마이그레이션만 올린다. 시드는 별도로 넣어야 한다 (`app_config`에 allowed_email 1행).
