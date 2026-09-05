# Phase 5A 적용 및 검증 순서

이 변경은 `main` SHA `1e0c013882dc9cbda248a2917d9623ba3aa31713`을 기준으로 작성했다.

## 2026-09-05 통합 결과와 재현

이 PR에는 번들 0015와 통합 보강 0016·0017이 함께 들어 있다. 원본 migration은 수정하지 않았다. 실제 DB 타입을 `lib/types/database.ts`에 합쳤고 임시 overlay는 제거했다. 실행 결과와 실패/미실행 구분은 [G5A-REPORT.md](G5A-REPORT.md)에 있다.

다음은 새 worktree에서 **운영 계정 데이터 없이** 검증할 때의 절차다. `.env.local`이 이미 있으면 setup 스크립트가 덮어쓰기를 거부한다. 테스트 API/DB 포트는 54621/54622이며 기존 PersonalOS 54421/54422와 다르다.

```bash
npm ci
mkdir -p test-results/g5a-stack/supabase
cp tests/fixtures/g5a-supabase.toml test-results/g5a-stack/supabase/config.toml
cp tests/fixtures/g5a-seed.sql test-results/g5a-stack/supabase/seed.sql
ln -s ../../../supabase/migrations test-results/g5a-stack/supabase/migrations
npx supabase start --workdir test-results/g5a-stack -x realtime,storage-api --ignore-health-check
node scripts/setup-g5a-env.mjs
npm run dev -- --hostname 127.0.0.1 --port 3055
```

`--ignore-health-check`는 성공 증거가 아니다. 아래 검증의 실제 응답을 확인한다. 메모리가 충분한 환경에서는 제외 옵션 없이 전체 스택을 시작하고 다음 명령으로 reset까지 검증한다. 초기 wrapper reset은 실패했지만, 2026-09-06 같은 머신의 내장 native CLI로 reset을 실제 완료했다. 검증된 macOS 명령과 0014 적용 순서는 [PHASE5A-MIGRATION-PREFLIGHT.md](PHASE5A-MIGRATION-PREFLIGHT.md)를 따른다.

```bash
npx supabase db reset --local --workdir test-results/g5a-stack
npm run typecheck
npm run lint
npm run test:unit
npm run test:g5a
npm run test:g5a:local
```

브라우저 검증은 새 테스트 DB에서 한 번 실행한다. 이미 브라우저 fixture가 있으면 별도 새 스택을 사용한다. auth-state는 gitignored `test-results/`에만 저장된다.

```bash
node scripts/g5a-browser-session.mjs
playwright-cli -s=g5a open http://localhost:3055/inbox --browser chrome
playwright-cli -s=g5a state-load test-results/g5a.auth-state.json
playwright-cli -s=g5a goto http://localhost:3055/inbox
playwright-cli -s=g5a run-code --filename=scripts/g5a-browser-flow.js > test-results/g5a-browser.log
node scripts/g5a-evidence.mjs
```

G1~G4는 별도로 실제 외부 연동과 기존 fixtures가 필요하다. G5A의 테스트용 환경만으로 전체 회귀가 통과한다고 주장하지 않는다. 이 PR은 기존 회귀 테스트를 수정하지 않았다.

### 로컬 작업 정리 및 롤백

전용 스택만 정지할 때 `npx supabase stop --workdir test-results/g5a-stack`을 사용한다. 볼륨은 보존되며 다른 프로젝트는 정지하지 않는다. `.env.local`과 auth-state를 커밋하지 않는다.

운영 rollback은 우선 이전 앱 버전으로 되돌리고 JARVIS job을 비활성화한다. 새 테이블/nullable task 컬럼은 기존 앱과 호환되므로 데이터를 삭제하지 않고 보존한다. 스키마 제거가 필요하면 데이터 백업 후 별도 reviewed migration으로 수행한다. 이번 작업에서는 운영 rollback이나 데이터 삭제를 실행하지 않았다.

## 0. migration 번호 확인

열린 Learn workbook PR들이 `0014`를 사용하고 있다. 다음 중 하나가 끝나기 전에는 hosted DB에 `0015_jarvis_core.sql`을 적용하지 않는다.

1. `0014` PR을 먼저 merge하고 hosted DB에 적용한다.
2. `0014` PR을 폐기하거나 다른 번호로 바꾼다.

코드 review와 local test는 먼저 진행해도 된다.

## 1. patch 적용

```bash
git checkout main
git pull --ff-only
git checkout -b codex/phase5-jarvis-core

git apply --check phase5a-jarvis-core.patch
git apply phase5a-jarvis-core.patch
```

메일형 patch를 사용할 때는 다음과 같다.

```bash
git am phase5a-jarvis-core.mbox
```

## 2. generated type 갱신

migration 적용 후의 타입 통합은 이 PR에서 완료했다. 이후 schema가 바뀌면 다음 방식으로 다시 생성하고 관련 변경만 검토한다.

