# Personal OS — Phase 5 JARVIS Spec

**상태**: Phase 5A implementation draft
**작성일**: 2026-09-05
**대상 사용자**: 단일 사용자 Jun
**기반**: Phase 4 종료, Next.js 15 + Supabase + PWA + GitHub Actions cron

## 0. 한 줄 정의

Phase 5는 Personal OS를 정보를 보여주는 대시보드에서, 사용자의 현재 상태를 해석하고 다음 행동을 준비하며 승인된 작업을 안전하게 실행하는 개인 비서로 확장한다.

```text
관찰 → 상태 갱신 → 우선순위 판단 → 준비 → 승인 → 실행 → 검증 → 기억
```

Phase 5에서는 음성, 네이티브 모바일 앱, Mac 로컬 파일 제어, 이메일 전송을 만들지 않는다. 기존 PWA와 서버 구조 안에서 비서의 핵심 실행 루프를 먼저 검증한다.

## 1. 범위

### 5A — JARVIS Core

- `inbox_items`: 폰·컴퓨터 공통 입력함
- `system_events`: 내부 이벤트 큐
- `agent_runs`: 중단 후 재개 가능한 실행 상태
- `approval_requests`: 승인 게이트와 멱등성
- `action_audit_logs`: 외부 행동 감사 기록
- `command_briefs`: 하루 핵심 행동 최대 3개
- 기존 `tasks`의 우선순위·출처·예상 시간 확장
- `/today`, `/inbox`, `/approvals`
- 승인된 `CREATE_TASK`의 end-to-end 실행

### 5B — Career Secretary

5A 게이트 통과 후 별도 PR에서 시작한다.

- 지원 기회 추적
- 학년·졸업연도·지역·비자·기술 자격 검증
- 회사 watchlist와 공식 페이지 변경 감시
- application case와 next action
- 지원 준비 태스크와 승인 요청

### 비범위

- 자유형 multi-agent 네트워크
- 모든 대화 원문의 장기 기억화
- 이메일·LinkedIn·지원서 자동 전송
- 결제, 금융 거래, 계정 보안 변경
- Mac 파일·브라우저·클립보드 직접 접근
- wake word, 상시 마이크, 네이티브 앱

## 2. 불변 원칙

1. 폰과 컴퓨터는 하나의 Supabase 상태를 본다.
2. 넓게 조사하되 화면에는 지금 중요한 항목만 노출한다.
3. 코드는 사실을 수집하고 AI는 구조화된 제안만 만든다.
4. 승인과 실행은 별도 단계다.
5. cron 재시도와 중복 클릭은 외부 행동을 중복 생성하지 않는다.
6. 긴 작업은 한 HTTP 요청에 끝내지 않고 저장된 step에서 재개한다.
7. 변할 수 있는 사실에는 출처, 관찰일, 재검증일을 붙인다.
8. 실패는 `agent_runs`, `job_runs`, `action_audit_logs`에 남긴다.
9. 외부 SDK는 `lib/integrations`, DB 접근은 `lib/repos`를 통한다.
10. 멀티테넌시는 만들지 않는다.

## 3. 구조

```text
PWA Capture / Calendar / Tasks / Cron
                 │
                 ▼
            inbox_items
                 │ trigger
                 ▼
            system_events
                 │
                 ▼
      process-system-events
                 │
                 ▼
             agent_runs
        ┌────────┼────────┐
        ▼        ▼        ▼
    classify   prepare   policy
        └────────┼────────┘
                 ▼
      approval_requests
                 │ user decision
                 ▼
   process-approved-actions
                 │
                 ▼
 execute → verify → audit → brief
```

`events`는 캘린더 데이터다. 내부 이벤트 큐로 재사용하지 않는다.

## 4. 데이터 모델

열린 Learn PR들이 `0014`를 사용 중이므로 JARVIS migration은 `0015_jarvis_core.sql`을 사용한다. `0015`를 hosted DB에 적용하기 전에 `0014`의 merge 또는 폐기 여부를 확정한다.

### `inbox_items`

- `kind`: `text | url | note | file | image | command`
- `status`: `unprocessed | act_now | learn | monitor | archive | failed`
- raw text, URL, attachment path, summary, classification reason

### `system_events`

- event type, source, JSON payload
- unique `dedupe_key`
- processing lease와 retry count
- `pending | processing | processed | failed`

### `agent_runs`

- trigger event
- `queued | collecting | verifying | planning | waiting_approval | executing | completed | failed`
- current step, state, output, lease, attempts

### `approval_requests`

- action type, explanation, immutable payload
- unique `idempotency_key`
- `pending | approved | rejected | expired | executing | executed | failed`
- risk, decision, execution result

### `action_audit_logs`

append-only 로그다.

- `requested | approved | rejected | executing | executed | verified | failed`
- actor, payload, timestamp

### `command_briefs`

하루 한 행이다.

- headline
- top actions 최대 3개
- prepared items
- postponed items
- warnings
- source snapshot

### 기존 `tasks` 확장

