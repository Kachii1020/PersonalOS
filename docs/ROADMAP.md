# 다음 작업 로드맵 — Ship / Trust / Phase 4

**작성일**: 2026-08-18
**전제**: G1·G2·G3 전부 통과 (`docs/G{1,2,3}-REPORT.md`). 검증은 전부 로컬 Supabase 기준이며 프로덕션에는 아직 아무것도 없다.

이 문서는 다음 작업 3개 트랙의 실행 계획이다. 에이전트는 이 문서의 순서를 따른다.

```
Track 0 (Ship)   배포 — 지금 있는 것을 실제로 돌린다
      ↓ 0 완료
Track 1 (Trust)  캘린더 정합성 — 매일 보는 데이터의 거짓말을 없앤다
      ↓ 1 완료
Track 2 (Phase 4) SPEC 개정 승인 → 푸시 알림 · 오프라인 · 주간 리뷰
```

## 공통 규칙

- CLAUDE.md Part A를 그대로 따른다. 특히 **스코프 게이트**: Track 2는 SPEC.md 개정이 승인되기 전에는 코드를 한 줄도 쓰지 않는다.
- 트랙마다 별도 브랜치 + PR. 트랙 안의 단계도 논리 단위로 커밋을 쪼갠다.
- 각 단계는 `→ verify:` 체크를 실행하고 **출력을 증거로 남긴 뒤** 다음 단계로 간다. "통과했습니다"만 쓰면 그 자체가 실패다 (AGENTS.md verifier 규칙).
- 완료할 때마다 `docs/DEFERRED.md`의 해당 행을 취소선 처리하고, 아키텍처 결정은 `docs/DECISIONS.md`에 3줄(결정/이유/버린 대안)로 적는다.
- `[사람]` 표시가 붙은 단계는 자격증명이 필요해서 에이전트가 못 한다. 에이전트는 그 단계에서 멈추고 사람에게 넘긴다.

---

## Track 0 — Ship (배포)

목표: PWA 브랜치를 main에 합치고, 호스티드 Supabase + 프로덕션 배포 + 크론까지 실제로 돌게 만든다. 새 기능 0개.

### 0.1 PWA 브랜치 머지

`origin/claude/iphone-app-like-page-nkd0nd` (2커밋: 구현 + `docs/IPHONE-PWA-SPEC.md`)를 main에 머지한다. 내용은 `docs/IPHONE-PWA-SPEC.md`에 전부 기록돼 있다: 하단 탭바(`components/shell/bottom-tab-bar.tsx`), `/more` 페이지, safe area, `viewport-fit=cover`, `black-translucent` 상태바, manifest `scope`/`orientation`.

참고: 이 브랜치의 `package-lock.json` diff(-126줄)는 npm 버전 차이로 인한 `libc` 메타데이터 제거다. 실제 의존성 변경이 아니므로 그대로 받아도 된다.

1. main에 머지 (충돌 없어야 정상 — main 쪽 이후 커밋은 quiz/캘린더 영역)
   → verify: `git merge` 충돌 0건, 있으면 머지 중단하고 보고
2. `npm run typecheck && npm run lint && npm run test:unit`
   → verify: 0 에러 (게이트 테스트는 로컬 Supabase 필요 — 스택이 없으면 unit만)
3. 375px 렌더 확인
   → verify: 하단 탭바 5개 렌더, 가로 스크롤 0, `/more`에 7항목

### 0.2 [사람] 호스티드 Supabase 반영

`docs/DEFERRED.md`·`docs/CURRENT_PHASE.md`가 이미 지적한 항목. 액세스 토큰과 DB 비밀번호가 필요하다.

```bash
npx supabase link --project-ref leitsqwmtxqsgnsvzdfc
npx supabase db push          # 마이그레이션 0001~0007
```

시드는 별도: `app_config`에 `allowed_email` 1행 (SQL Editor에서 직접).
→ verify: 호스티드 Studio에서 테이블 23개 존재, `app_config` 1행

### 0.3 [사람] 프로덕션 배포 + 환경변수

