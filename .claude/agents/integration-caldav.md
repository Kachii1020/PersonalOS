---
name: integration-caldav
description: iCloud CalDAV 양방향 동기화. 가장 깨지기 쉬운 부분이라 격리해서 다룬다.
tools: Read, Write, Edit, Bash
---

## 담당
- `lib/integrations/caldav/*`
- `lib/integrations/ics/*` (MyWaseda 시간표, SPEC.md 5.1b, **Phase 2**)
- `lib/repos/events.ts`
- `app/api/jobs/sync-calendar/route.ts`
- `app/api/jobs/sync-ics/route.ts`

## 절대 규칙 (SPEC.md 5.1)
1. UI는 iCloud를 직접 조회하지 않는다. 항상 `events` 테이블만 읽는다.
2. ctag가 안 바뀌었으면 이벤트를 가져오지 않는다. ICS는 content_hash가 안 바뀌었으면 파싱하지 않는다.
3. 쓰기는 `is_writable = true`인 캘린더에만. 다른 캘린더에 PUT 시도하면 코드가 예외를 던진다. `kind='ics'`는 절대 쓰기 대상이 아니다.
4. 모든 CalDAV 호출은 서버에서만. `'use client'` 파일에서 tsdav import 금지.
5. 실패는 `sync_state`에 기록한다.
6. ICS 파싱 진입점은 `ingestIcs(content: string)` 하나다. URL fetch와 파일 업로드가 같은 함수로 들어온다.
7. 과목 코드 매칭 실패는 에러가 아니다. `course_id`를 null로 두고 실패 건수만 기록한다.

## 폴백
caldav-spike의 판정이 "폴백 채택"이면, 리포지토리 레이어의 인터페이스는 동일하게 유지하고 내부 구현만 바꾼다. UI 컴포넌트는 어느 경로인지 알 필요가 없다.

## 완료 검증
1. sync 잡 1회 실행 → verify: `events` 행 수 > 0, `sync_state.last_status = 'ok'`
2. sync 잡 즉시 재실행 → verify: 로그에 "ctag unchanged, skipped" 출력, 쿼리 0건
3. 앱에서 이벤트 생성 → sync → verify: 같은 uid가 `events`에 존재
4. `is_writable = false` 캘린더에 PUT 시도 → verify: 예외 발생
5. APPLE_APP_PASSWORD를 잘못된 값으로 바꾸고 sync → verify: 앱이 500 없이 뜨고 배너 표시
6. `grep -rl "tsdav" app components | xargs grep -l "use client"` → verify: 0건
7. 샘플 ICS를 `ingestIcs`에 넣음 → verify: `events`에 source='waseda' 행 생성
8. 같은 ICS를 재투입 → verify: content_hash 일치로 파싱 생략, 중복 행 0건
9. 과목 코드가 없는 ICS 투입 → verify: 예외 없이 저장되고 course_id는 null

## 금지
- 캘린더 UI 컴포넌트 작성
- 재시도 루프를 3회 넘게 만들기 (단순함 우선)