- `priority` 0..100
- `estimated_minutes`
- `defer_until`
- `source_type`, `source_id`
- `generated_by`
- `priority_reason`
- `last_reviewed_at`
- `approval_request_id unique`

## 5. 실행 상태

### Capture run

```text
queued/classify
→ planning/prepare_approval
→ waiting_approval 또는 completed
```

`할 일: ...`, `todo: ...`, `task: ...` 입력은 `CREATE_TASK` approval을 준비한다. URL은 우선 `MONITOR`, 학습 입력은 `LEARN`으로 분류한다.

### Approval run

```text
pending
→ approved 또는 rejected
→ executing
→ executed/verified 또는 failed
```

승인 payload가 바뀌면 기존 승인을 재사용하지 않고 새 요청을 만든다.

## 6. Policy Engine

### 자동 허용

- 내부 분류·요약
- Supabase 내부 상태 갱신
- 초안과 command brief 생성
- 읽기 전용 조사

### 승인 필요

- task 활성 목록 추가
- CalDAV 일정 생성·수정
- 메시지 전송
- GitHub push
- 행사 등록·지원서 제출

### 항상 금지

- 결제와 금융 거래
- 비밀번호·MFA 변경
- 승인 없는 외부 전송
- 파일 영구 삭제
- 법적 동의

알 수 없는 action은 기본적으로 `deny`다.

## 7. UI

### `/today`

- 오늘 command brief
- 핵심 행동 최대 3개
- 승인 대기
- 준비된 항목
- 미룬 항목과 경고

기존 `/`는 G5A 통과 전까지 유지한다.

### `/inbox`

- text / URL / command 입력
- 상태별 목록
- 분류 이유와 처리 시각

### `/approvals`

- pending 우선
- action, risk, explanation, payload 요약
- 승인 / 거절
- 실행 및 실패 결과

## 8. Jobs

- `POST /api/jobs/process-system-events`
  - runnable run의 다음 step 진행
  - 없으면 event 한 건 claim 후 run 생성
- `POST /api/jobs/process-approved-actions`
  - approved action 한 건 claim
  - policy 재검사
  - execute, verify, audit
- `POST /api/jobs/generate-command-brief`
  - task와 pending approval을 deterministic하게 집계
  - Phase 5A 첫 PR에서는 AI를 사용하지 않음

한 호출은 작은 step만 수행하며, 동일 요청을 반복해도 중복 부작용이 없어야 한다.

## 9. Command Brief 규칙

- top actions 최대 3개
- 완료·보류 중인 task 제외
- overdue와 가까운 deadline을 가산
- 90분을 넘는 task는 작은 감점
- pending approval은 prepared item으로 표시
- 다음 7일 task가 과도하면 warning
- AI 실패에 의존하지 않는 deterministic fallback이 항상 존재

## 10. 보안

- 모든 새 테이블 RLS 활성화
- 기존 `public.is_allowed_user()` 재사용
- service role은 job route에서만 사용
- approval payload에 secret 저장 금지
- 외부 행동 직전 status, expiry, policy를 재검사
- `action_audit_logs`는 사용자에게 select만 허용
- user는 approval payload를 직접 update하지 않고 `decide_approval` RPC만 사용

## 11. G5A 통과 조건

1. `/inbox` 입력이 DB에 저장되고 다른 기기에서도 보인다.
2. inbox insert가 같은 dedupe key의 event를 정확히 한 건 만든다.
3. 두 worker가 같은 event 또는 run을 동시에 claim하지 못한다.
4. run은 저장된 `current_step`에서 재개된다.
5. 내부 요약은 allow, task/calendar 생성은 approval, 결제는 deny다.
6. 승인 전에는 task insert가 발생하지 않는다.
7. 같은 approval을 재실행해도 task는 한 건뿐이다.
8. reject는 부작용 없이 audit를 남긴다.
9. `/approvals`는 pending/executed/failed를 구분한다.
10. `/today`는 action을 최대 3개만 표시한다.
11. deterministic brief가 AI 없이 생성된다.
12. anon은 새 테이블에 접근할 수 없다.
13. requested → decision → execution 결과가 audit에 남는다.
14. typecheck, lint, unit, G5A structural tests가 통과한다.

## 12. Phase 5B — Career Secretary 상세 설계

### 12.1 `career_profile`

지원 가능성을 판단할 때 사용하는 명시적 사실만 저장한다.

- degree level, major, university
- expected graduation date
- current academic year
- current residence
- work authorization by country
- languages and working proficiency
- weekly availability and internship window
- last verified date and source

대화에서 추정한 값은 바로 확정 사실로 쓰지 않는다. 변경 가능성이 있는 값에는 `verified_at`과 `review_at`을 둔다.

### 12.2 `opportunities`

- organization, title, type, canonical URL
- lifecycle: `open | upcoming | closed | unknown`
- eligibility: `confirmed_eligible | possibly_eligible | not_eligible | next_cycle`
- deadline, location, work mode, expected effort
- fit / urgency / value / effort score
- status: `act_now | learn | monitor | archive`
- first seen, last verified, next check
- recommendation and reason

### 12.3 `opportunity_requirements`

