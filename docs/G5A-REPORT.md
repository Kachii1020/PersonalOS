# G5A 통합 검증 보고서

**판정: 로컬 구현·DB·브라우저 검증 통과 / G5A 최종 운영 게이트 미통과**
**검증일: 2026-09-05 (JST)**

**기준 main: `1e0c013882dc9cbda248a2917d9623ba3aa31713`**
**브랜치: `codex/phase5a`**

## 적용 및 구현

- 사용자 제공 `PersonalOS-Phase5A-bundle.zip`의 내부 SHA256SUMS 4건 모두 일치. 같은 main 기준 패치 33개 파일을 `git apply --check` 후 적용했다. 덮어쓰기를 위한 main 재설정은 하지 않았다.
- 번들에 별도 CODEX_WORK_HANDOFF.md는 없었다. README와 PHASE5A-APPLY.md의 적용/검증 절차를 사용했다.
- Inbox → event → 저장된 run 단계 → approval → CREATE_TASK → audit → Today 구현.
- 원본 0015 migration을 그대로 보존하고 0016·0017에 통합 결함을 수정했다.
- 실제 로컬 PostgreSQL에서 생성한 타입을 기존 `lib/types/database.ts`에 추가했다. 임시 overlay와 전용 Supabase client는 제거했다.
- Phase 5B는 구현하지 않았다. Learn/Quiz 기능 코드는 유지했다. 2026-09-06 명시적 승인으로 공통 0014 원본 파일, 해당 generated type, G2/G4 검증 코드와 Playwright 개발 의존성만 추가·수정했다.
- cron과 hosted migration, 수동 배포는 실행하지 않았다. PR 연결 Vercel 자동 검사에서는 deployment completed / SUCCESS가 보고됐지만 배포 환경의 G5A 기능 검증은 하지 않았다.

## 통합에서 수정한 결함

1. 부분 unique index로 인해 PostgREST ON CONFLICT가 실패하는 문제: 일반 unique index로 수정. NULL인 수동 태스크는 여러 건 저장할 수 있다.
2. 태스크 생성 후 완료 기록이 실패하는 문제: 승인·만료·worker lease를 재확인하고 태스크/실행·검증 audit/run 완료를 한 트랜잭션으로 기록한다.
3. 승인 준비와 run 상태 전이가 분리된 문제: 하나의 RPC에서 원자적으로 저장한 뒤 best-effort push를 시도한다.
4. anon의 명시적 기본 EXECUTE 권한: 새 worker RPC에서 anon을 명시적으로 revoke했다.
5. 일반 클라이언트가 approval_request_id를 선점할 수 있는 문제: 연결의 insert/update를 막고 기존 수동 태스크 생성·제목 수정은 유지한다.
6. 실패한 event worker가 HTTP 200/ok로 기록되는 문제: HTTP 500과 failed job_runs를 기록한다.
7. Today가 날짜순 첫 100개만 평가하던 문제: 열린 태스크를 페이지 단위로 전부 읽고 순위를 계산한다.
8. UI 처리 중/오류/빈 상태/로딩을 기존 컴포넌트 규칙에 맞춰 추가했다.

## 실제 실행한 검증

| 검증 | 실제 결과 |
|---|---|
| npm ci --no-audit --no-fund | 종료 코드 0, 471 packages |
| npm run typecheck | 통과 |
| npm run lint | 통과 (최종 코드에서 경고 0) |
| npm run test:unit | 135/135 통과 |
| npm run test:g5a | 구조 게이트 10/10 통과, 독립 검증자도 재실행 |
| npm run test:g5a:local | 실제 DB 게이트 10/10 통과, 0 skip / 0 cancel; 최종 프로덕션 서버 대상 1.31초 |
| npm run build | 종료 코드 0, /inbox·/approvals·/today 및 job routes 생성 |
| supabase start (격리 스택) | 0001~0017 중 존재하는 15개 migration 실제 실행, seed 적용 |
| supabase gen types typescript --local | 실제 schema 타입 생성 성공 |
| supabase db reset --local | 초기 실패 후 2026-09-06 내장 native CLI로 성공. Phase 5A-only 및 0014 포함 순서 모두 exit 0 |
| 브라우저 E2E | 375px 입력 → 별도 1440px 컨텍스트 승인 → /tasks → /today 확인 |
| 화면 검사 | 3개 경로 × 375/1440px 가로 넘침 0, pageerror 0, 라이트/다크 스크린샷 검토 |
| git diff --check | 통과 |