Vercel(또는 동급)에 배포. 환경변수는 SPEC.md 8절 목록 전체. 최소 동작선:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APPLE_ID`, `APPLE_APP_PASSWORD`, `ANTHROPIC_API_KEY`, `AI_MONTHLY_BUDGET_USD=10`, `CRON_SECRET`. Notion·FRED·ECOS 키는 없어도 앱이 안 죽는다 (빈 배열/에러 배너 경로 확인됨).
→ verify: 프로덕션 URL에서 매직 링크 로그인 → 대시보드 렌더 → 500 없음

### 0.4 [사람] GitHub Secrets + 크론 가동

리포 Secrets에 `APP_URL`(배포 주소), `CRON_SECRET`(0.3과 같은 값) 등록.
→ verify: Actions에서 `workflow_dispatch`로 `sync-calendar` 수동 실행 → HTTP 200, `calendars` 행 생성
→ verify: 다음날 아침 브리핑 크론(06:40 JST)이 초록색

### 0.5 [사람] Notion 실토큰 검증

`docs/DEFERRED.md` 1행. 지금까지 실패 경로만 실행해봤다.

```bash
npm run notion:check
```

→ verify: 위키 DB 조회 성공 출력. 실패하면 `docs/NOTION-SETUP.md` 절차로 통합 공유 설정을 확인
→ verify: 프로덕션 `/wiki`에 실제 항목 렌더

### 0.6 [사람] 아이폰 실기기 설치 검증

Safari → 공유 → 홈 화면에 추가. `docs/IPHONE-PWA-SPEC.md` 8절 절차.
→ verify: standalone 실행(주소창 없음), 상태바 투명, 하단 탭바 동작, 노치·홈 인디케이터 침범 없음, 다크모드 전환 정상

### 0.7 문서 정리 (에이전트)

- `docs/DEFERRED.md`: 해소된 행(호스티드 반영, 프로덕션 빌드, Notion 검증) 취소선
- `docs/CURRENT_PHASE.md`: "호스티드 Supabase 반영" 절을 완료로 갱신
→ verify: 두 파일의 서술이 실제 상태와 일치

---

## Track 1 — Trust (캘린더 정합성 블록)

목표: 매일 보는 화면이 거짓말하는 3가지를 없앤다. 전부 `docs/DEFERRED.md`에 이미 적혀 있는 항목이다. 새 화면 0개, 새 외부 의존성 0개.

담당: 1.1·1.2는 integration-caldav 영역, 1.3은 integration-ingest 영역 (AGENTS.md 분담 기준).

### 1.1 RRULE 전개 (반복 일정)

현상: `events.rrule`에 원문만 저장하고 인스턴스를 펼치지 않아서, 매주 반복 일정이 달력에 첫 회차 하루만 보인다.

설계 제약 (DEFERRED에 이미 합의된 방향):
- **읽기 시점 전개.** DB에 인스턴스 행을 만들지 않는다 — 미러를 작게 유지한다.
- 전개 지점은 `lib/repos/events.ts`의 `listEventsBetween` (달력·오늘 일정 위젯이 모두 이 함수를 쓴다).
- 파서는 `ical.js` (이미 의존성에 있다. 새 패키지 금지).
- EXDATE·UNTIL·COUNT를 존중한다. 전개 실패한 rrule은 기존처럼 마스터 1건만 표시하고 로그만 남긴다 — 달력 전체를 죽이지 않는다.

1. `listEventsBetween`이 rrule 있는 행을 표시 범위 내 인스턴스로 전개
   → verify: 매주 반복 이벤트가 월 달력에 4~5회 표시
2. 범위 밖 인스턴스는 만들지 않는다
   → verify: 조회 범위 1주일이면 인스턴스 최대 1~2건
3. DB는 불변
   → verify: 전개 전후 `events` 행 수 동일
4. 단위 테스트: 주간 반복 + EXDATE 1건 픽스처
   → verify: `npm run test:unit` 통과, EXDATE 날짜는 결과에 없음

### 1.2 iCloud 삭제 반영

현상: 동기화가 upsert만 해서, 아이폰에서 지운 이벤트가 미러에 유령으로 남는다.

설계 제약:
- `lib/integrations/caldav/sync.ts`의 `syncCalendars`에서, **ctag가 바뀌어 실제로 객체를 가져온 캘린더에 한해** 조회된 uid 집합에 없는 행을 지운다.
- **주의**: 삭제 판정 기준 집합은 "파싱에 성공한 이벤트"가 아니라 "fetch된 전체 객체"다. 파싱 실패한 객체를 삭제 대상으로 오인하면 안 된다 (현재 코드는 파싱 실패를 건수만 세고 버린다 — uid 추출은 파싱 전 원문에서라도 해야 한다).
- ctag가 같아 건너뛴 캘린더에는 delete 쿼리를 1회도 날리지 않는다 (절대 규칙 2의 연장).
- ICS 캘린더(`kind='ics'`)는 이 로직의 대상이 아니다 — ICS는 content_hash 갱신 시 전체 교체 여부를 별도 확인하고, 이미 처리돼 있으면 건드리지 않는다.

1. 삭제 reconcile 구현
   → verify: iCloud에서 이벤트 1건 삭제 → sync → 미러에서 사라짐, `job_runs` 로그에 삭제 건수
2. 증분 경로 보존
   → verify: 연속 2회 실행 시 두 번째는 "ctag unchanged" + delete 쿼리 0회
3. 오삭제 방지
   → verify: 파싱 실패 객체가 있는 캘린더를 sync해도 해당 이벤트 행이 삭제되지 않음

### 1.3 뉴스 보존 기간

현상: `news_items`가 하루 ~270건씩 무한히 쌓인다 (월 8천 행).

설계 제약:
- 별도 잡을 만들지 말고 `fetch-news` 잡 말미에 정리 단계를 붙인다 (크론 스케줄 추가 없음 — 단순함 우선).
- 보존 30일. **삭제 전에 `briefing_sections`가 `news_items`를 FK로 참조하는지 스키마를 먼저 확인**하고, 참조가 있으면 참조된 행은 남긴다. (DECISIONS.md상 브리핑은 기사 인덱스 방식이므로 참조가 없을 가능성이 높지만, 확인 없이 가정하지 않는다.)
- 삭제 건수를 `job_runs.meta`에 기록한다.

1. 정리 단계 구현
   → verify: 31일 전 타임스탬프의 테스트 행이 잡 실행 후 삭제, 29일 전 행은 유지
2. 기록
   → verify: `job_runs.meta.pruned` 건수 존재

### Track 1 종료 조건

- `npm run typecheck && npm run lint && npm run test` 통과 (로컬 Supabase 기동 상태에서)
- `docs/DEFERRED.md`의 RRULE·삭제 반영·뉴스 보존 3행 취소선
- 스키마 변경이 있었으면 새 마이그레이션 파일로만 (기존 파일 수정 금지)

---

## Track 2 — Phase 4 (푸시 알림 · 오프라인 · 주간 리뷰)

목표: "앱처럼 보이는" 단계(PWA 브랜치)를 넘어 "앱처럼 행동하는" 단계로. 알림이 오고, 오프라인에서 열리고, 일주일에 한 번 자기 데이터를 되돌아본다.

### 2.0 SPEC 개정 — 사람 승인 게이트

**이 단계가 끝나기 전에는 Track 2의 코드를 쓰지 않는다** (CLAUDE.md: SPEC.md를 마음대로 고치지 않는다).

에이전트가 할 일: SPEC.md 개정안을 **diff 형태로 제안**하고 승인을 기다린다. 개정안에 들어갈 것:

1. **5절에 5.6 (Web Push) · 5.7 (오프라인) 추가**
2. **5.5 개정 — AI 호출 지점 정식화**: 현재 규칙은 "호출 지점 3곳"인데, post-gate에 추가된 도메인 레슨(`lib/ai/prompts/domain-lesson.ts` + `scripts/gen-lessons.ts`)이 이미 4번째다. 이번 개정에서 도메인 레슨을 소급 승인하고 주간 리뷰를 5번째로 등재한다. "모든 호출은 `lib/ai/client.ts` 단일 함수 경유"는 불변.
3. **6.1 개정**: 주간 리뷰 표시 위치. 제안: 새 대시보드 위젯이 아니라 `/briefing` 페이지 하단 섹션 (대시보드 배치 변경 없음 = 개정 최소화).
4. **7절에 Phase 4 + G4 추가** (아래 초안)
5. **8절에 환경변수 추가**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`