```bash
npx supabase db reset
npx supabase gen types typescript --local > lib/types/database.ts
```

호스티드 기준으로 생성할 때는 프로젝트의 기존 방식에 맞춰 `--linked`를 사용한다.

## 3. 정적 검증

```bash
npm install
npm run typecheck
npm run lint
npm run test:unit
npm run test:g5a
npm test
```

`G5A-REPORT.md`에는 이 명령을 실제 repository에서 실행하기 전까지 전체 통과라고 기록하지 않는다.

## 4. 로컬 DB 검증

```bash
npx supabase db reset
```

확인 항목:

- `inbox_items` insert 한 건이 `system_events` 한 건을 만든다.
- anon은 새 테이블을 읽을 수 없다.
- authenticated user는 inbox select/insert만 가능하다.
- authenticated user는 approval payload를 직접 update할 수 없다.
- `decide_approval`만 승인 상태를 바꿀 수 있다.
- 동일 approval로 task가 두 건 만들어지지 않는다.

## 5. 수동 job 실행

migration과 배포가 끝난 뒤에만 실행한다.

```bash
curl -X POST "$APP_URL/api/jobs/process-system-events" \
  -H "x-cron-secret: $CRON_SECRET"

curl -X POST "$APP_URL/api/jobs/process-approved-actions" \
  -H "x-cron-secret: $CRON_SECRET"

curl -X POST "$APP_URL/api/jobs/generate-command-brief" \
  -H "x-cron-secret: $CRON_SECRET"
```

## 6. 대표 end-to-end

1. iPhone PWA `/inbox`에서 `할 일: Finatext 지원동기 완성` 입력
2. `/approvals`에서 `CREATE_TASK` 요청 확인
3. Mac에서 같은 승인 요청이 보이는지 확인
4. 승인 후 `/tasks`에 정확히 한 건 생성되는지 확인
5. 승인 버튼을 다시 누르거나 job을 재실행해도 중복이 없는지 확인
6. `/today`에서 생성된 task가 우선순위에 따라 표시되는지 확인
7. `action_audit_logs`에 `requested → approved → executing → executed → verified`가 남는지 확인

## 7. cron 활성화

위 end-to-end가 통과한 뒤 `.github/workflows/cron.yml`에 작은 job 세 개를 추가한다. 먼저 5분 단위로 검증하고, 안정화 후 빈도를 낮춘다.

- `process-system-events`
- `process-approved-actions`
- `generate-command-brief`

DB migration 전에 cron을 먼저 켜지 않는다.

## 8. 아직 하지 않는 것

- Phase 5B Career Secretary
- Gmail과 이메일 전송
- CalDAV 승인 executor
- AI 기반 triage
- 네이티브 앱과 음성
- Mac device bridge

## 9. 기존 결정·보류 로그에 추가할 내용

현재 patch bundle은 기존 대형 로그 파일과의 충돌을 줄이기 위해 `docs/DECISIONS.md`와 `docs/DEFERRED.md`를 직접 수정하지 않는다. 적용 PR에서 아래 내용을 append한다.

### `docs/DECISIONS.md`

```markdown
## 2026-09-05 — JARVIS Core는 저장형 상태 머신으로 시작

- **결정**: Phase 5A는 자유형 multi-agent가 아니라 `system_events → agent_runs → approval_requests → executor` 상태 머신으로 구현한다.
- **이유**: Vercel 요청 시간 제한과 GitHub Actions 재시도 환경에서 중단 후 재개, 멱등성, 승인과 감사를 검증할 수 있다.
- **버린 대안**: 한 HTTP 요청에서 리서치·판단·실행을 모두 끝내는 autonomous agent.

## 2026-09-05 — 모바일은 기존 PWA를 유지

- **결정**: Phase 5에서는 `/today`, `/inbox`, `/approvals`를 기존 Next.js PWA에 추가한다.
- **이유**: Web Push와 오프라인 폴백이 이미 G4에서 검증됐고, JARVIS 핵심은 네이티브 UI보다 중앙 상태와 실행 루프다.
- **버린 대안**: Phase 5 시작과 동시에 React Native와 Mac 앱을 별도로 만드는 것.
```

### `docs/DEFERRED.md`

```markdown
- **Phase 5A cron 활성화** — 0015 migration, RLS, 수동 E2E가 통과한 뒤 `process-system-events`, `process-approved-actions`, `generate-command-brief` schedule을 추가한다.
- **JARVIS CalDAV executor** — Phase 5A는 CREATE_TASK만 실행한다. 일정 생성은 멱등성 키를 CalDAV UID에 연결하는 검증이 끝난 뒤 추가한다.
- **AI triage / command brief** — 초기 경로는 deterministic classifier와 priority function. 실제 사용 로그에서 규칙의 한계가 확인된 뒤 AI를 보조로 붙인다.
- **Phase 5B Career Secretary** — G5A 운영 게이트 통과 후 opportunity, requirement evidence, eligibility validator, company watchlist를 구현한다.
```
