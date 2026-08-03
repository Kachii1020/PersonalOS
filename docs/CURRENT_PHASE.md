Phase 1 — 진행 중

AGENTS.md 실행 순서: ~~db-architect~~ → ~~ui-shell~~ → ~~integration-caldav~~ → ~~integration-ingest~~ → ~~ai-pipeline~~ → **ui-widgets** → verifier(G1)

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

## 다음: ui-widgets

`.claude/agents/ui-widgets.md` 참조. SPEC.md 6.1 레이아웃, 6.4의 12개 규칙.
Phase 1 위젯 7개만: MonthCalendar / TodaySchedule / WeekDeadlines / DailyBriefing /
DailyQuiz·MarketSnapshot·GithubHeatmap(자리표시자).
글래스는 MonthCalendar와 DailyBriefing 2곳만. 데이터는 `lib/repos/*`로만 가져온다.

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
