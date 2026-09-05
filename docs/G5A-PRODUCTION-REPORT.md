# G5A 운영 반영 보고서

검증일: 2026-09-06 JST.
**G5A 기능·운영 인수 통과. 운영 DB·배포·기기 간 E2E·푸시 확인 및 정기 cron 활성화 완료. 첫 schedule-triggered 실행은 아직 미관측이다.**

운영 주소: [Personal OS](https://personal-os-nine-rust.vercel.app).
기계 판독 증거: [production-rollout.json](g5a-evidence/production-rollout.json).

## 운영 DB

- 기존 프로젝트 `leitsqwmtxqsgnsvzdfc`에 연결해 dry-run으로 0014~0017 네 파일만 확인했다. seed/role 변경은 없었다.
- 적용 전 schema 44,170 bytes, public data 6,006,525 bytes를 전용 비공개 로컬 폴더 `test-results/production-backup/`에 저장했다. 디렉터리 0700, SQL 파일 0600. 백업 원문은 Git에 포함하지 않았다.
- 두 dump 명령 모두 성공했다. schema의 테이블 정의 33개와 data의 COPY 블록/종료 33쌍을 확인하고 SHA-256을 기록했다. 실제 복원 연습을 실행한 것은 아니다.
- 초기 검사 스크립트가 일반 pg_dump footer를 찾지 못했지만, Supabase export가 주석을 제거하는 형식이었다. dump 성공 결과와 실제 구조를 따로 확인했다.
- `supabase db push --linked --yes`가 실제 0014, 0015, 0016, 0017을 적용하고 성공했다. 운영 reset이나 기존 migration 수정은 하지 않았다.
- 적용 후 SQL 재조회: version 0017까지 존재, 신규 관련 7개 테이블 RLS 활성화, worker RPC는 anon/authenticated 실행 불가, task 승인 unique index는 전체 인덱스다.
- 실제 생성된 운영 데이터를 대상으로 anon 조회 결과는 모두 0행/권한 거부였다.

## 병합 및 배포

- [PR #22](https://github.com/Kachii1020/PersonalOS/pull/22)를 최신 검사 성공 후 병합했다.
- main 병합 커밋: `1eb2218212dcf405705d5627d29be05b6eabe4fd`.
- Vercel production deployment: `dpl_G1teYcAFDP6dEb9ysTcVuroEnqHL`, Ready.
- 운영 도메인이 `personal-qtcr0jt27-circle-connect123.vercel.app` 배포를 가리키는 것을 Vercel CLI와 실제 브라우저로 확인했다.
- 전체 Vercel 환경을 로컬 파일로 export하는 요청은 자동 승인 검토에서 거부됐다. 대신 환경변수 이름만 확인하고, 서버 내부의 기존 VAPID/cron 설정과 GitHub Actions secrets로 검증했다. 운영 비밀값 전체 export는 수행하지 않았다.

## 실제 운영 Mac E2E

실제 Mac의 별도 headed Chrome에서 운영 허용 계정으로 다음을 실행했다.

1. Inbox에 `할 일: G5A 운영 검증 20260906` 입력.
2. 승인함에서 해당 요청만 승인.
3. /tasks에 정확히 1건 생성, /today에 반영 확인.
4. 운영 DB에서 task 1건과 requested → approved → executing → executed → verified 순서 확인.
5. 운영 jobs 재실행 후에도 task 1건 유지.

승인 ID: `274c1d5d-d348-4ce4-987d-87df5fe7ef3c`.
태스크 ID: `49a2f7b2-c9f7-4f42-8d8e-9c4c3039b86a`.
페이지 오류와 가로 넘침은 없었다.

검증 후 이 태스크만 done으로 표시했으며 approval/audit는 증거로 보존했다. 다른 사용자 태스크는 수정하지 않았다.

## 실제 Mac 푸시

- 운영 VAPID 설정과 서비스 워커 등록을 확인했다.
- 최초 비공개 Chrome 컨텍스트에서는 브라우저가 Push API를 지원하지 않아 등록이 거부됐다. 이 실패를 통과로 처리하지 않았다.
- 사용자 기존 프로필과 분리된 지속형 headed Chrome 프로필에서 실제 Push 구독 저장에 성공했다.
- 운영 설정의 테스트 알림 버튼으로 발송했다. 서버 결과는 “알림 1건을 보냈습니다.”
- Mac 서비스 워커에서 실제 알림 수 0 → 1을 확인했다. 제목 `테스트 알림`, 본문 `Personal OS 푸시가 이 기기에 도달했습니다.`, 이동 경로 `/settings`.
- 검증 전용 구독은 endpoint 해시로 정확히 식별해 서버에서 제거했다. 로그인 쿠키와 임시 auth-state 파일을 제거하고 브라우저를 닫았다. 기존 사용자 구독은 삭제하지 않았다.

추가 Mac 오프라인 에뮬레이션은 cached HTTP 200 응답을 관측했으나 예상 배너 표시를 확인하지 못했다. 따라서 이 실행을 오프라인 실기기 게이트 통과로 기록하지 않는다. 실제 iPhone 비행기 모드 검증도 미실행이다.

## JARVIS 작업과 cron

구현 파일은 기존 cron.yml과 별도인 `.github/workflows/jarvis.yml`이다.

- 예약 식: `*/5 * * * *`.
- 정기 실행 조건: repository variable `JARVIS_CRON_ENABLED=true`.
- 같은 worker 실행은 concurrency group으로 직렬화한다.
- 수동 dispatch는 활성화 변수와 무관하게 검증할 수 있다.
- HTTPS/secret을 검사하고 non-200을 실패 처리한다. 사적인 task/approval payload를 Actions 로그에 출력하지 않는다.

실제 수동 실행:

- [33975444921](https://github.com/Kachii1020/PersonalOS/actions/runs/33975444921): 세 job 모두 HTTP 200 / success.
- [33975565219](https://github.com/Kachii1020/PersonalOS/actions/runs/33975565219): 재실행 세 job 모두 HTTP 200 / success.
- [33975981882](https://github.com/Kachii1020/PersonalOS/actions/runs/33975981882): 검증 태스크 완료 후 brief 갱신 success.

**2026-09-06 01:10 JST에 `JARVIS_CRON_ENABLED=true`를 설정하고 GitHub API로 값을 재확인했다.**
활성화 후 [33977008868](https://github.com/Kachii1020/PersonalOS/actions/runs/33977008868)을 수동 dispatch해 세 job의 HTTP 200과 workflow success를 확인했다. 재실행 뒤 iPhone 검증 task는 1행, audit는 기존 5행 그대로였다.

첫 schedule-triggered 실행은 아직 관측하지 않았다. 정기 설정 활성화, 수동 실행 검증, 실제 schedule 이벤트 실행은 서로 다른 증거이며 수동 실행을 예약 실행으로 기록하지 않는다.

## iPhone 확인과 최종 인수

초기에는 연결된 iPhone 0대, 사용자 응답 대기, 검증 입력/구독 0건이었다. 이후 사용자가 iPhone 알림 수신에 문제가 없다고 확인했고, 실제 입력 완료도 보고했다. 입력 안내 후 서버에서 일치하는 항목을 확인했다.

- iPhone 입력/알림 수신: **사용자 확인**. 운영 push subscription 1건 확인.
- Inbox: `9354334a-0aed-4ede-8a8c-1e4fc98beb58`, act_now, 생성 2026-09-06 01:07:29 JST.
- Approval: `b82c01de-f4a4-4396-9f94-9ab4ea8cf815`. **실제 Mac headed Chrome에서 승인 버튼 실행**.
- Task: `ab7601b0-2213-4ed7-84b2-f66b4f06ee9e`, 정확히 한 건. /tasks와 /today 표시 관측.
- Run completed / verified 및 requested → approved → executing → executed → verified audit 5건을 운영 DB에서 확인.
- 활성화 후 worker 재실행에서도 task 1건과 audit 5건을 유지했다. 사용자가 만든 검증 태스크와 실제 푸시 구독은 삭제하지 않았다.

최종 증거: [final-acceptance.json](g5a-evidence/final-acceptance.json).
독립 검증자가 G5A 명세의 인수 조건 1~14와 증거 범위를 검토했다. 첫 schedule 실행 관측은 이 조건에 포함되지 않아 별도 운영 후속 관찰로 남긴다. 실제 iPhone 화면을 에이전트가 직접 원격 조작/촬영했다고 주장하지 않는다.

Phase 5B는 시작하지 않았다.