**G4 통과 조건 초안** (기존 게이트와 같은 문체·검증 가능성 기준):

- [ ] `/settings`에서 푸시 구독 → `push_subscriptions`에 1행 → 테스트 발송 → 기기에 알림 수신 (구독 왕복)
- [ ] 브리핑 잡이 `ready`로 끝나면 푸시가 발송되고, 발송 실패가 브리핑 잡 자체를 실패시키지 않는다
- [ ] 만료된 구독(HTTP 410)은 발송 시 해당 행이 삭제되고 잡은 계속된다
- [ ] 온라인으로 대시보드를 1회 방문한 뒤 네트워크를 끊고 재실행 → 마지막 데이터 + 오프라인 표시로 렌더 (백지·500 없음)
- [ ] 온라인 상태에서는 항상 네트워크 응답이 우선이다 (캐시가 신선한 데이터를 가리지 않는다)
- [ ] 주간 리뷰 잡 1회 실행 → `weekly_reviews` 1행 `ready` + `ai_usage` 정확히 1행
- [ ] 주간 리뷰의 퀴즈 정답률·완료 태스크 수·커밋 수가 SQL 수기 집계와 일치한다 (AI가 지어낸 숫자 금지 — 집계는 SQL, AI는 서술만)
- [ ] 월 예산 소진 상태에서 주간 리뷰 잡 실행 → 402, `weekly_reviews`에 `ready` 행이 남지 않는다

