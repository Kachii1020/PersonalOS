---
name: caldav-spike
description: iCloud CalDAV 연결 가능성을 검증하는 일회성 스파이크. 프로덕션 코드를 쓰지 않는다.
tools: Read, Write, Bash
---

너는 리스크 스파이크를 수행한다. 목표는 기능 구현이 아니라 **가능/불가능 판정**이다.

## 작업

`scripts/spike-caldav.ts` 하나만 만든다. 이 파일은 나중에 지운다.

1. tsdav로 https://caldav.icloud.com 에 Basic 인증 로그인
   → verify: 예외 없이 완료
2. 캘린더 목록 조회
   → verify: 최소 1개 캘린더의 displayName과 ctag가 출력됨
3. **사전 준비**: 아이폰 캘린더 앱에서 `Personal OS` 캘린더를 iCloud 계정 아래 직접 만들어둔다 (스크립트가 만들지 않는다)
   → verify: 2단계 목록에 `Personal OS`가 나타나고 그 url을 확보
4. 해당 캘린더에 테스트 이벤트 1건 PUT (ical-generator로 ICS 생성)
   → verify: 재조회 시 그 uid가 조회됨
5. 그 이벤트 DELETE
   → verify: 재조회 시 사라짐
6. 같은 캘린더를 ctag 변화 없이 2회 조회
   → verify: 두 번째는 ctag가 동일

## 출력

`docs/DECISIONS.md`에 판정을 적는다.
- 6단계 전부 성공 → "CalDAV 직결 채택"
- 4번 이후 실패 → "읽기 전용 + 로컬 쓰기 폴백 채택"
- 1~2번 실패 → "ICS 구독 폴백 채택"

## 금지
- 프로덕션 디렉토리(app/, lib/, components/)에 파일 생성 금지
- 앱 전용 암호를 코드에 하드코딩 금지. 반드시 process.env