공고의 자격조건을 한 행씩 분리한다.

```text
graduation window
academic year
degree / major
location
work authorization
language
technical skill
weekly availability
other hard requirement
```

각 requirement는 다음을 가진다.

- normalized type and operator
- raw official text
- result: `pass | fail | unknown | not_applicable`
- evidence URL, quote, retrieval time
- verifier confidence

`confirmed_eligible`은 모든 hard requirement가 `pass` 또는 `not_applicable`일 때만 가능하다. 하나라도 `fail`이면 `not_eligible`, `unknown`이 하나라도 있으면 최대 `possibly_eligible`이다.

### 12.4 `opportunity_sources`

- canonical URL
- source class: official posting / official program / official FAQ
- fetched at, HTTP metadata, content hash
- extracted text snapshot or storage reference
- supersedes source ID

제3자 목록은 발견에만 사용할 수 있고 eligibility 확정 근거로는 사용하지 않는다.

### 12.5 `company_watchlist`

- organization
- tier 1 / 2 / 3
- why it matters
- monitored pages
- check frequency
- last meaningful change

Tier 1은 매주, Tier 2는 월 1회, Tier 3는 알려진 recruiting window 전후에만 확인한다.

### 12.6 `application_cases`

- opportunity ID
- stage
- next action and due date
- documents and version IDs
- interview dates
- last contact
- result
- user decision and rationale

실제 제출, 이메일 전송, 행사 등록, 일정 생성은 각각 별도 approval request를 사용한다.

### 12.7 Career Secretary workflow

```text
공식 URL 또는 monitor trigger
→ source snapshot
→ requirement extraction
→ requirement-by-requirement verification
→ career_profile comparison
→ eligibility status
→ fit / urgency / effort calculation
→ ACT_NOW / LEARN / MONITOR / ARCHIVE
→ brief 또는 approval preparation
```

AI는 requirement 후보와 요약을 제안할 수 있지만, lifecycle, deadline, hard requirement, eligibility 최종 상태는 deterministic validator가 확인한다.

### 12.8 우선순위

```text
priority =
  eligibility confidence
  + career fit
  + expected learning / signal value
  + deadline urgency
  - preparation effort
  - opportunity cost
```

점수는 순위를 돕는 수단이다. `not_eligible`, `closed`, `possibly_eligible`은 ACT_NOW 상위 3개에 들어갈 수 없다. 같은 결과물을 요구하는 기회가 겹치면 더 가치가 높은 하나만 노출한다.

### 12.9 페이지 변경 감시

1. URL을 canonicalize한다.
2. ETag / Last-Modified가 있으면 우선 사용한다.
3. 본문 normalization 후 content hash를 비교한다.
4. 변경이 있으면 `opportunity.source_changed` event를 만든다.
5. deadline, eligibility, location, status 영역만 우선 재검증한다.
6. 의미 없는 footer·tracking 변경은 무시한다.

### 12.10 G5B 통과 조건

1. 공식 공고에서 자격조건을 source와 함께 저장한다.
2. 한 조건이라도 불명확하면 `confirmed_eligible`이 될 수 없다.
3. closed 또는 not-eligible 공고는 ACT_NOW에 나타나지 않는다.
4. canonical URL + content hash가 같은 기회는 중복 생성되지 않는다.
5. 페이지의 의미 있는 변경은 재검증 event를 만든다.
6. ACT_NOW는 최대 3개다.
7. 지원 시작 시 application case와 next action을 만든다.
8. 일정, 전송, 등록, 제출은 각각 별도 approval이다.
9. 과거 reject/postpone 이유가 다음 추천에 반영된다.
10. 공식 source가 사라지면 eligibility를 stale로 낮춘다.
11. G1~G5A 회귀 테스트를 유지한다.

## 13. 구현 순서

1. 문서와 migration
2. policy, priority, classifier의 순수 함수
3. repository layer
4. Inbox와 Approvals UI
5. event/run worker
6. approved task executor
7. deterministic Today brief
8. G5A structural tests
9. hosted DB push와 실제 PWA 왕복 검증
10. G5A 보고서 후 5B 착수

## 14. 구현 결정

- 초기 판단은 AI가 아니라 deterministic classifier와 priority function으로 시작한다.
- approval executor는 Phase 5A에서 `CREATE_TASK`만 지원한다.
- 초기 번들은 schema overlay를 사용했다. 통합 단계에서 실제 로컬 PostgreSQL의 타입을 생성해 `lib/types/database.ts`에 합쳤으며, 기존 typed client를 재사용한다.
- 승인 요청이 만들어지면 기존 Web Push를 사용해 `/approvals`로 연결한다.
- hosted DB가 준비되기 전까지 cron은 추가하지 않는다.

## 15. 대표 E2E

```text
폰에서 “할 일: Finatext 지원동기 완성” 캡처
→ system event 한 건
→ run classify/prepare
→ CREATE_TASK approval
→ 폰에서 승인
→ task 정확히 한 건 생성
→ 실행 결과와 audit 저장
→ Mac의 /today에 반영
```