빌드는 기존 페이지의 static-render 탐색 중 cookies 관련 DYNAMIC_SERVER_USAGE 로그를 출력하지만 최종 종료 코드는 0이며 해당 경로는 dynamic route로 생성된다.

로컬 DB 게이트는 실테이블을 사용하여 trigger dedupe, 동시 event/run/action claim, 중단 후 current_step 재개, 승인 전 태스크 0건, 승인/실행 중복 요청, reject audit, 만료·stale lease 차단, 트랜잭션 실패 롤백, 권한 제한, 수동 태스크 호환성, 100개 초과 우선순위 평가, AI 호출 없이 brief 저장, 실패 HTTP/job 로그를 검사했다.

## 대표 E2E의 DB 증거

전체 기계 판독 증거: [local-e2e.json](g5a-evidence/local-e2e.json).

- 입력: `할 일: Finatext 지원동기 완성 · G5A browser`
- inbox: `605d62f8-5cac-4f98-a86c-8cd000a4d0f8`, act_now
- event: `1782e8f7-5873-4e32-85cf-145f363a3d52`, processed, 한 건
- run: `7123bee2-cfd2-4334-a78d-2b86df33c141`, completed / verified
- approval: `acac156b-a279-4570-b2ed-af7f009d10c9`, executed
- task: `56535754-9538-473f-a0c8-1a4ba474803d`, 정확히 한 건
- audit: requested → approved → executing → executed → verified
- 세 job을 재실행한 결과: HTTP 200, 두 worker idle, command brief에 위 task 표시. 태스크 건수는 한 건 유지.
- 브라우저는 두 Chromium 컨텍스트로 기기 간 공유 상태를 검사했다. **물리 iPhone/Mac PWA 왕복을 실행한 것은 아니다.**

[모바일 Inbox](g5a-evidence/mobile-inbox.png) · [데스크톱 승인](g5a-evidence/desktop-approvals.png) · [모바일 Today](g5a-evidence/mobile-today.png) · [다크 Today](g5a-evidence/mobile-today-dark.png)

스크린샷의 iCloud/AI 예산 배너는 앞선 회귀 테스트가 격리 DB에 만든 실패/예산 probe 상태다. 운영 계정의 상태를 의미하지 않는다.

## 사용자 승인 후 실제 외부 연동 회귀 (2026-09-05 23:51~23:54 JST)

최초 격리 환경에서는 외부 설정 부재로 G1~G4가 실패/취소됐고, 설정 복사는 자동 승인 검토에서 거부됐다. 이후 사용자가 기존 Apple·Anthropic·Notion·GitHub 설정 재사용과 실연동 검증을 명시적으로 승인했다. 승인 후 해당 설정만 gitignored 테스트 환경에 복사했고, 운영 DB/푸시 설정은 복사하지 않았다.

뉴스 수집 21개 소스 / 312건 / 실패 0건과 iCloud 동기화가 실제 HTTP 200을 반환했다. 이어 `npm test`를 다시 실행해 unit, G1, G2를 수행했다. G2 실패에서 중단되어 G3, G4, G5A 구조 및 DB 테스트를 각각 실행했다. 원본 테스트와 관련 Learn/Quiz 코드는 변경하지 않았다.

기계 판독 증거: [live-regression.json](g5a-evidence/live-regression.json). 기존 G2/G4 테스트·Quiz 파일의 main/branch blob hash가 동일함도 포함한다.

| 게이트 | 실제 결과 | 근거/남은 문제 |
|---|---|---|
| unit | 135/135 pass | 전체 단위 테스트 |
| G1 | 7/7 pass | 실제 iCloud 생성·재동기화, AI 브리핑 5개 섹션, usage 1행, 예산 초과 HTTP 402, 실패 배너 |
| G2 | 9 pass / 1 fail | PDF/PPTX·ICS·GPA·Notion 위키 포함 통과. 조건 3은 첫 HTML에서 복습 배지를 찾는 기존 테스트 실패 |
| G3 | 5/5 pass | 시세 20건·환율·GitHub 수집/렌더 통과. NOTION_DB_APPLICATIONS는 원래 미설정이므로 조건 5는 fallback만 확인 |
| G4 | 6 표기 / 2 fail | 조건 2 실제 브리핑 잡 통과. 나머지 5 표기에는 수동 안내 3개와 단위 참조 2개가 포함됨. 조건 6·8은 기존 테스트의 Response body 중복 읽기 오류 |
| G5A 구조 / 실제 DB | 각각 10/10 pass | 실연동 회귀 이후 재실행, 취소·skip 0 |

