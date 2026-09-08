# Phase 7 — 승인된 구현 계약

사용자가 2026-09-08 이 계획의 구현을 명시적으로 요청했다. 이전 PHASE7-EXPERIENCE-PLAN.md는 탐색 초안이며, 충돌 시 본 문서와 최신 사용자 승인 내용이 우선한다.

목표: 업무 상태 저장·기기 간 재개 → 허용된 업무별 알림 → 같은 대화의 개별 승인 → 실제 결과 확인. 이력서 준비 시나리오가 첫 수직 흐름이다. 코드 기반은 기존 Next/React/TypeScript, Supabase, 중앙 Anthropic client, 기존 승인/CalDAV 영수증/Push를 유지한다.

## 불변 조건

- 최초 업무는 미리보기 후 사용자 저장. 이후 명시적인 사용자 진술과 검증된 실행 결과만 반영하며 원문 대화 전체/추론 선호는 저장하지 않는다.
- 업무 status는 active/paused/completed/cancelled. 사람이 업무 완료로 표시한 상태와 task/event 생성 완료를 구분한다. 완료/취소 맥락은 30일 후 정리하고 기존 도메인·감사 기록은 유지한다. 잊기는 조회/model projection/미래 알림에서 즉시 제외한다.
- 알림 조건은 기본 OFF: 명시 시각, 마감24시간 전, 명시적 진행 갱신 후48시간 중단. 조건 알림만22–08 JST 보류/owner전체하루3개, 명시 시각은 예외. 1시간/내일같은시각 미루기, 조건끄기 제공. 취소/변경 조건은 발송전 재검사하고 이미발송중인푸시회수를 주장하지 않는다.
- 최대3개의 독립적인 CREATE_TASK/CREATE_CALENDAR_EVENT/UPDATE_CALENDAR_EVENT 제안. 행동별로 별도 승인과 영수증을 유지한다. 하나의 승인으로 다른 행동을 실행하지 않는다. 일부만 성공하면 partial로 표시하며 자동보상삭제하지 않는다.
- owner/RLS, revision 충돌, requestId+payload hash 재시도, 만료/lease/ETag/중복 방지 유지. 업무 없는 Phase6 요청은 기존 경로 유지.
- 신규기능context/attention/inlineapproval 플래그 기본OFF. Supabase Cron+pg_net worker wakeup과 실제 worker ack 구분. 자동조건알림 승격은 실제7일관측99%/5분 기준 전에는 금지. 기존GitHub중복실행경로 전환은 검증뒤에만 한다.
- Learn/Quiz, 기존 migrations, 운영 데이터는 보존. 장기선호/vectorDB/새 agent framework/음성/그룹승인/새 외부행동은 제외.

## 추적 작업과 검증

- [x] G7A-1 순수 상태/인용검증 및 preview/명시갱신 구현, 순수 검사 통과 (실모델 수직 흐름은 별도)
- [x] G7A-2 owner DB/RPC, revision/request 재시도, 종료/잊기/보존 로컬 검사 통과
- [ ] G7A-3 30독립업무×2재개60회 ≥95%, 잘못선택/다른owner0
- [x] G7B-1 attention outbox/quiet hours/cap/미루기/해제/전달단계 로컬 DB 검사 통과 (실제 Push 별도)
- [x] G7B-2 실제 로컬 scheduler→worker→예정 알림 ready 관측 및 합성 장애 승격 차단 검사 (장기 정시성은 별도)
- [ ] G7B-3 실제7일 정시성 ≥99% (미관측을통과로표시하지않음)
- [x] G7C-1 대화내 개별승인/결과/partial 구현, 실모델 브라우저 task 승인 및 DB 합성 partial 검사
- [ ] G7C-2 30독립업무 ≥90%, duplicate/미승인/거짓완료0
- [ ] 기존 회귀/관련 DB·브라우저 실행 완료, 보고서/초안PR 마무리 (258 unit, 100/100 실모델 개발셋; 외부 게이트 제외는 보고서 참조)

배포와게이트 상태는 PHASE7-REPORT.md에 실제출력만 기록한다. 구현완료와7일운영인수완료는 별도 판정한다. 이미허용한반복운영질문/teach-back 생략은권한검증생략을뜻하지않는다.
