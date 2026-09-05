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
- Phase 5B 코드는 구현하지 않았다. 기존 Learn/Quiz 코드·테스트·migration은 변경하지 않았다.
- cron과 hosted migration, 배포는 실행하지 않았다.

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
| supabase db reset --local | 실행했으나 실패. 아래 CLI/환경 제한 참조 |
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

## 전체 회귀 실행 결과와 남은 제한

`npm test`를 실제 실행했다. unit 통과 후 G1 실패로 중단되어 G2, G3, G4를 각각 별도 실행했다. 테스트 조건을 약화하거나 기존 테스트 파일을 고치지 않았다.

| 게이트 | 결과 | 원인/해석 |
|---|---|---|
| G1 | 1 pass / 6 fail | 격리 환경에 iCloud 인증/캘린더, 수집 뉴스, Anthropic 연동이 없어 실패 |
| G2 | before hook 실패, 10 cancelled | NOTION_TOKEN 없음; 취소를 통과로 집계하지 않음 |
| G3 | 4 pass / 1 fail | GITHUB_USERNAME 미설정. Notion 항목은 미설정 fallback 경로만 검사됨 |
| G4 | 5 표기 / 3 fail | 앞의 5개에는 수동 확인 안내 3개와 단위 테스트 참조 2개가 포함됨. 실제 실기기 검증 아님. 뉴스/Anthropic 미설정 및 기존 테스트의 Response body 중복 읽기 오류 |

기존 저장소에는 관련 연동 설정이 있지만 이를 테스트 worktree로 복사하려는 작업이 **자동 승인 검토에서 거부**됐다. 사유는 Apple·Anthropic·Notion·GitHub 자격증명 이동과 이후 외부 서비스 호출에 대한 명시적 승인 부족이다. 해당 전송은 실행되지 않았다. 실제 연동 회귀를 재실행하려면 그 용도의 승인이 필요하다.

### CLI/환경 제한

- 기존 로컬 PersonalOS(54421/54422)는 수정하거나 reset하지 않았다. 전용 테스트 스택은 54621/54622다.
- /private/tmp의 Colima 파일 공유 문제로 첫 기동이 실패했다. 공유 가능한 worktree 아래 `test-results/g5a-stack`으로 이동했다.
- `supabase db reset`은 컨테이너 재생성 뒤 연결 시간 초과/초기화 오류로 실패했다. 직접 DB URL 및 agent 모드 변경 재시도도 성공하지 않았다.
- Colima VM은 메모리 약 3.9GiB, 당시 가용 약 237MiB였다. 다른 프로젝트 컨테이너는 중지하지 않았다.
- G5A에서 사용하지 않는 realtime/storage-api를 제외한 전용 스택을 새로 초기화해 migration 전체 실행과 DB 통합 검증을 완료했다. `--ignore-health-check`를 사용한 기동 종료 코드를 건강 상태의 증거로 쓰지 않았으며, 실제 인증·REST·SQL·E2E 응답으로 검증했다.
- reset 성공, hosted DB push, deployment, push 수신, 물리 iPhone 왕복은 **통과로 판정하지 않는다**.

## 다음 운영 게이트

- [ ] 승인된 외부 연동 설정으로 G1~G4 재검증 및 기존 G4 테스트 결함 별도 처리
- [ ] 정상적인 CLI 환경에서 db reset 성공 확인
- [ ] 열린 Learn PR의 0014 merge/renumber 결정 (다른 PR은 변경하지 않음)
- [ ] hosted migration 적용 및 배포 (이번 작업에서는 미실행)
- [ ] 실제 iPhone/Mac PWA 왕복과 push 확인
- [ ] 위 결과 확인 후 cron 연결, G5A 최종 판정

위 체크 완료 전까지 Phase 5B와 cron 활성화를 진행하지 않는다.