### 남은 실패의 진단

- **G2 조건 3**: 현재 `QuizFlow`는 학습 단계(step 0)에서 시작하므로 첫 HTML에 복습 배지가 없다. 실제 브라우저에서 `학습 완료, 퀴즈 시작` 클릭 후 첫 번째 `1.투자은행` 문항에 복습 배지가 표시되는 것을 확인했다. 답안은 제출하지 않았다. 이 보충 관찰을 원본 자동 테스트 통과로 바꾸지 않았다.
- **G4 조건 6·8**: `tests/gates/g4.test.ts`가 성공 시에도 오류 메시지 인자에서 `response.text()`를 소비한 뒤 `response.json()`을 호출해 `Body is unusable`로 멈춘다. main과 동일한 기존 코드이며 수정하지 않았다.
- **G4 보충 관찰**: 실제 weekly_reviews ready 1행과 weekly_review usage 1행($0.0057)이 저장됐다. 예산 probe 후 이미 ready인 리뷰 요청은 HTTP 200 / skipped=true를 반환했고 AI usage 및 ready 행 증가가 0이었다. 이는 캐시 분기가 예산 검사보다 먼저 실행되는 기존 동작이다. 원본 조건 8의 HTTP 402 기대값은 충족했다고 판정하지 않는다.

### 비용과 정리

- 기록된 실제 AI 호출 4회: briefing $0.0381, quiz $0.0427, briefing $0.0385, weekly_review $0.0057. DB 4자리 반올림 기준 총 **$0.1250**.
- G1은 기존 after-hook에서 로컬 미러만 삭제하므로, 실행 전후 CalDAV 객체 URL을 비교해 이번 실행이 만든 검증 일정 **1건만 원격 삭제**했다. 재조회로 해당 객체가 사라진 것을 확인했다. 기존 일정은 삭제하지 않았다.
- G4가 남긴 합성 budget probe와 추가 진단용 budget probe는 격리 DB에서 제거했다.
- 검증 종료 후 테스트 서버를 정지하고 임시 복사한 연동 설정을 제거해 원래 테스트용 `.env.local`로 복원했다. 원본 저장소 설정은 변경하지 않았다.

### CLI/환경 제한 및 2026-09-06 해결 결과

- 기존 로컬 PersonalOS(54421/54422)는 수정하거나 reset하지 않았다. 전용 테스트 스택은 54621/54622다.
- /private/tmp의 Colima 파일 공유 문제로 첫 기동이 실패했다. 공유 가능한 worktree 아래 `test-results/g5a-stack`으로 이동했다.
- `supabase db reset`은 컨테이너 재생성 뒤 연결 시간 초과/초기화 오류로 실패했다. 직접 DB URL 및 agent 모드 변경 재시도도 성공하지 않았다.
- Colima VM은 메모리 약 3.9GiB, 당시 가용 약 237MiB였다. 다른 프로젝트 컨테이너는 중지하지 않았다.
- G5A에서 사용하지 않는 realtime/storage-api를 제외한 전용 스택을 새로 초기화해 migration 전체 실행과 DB 통합 검증을 완료했다. `--ignore-health-check`를 사용한 기동 종료 코드를 건강 상태의 증거로 쓰지 않았으며, 실제 인증·REST·SQL·E2E 응답으로 검증했다.
- **2026-09-06 후속 검증**: 설치된 `@supabase/cli-darwin-arm64/bin/supabase-go` 2.111.0을 직접 실행해 Phase 5A-only reset과 0014 포함 reset을 각각 종료 코드 0으로 완료했다. 두 번째는 테스트 설정에서 미사용 Realtime을 명시적으로 껐다. 일반 wrapper의 모든 환경에서 오류가 해결됐다고 일반화하지 않는다.
- 0014 포함 reset 직후 첫 DB 게이트는 인증 서버 초기 시간 초과로 취소됐다. healthy 확인 후 동일 테스트를 다시 실행해 **10/10 통과, skip/cancel 0**을 확인했다. 구조 게이트 10/10, 단위 135/135, typecheck/lint도 통과했다.
- 실제 운영 migration 목록은 0013까지다. 두 Learn PR의 0014 파일과 테스트 복사본은 같은 blob이다. 자세한 반영안과 원본 hash는 [migration preflight](PHASE5A-MIGRATION-PREFLIGHT.md), 실제 reset 로그와 DB 상태는 [ordered-reset.txt](g5a-evidence/ordered-reset.txt), [migration-compatibility.txt](g5a-evidence/migration-compatibility.txt), [ordered-db-gate.txt](g5a-evidence/ordered-db-gate.txt)에 있다.
- 운영 DB push, 배포 환경 기능 검증, push 수신, 물리 iPhone 왕복은 **통과로 판정하지 않는다**.

