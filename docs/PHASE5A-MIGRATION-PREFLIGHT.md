# Phase 5A migration 적용 전 점검

점검일: 2026-09-06 JST. 운영 DB는 조회만 수행했다.

## 실제 운영 이력

`supabase migration list --linked --workdir /Users/ichika/personalOS`를 실제 실행했다.
대상 프로젝트는 기존에 연결된 `leitsqwmtxqsgnsvzdfc`다.

적용된 version: 0001, 0002, 0003, 0004, 0005, 0006, 0007, 0009, 0010, 0011, 0012, 0013.
0014~0017은 운영 DB에 미적용이다. 이 점검에서 `db push`, `migration repair`, 운영 reset은 수행하지 않았다.

## 0014의 정체

- PR #18 `cursor/learn-excel-spec-292d`와 PR #20 `cursor/learn-excel-slice2-292d`는 같은 `0014_workbook_submissions.sql`을 포함한다.
- 두 원격 브랜치와 로컬 테스트 복사본의 git blob은 모두 `e5fd3e3277bca4fb5ac49103085a84f8fa900608`이다.
- 내용은 `workbook_submissions` 테이블, 해당 RLS, 비공개 `learn-workbooks` 버킷과 접근 정책이다.
- 따라서 서로 다른 0014가 충돌하는 문제가 아니라, 아직 main에 들어오지 않은 공통 선행 migration이다.
- 이번 작업에서 기존 Learn PR, Learn/Quiz 기능 코드, 운영 스키마는 수정하지 않았다.

## 적용 전 로컬 검증

기존 G5A 전용 스택(API 54621 / DB 54622)에서 다음을 실제 실행했다.

1. 내장 native Supabase CLI 2.111.0으로 Phase 5A-only schema reset: 종료 코드 0.
2. gitignored 테스트 migration 복사본에 원본 0014를 포함하고 0014 → 0015 → 0016 → 0017 순서로 reset: 종료 코드 0.
3. DB에서 0014~0017 이력을 재조회하고 관련 테이블 7개의 RLS와 learn-workbooks 버킷의 비공개 상태를 확인했다.
4. 초기 인증 시간 초과 후 healthy 상태에서 실제 G5A DB 게이트를 재실행해 10/10 통과했다. 구조 10/10, 단위 135/135, typecheck/lint도 통과했다.

`test-results/g5a-stack`에서만 수행했으며, 원래 PersonalOS 로컬 스택(54421/54422)과 운영 DB는 reset하지 않았다.
CLI의 `on branch main` 출력은 Supabase의 로컬 DB branch 표기이며 Git 브랜치 변경이 아니다.

검증한 macOS 내장 실행기:

```bash
./node_modules/@supabase/cli-darwin-arm64/bin/supabase-go db reset \
  --local --workdir test-results/g5a-stack
```

일반 wrapper에서 실패했던 reset을 이 실행기로 완료했다. 재현용 G5A fixture에는 미사용 Realtime을 명시적으로 비활성화했다. 원래 production config는 변경하지 않았다.

## 승인된 반영안 — 운영 DB 적용은 아직 미실행

2026-09-06 사용자가 공통 0014 파일 포함 및 G2/G4 검증 코드·Playwright 개발 의존성 수정을 명시적으로 승인했다. Learn/Quiz 기능 코드는 계속 변경하지 않는다.

1. 기존 두 Learn PR을 그대로 두고, **위 blob과 일치하는 0014 파일 하나만** Phase 5A PR #22의 선행 migration으로 포함했다. Learn 기능 코드나 workbook 과제는 포함하지 않았다.
2. 해당 파일이 main의 정식 migration 이력에 포함되도록 PR을 검토한다. 운영에만 0014를 올리고 repository 이력에서 빼놓지 않는다.
3. 최신 운영 migration 이력과 pending 목록을 다시 확인하고 0014, 0015, 0016, 0017만 대상으로 dry-run한다.
4. 적용 전에 복구 가능한 schema/data 백업을 확인하고, 확인된 네 migration을 정해진 순서로 적용한다.
5. 운영 RLS/권한 및 Inbox → Approval → Task → Today 확인을 수행한다. 실기기 확인 전 cron은 켜지 않는다.

승인된 G2는 실제 학습→퀴즈 전환 후 첫 문항의 복습 표시를 검사한다. G4는 응답을 한 번만 읽으며 cached 반환과 새 생성의 예산 차단을 구분해 원래 402 조건을 보존한다. 테스트는 명시적으로 격리된 loopback DB에서만 fixture를 변경한다.