→ verify: 개정 diff가 제안되고 **사람이 승인 답변**을 남김. 승인 후 SPEC.md 커밋.

### 2.1 db-architect

- 마이그레이션 `0008_phase4_push_review.sql`: `push_subscriptions` (endpoint 유니크, p256dh, auth, created_at), `weekly_reviews` (week_start date 유니크, status, content jsonb, created_at). RLS + `is_allowed_user()`, service_role GRANT (0005 전례 참고 — 0001의 GRANT는 당시 테이블만 커버한다).
- `lib/types/database.ts` 타입 재생성.
→ verify: `supabase db reset` 성공, `npm run typecheck` 통과, anon select 401

### 2.2 Web Push (서버: integration-ingest 영역, 클라이언트: ui-shell 영역)

AGENTS.md에 push 담당이 없다. 이 문서가 분담을 정한다: 발송 경로(`lib/integrations/push/`, `lib/repos/push.ts`, 잡 훅)는 integration-ingest 패턴, 구독 UI·서비스 워커·권한 요청은 ui-shell 패턴을 따른다.

설계 제약:
- 라이브러리는 `web-push` (npm 최신). VAPID 키는 서버 전용, 공개키만 `NEXT_PUBLIC_`.
- 발송 지점은 기존 잡의 말미 훅: 브리핑 ready(06:40), 퀴즈 생성 완료 시 복습 대기 건수(07:00), `sync_state` 실패 전환 시.
- **발송 실패는 잡을 실패시키지 않는다.** 실패는 `job_runs.meta`에 기록 (실패는 조용하지 않다 규칙과 양립: 기록하되 전파하지 않음).
- iOS 제약을 UI에 명시: 홈 화면에 설치된 상태에서만 구독 가능(iOS 16.4+), 권한 요청은 반드시 버튼 클릭(사용자 제스처)에서.
- `public/sw.js`에 `push`·`notificationclick` 핸들러 추가. 클릭 시 해당 화면으로 이동 (브리핑 알림 → `/briefing`).

1. 구독 저장/삭제 경로 (+ `/settings` 토글)
   → verify: 구독 시 1행, 해제 시 0행
2. 발송 함수 + 410 정리
   → verify: 가짜 endpoint(410 반환)로 발송 → 행 삭제, 예외 전파 없음
3. 잡 훅 3곳
   → verify: 브리핑 잡 실행 → 발송 로그, 잡 응답은 기존과 동일 구조
4. 실기기 수신은 [사람] — G4 조건 1

### 2.3 오프라인 (ui-shell 영역)

**기존 결정 번복 주의**: 현재 `public/sw.js` 주석은 "HTML·API를 캐시하지 않는다"고 명시한다 (낡은 미러 데이터 불신 문제). 이 결정을 **부분 번복**하되 원래 우려를 지키는 조건을 건다 — 번복 사유를 `docs/DECISIONS.md`에 기록할 것.