### 범위 승인 후 최종 자동 회귀 (2026-09-06 00:19~00:22 JST)

앞선 자동 승인 검토 거부 뒤 사용자가 공통 0014 포함 및 G2/G4 검증 코드·필요한 Playwright 개발 의존성 수정을 명시적으로 허용했다. 승인된 작업을 완료했다.

- 0014는 두 Learn PR과 같은 blob `e5fd3e3277bca4fb5ac49103085a84f8fa900608`이며 기능 코드나 기존 PR을 변경하지 않았다. 실제 DB에서 workbook_submissions 타입 27줄을 생성해 공통 타입에 합쳤다.
- G2 조건 3은 Playwright로 학습 완료 버튼을 누른 뒤 첫 문항 헤더의 복습 배지와 복습 1문제 표시를 검사한다. 답안은 제출하지 않는다.
- G4는 응답을 한 번만 소비한다. 새 생성은 실제 ready 1행·AI usage +1행, 예산 소진의 새 생성은 HTTP 402·신규 ready/usage 0행, 캐시는 별도 회귀에서 HTTP 200/skipped·변경 0건을 요구한다. 검증 조건을 완화하지 않았다.
- 임시 리뷰는 전체 원본을 저장/복원하고, 예산 probe는 고유 marker로 제거한다. G2/G4 fixture 검증은 loopback URL과 `GATE_ISOLATED_DB=1`을 요구한다.
- 독립 검증자가 최종 검사와 데이터 복원 경로를 재검토했고 차단 결함이나 조건 완화를 발견하지 않았다.

실제 명령: `GATE_ISOLATED_DB=1 GATE_BROWSER_CHANNEL=chrome npm test` (원격 G1 테스트 일정 정리 wrapper 사용).
**전체 npm test 종료 코드 0, 실패 0건**. [JSON 증거](g5a-evidence/approved-regression.json) · [검증 출력](g5a-evidence/approved-regression.txt).

| 검사 | 최신 결과 |
|---|---|
| 단위 | 135/135 pass |
| G1 | 7/7 pass |
| G2 자동 조건 | 10/10 pass (G2 수동 조건 2는 이번 실행에 포함되지 않음) |
| G3 | 5/5 pass (Notion Applications는 미설정 fallback) |
| G4 | 실행 4/4 pass, skip 5: 실기기 조건 1·4·5 및 unit에서 별도 실행한 참조 3·7 |
| G5A 구조 | 10/10 pass |
| G5A 실제 DB 별도 재실행 | 10/10 pass, skip/cancel 0 |
| typecheck / lint / 최종 production build | 모두 종료 코드 0 |

이번 재실행의 기록된 AI 비용은 **$0.1348** (4회, DB 반올림 값)이다. 이전 $0.1250 실행과 다른 회차다. 새 iCloud G1 테스트 일정 1건은 원격 삭제 후 부재를 검증했다.

이 자동 회귀 성공은 실기기·hosted migration·배포 환경 E2E 통과를 의미하지 않는다. 앞 절의 G2/G4 실패는 승인 전 실행 이력이며 이번 수정/재검증으로 해소됐다.

## 다음 운영 게이트

- [x] 사용자 승인된 외부 설정으로 G1~G4 재검증 및 G5A 회귀 재실행
- [x] 사용자 승인 범위에서 G2/G4 검증 코드 수정 및 전체 자동 회귀 성공
- [x] 내장 native CLI에서 db reset 성공 확인 (Phase 5A-only / 0014 포함 각각)
- [x] 공통 0014 원본을 현재 PR의 선행 migration으로 포함 (다른 Learn PR/기능 코드는 변경하지 않음)
- [ ] hosted migration 적용 및 배포 (이번 작업에서는 미실행)
- [ ] 실제 iPhone/Mac PWA 왕복과 push 확인
- [ ] 위 결과 확인 후 cron 연결, G5A 최종 판정

위 체크 완료 전까지 Phase 5B와 cron 활성화를 진행하지 않는다.