설계 제약:
- 내비게이션 요청(HTML)은 **network-first, 캐시는 폴백 전용**. 온라인이면 캐시가 절대 응답하지 않는다 → 낡은 데이터 우려 해소.
- 오프라인 폴백으로 렌더된 화면에는 "오프라인 — 마지막 동기화 데이터" 표시를 띄운다 (SPEC 6.4 규칙 11의 정신: 무엇이 실패했고 왜인지 말한다).
- 캐시 버전을 올리고(`personal-os-static-v2` 등) activate에서 구버전 정리 — 기존 패턴 유지.
- API·Supabase 요청은 여전히 캐시하지 않는다. 캐시 대상은 내비게이션 HTML + 기존 `/_next/static`뿐.

1. SW 전략 구현
   → verify: 온라인 방문 → 오프라인 전환 → 대시보드·`/briefing`·`/quiz` 렌더 (마지막 상태)
2. 온라인 우선 보장
   → verify: 온라인 상태에서 서버 응답 변경 → 새로고침에 즉시 반영 (캐시 개입 없음)
3. 오프라인 표시
   → verify: 오프라인 렌더 화면에 표시 존재, 온라인 복귀 시 사라짐

### 2.4 주간 리뷰 (ai-pipeline 영역)

설계 제약:
- **집계는 SQL, AI는 서술만.** 원시 행을 프롬프트에 넣지 않는다. 주간 집계(퀴즈 도메인별 정답률, 완료/신규 태스크, 일별 커밋, 다음 주 마감·일정 목록)를 서버에서 계산해 숫자로 넘긴다. AI가 숫자를 만들면 반려.
- 호출은 `lib/ai/client.ts`의 `callStructured` 재사용 — 예산 가드·`ai_usage` 기록 자동.
- 1회 호출. 섹션별로 쪼개 부르면 반려 (브리핑과 같은 규칙).
- 잡: `app/api/jobs/generate-weekly-review/route.ts`, `cron.yml`에 일요일 21:00 JST(= 일요일 12:00 UTC) 추가.
- UI: `/briefing` 하단 섹션 (2.0에서 승인된 위치).

1. 프롬프트 + 잡
   → verify: 실행 → `weekly_reviews` 1행 ready, `ai_usage` 정확히 1행
2. 집계 정확성
   → verify: 리뷰 속 숫자 3종이 SQL 직접 집계와 일치
3. 예산 차단
   → verify: 예산 조작 후 실행 → 402, ready 행 없음
4. UI
   → verify: `/briefing`에 최신 주간 리뷰 렌더, 없으면 EmptyState(다음 행동 제시)

### 2.5 verifier (G4)

- `tests/gates/g4.test.ts` + `npm run test:g4` (package.json에 추가, `test`에 편입).
- 기기 수신(조건 1)과 오프라인 실기기 확인은 수동 판정으로 표기 — G2 조건 2의 전례.
- 판정과 증거는 `docs/G4-REPORT.md`.
→ verify: 자동 조건 전부 통과 출력, 수동 조건은 사람 확인 기록

### Track 2 종료 조건

- G4 전 조건 통과, `docs/G4-REPORT.md` 작성
- `docs/CURRENT_PHASE.md`를 Phase 4 완료로 갱신
- `docs/DECISIONS.md`: SW HTML 캐시 번복, AI 호출 지점 5개 정식화, 주간 리뷰 표시 위치 — 3건 기록

---

## 이 로드맵이 하지 않는 것 (다음 후보, 착수 금지)

논의에서 나왔지만 이번 3트랙에 넣지 않은 것들. 필요해 보여도 만들지 말고 여기 둔다.

- ⌘K 커맨드 팔레트 (통합 검색)
- 포트폴리오 실보유 종목 (수량·평단·손익)
- 퀴즈 학습 분석 (도메인별 정답률 추이, 스트릭)
- 지원 파이프라인 Notion 쓰기 (단계 변경 — 유일하게 허용된 쓰기 예외, 별도 승인 필요)
- Apple 스플래시 스크린, 풀-투-리프레시, 탭바 커스터마이즈 (`docs/IPHONE-PWA-SPEC.md` 9절)
- 강의자료 열기·삭제(서명 URL), 스캔 PDF OCR — `docs/DEFERRED.md` 유지
