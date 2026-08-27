# 미룬 것들

- **SEC 펀더멘탈 차트** — sec_filings에 분기 실적이 쌓이면 매출·순이익 추이 차트를 /invest에 넣을 수 있다. 데이터 수집만 이번에 했고, 시각화는 별도 작업.
- **일본·한국 종목 재무제표** — TDnet(일본)·DART(한국) API로 7203.T, 6758.T, 005930.KS 등의 실적을 수집할 수 있지만 파서가 별도로 필요하다. 이번 범위에서 제외.
- **EDGAR P/E 연환산** — 현재 분기 EPS로 P/E를 계산하므로 단순 분기 P/E다. TTM(trailing twelve months) EPS로 바꾸려면 최근 4분기 합산 로직이 필요.
- **호스티드 0011** — `supabase/migrations/0011_sec_filings.sql`을 `db push`로 올려야 한다.

- **Notion 클라이언트 실호출 미검증** — `lib/integrations/notion/client.ts`와 `npm run notion:check`를 만들었지만 토큰이 없어 실제 워크스페이스에 붙여보지 못했다. 엔드포인트·헤더·응답 모양은 공식 문서(2026-03-11)로 확인했고, 토큰 없을 때의 실패 경로만 실행해봤다. **토큰이 들어오면 `notion:check`부터 돌려서 확인할 것.** 여기가 통과하기 전에는 notion-bridge의 나머지를 쌓지 않는다.

- ~~**프로덕션 빌드 실검증**~~ — 호스티드 스키마 + 로그인 + iPhone G4 1·4·5 (2026-08-19).

- ~~**AI 예산 80% 경고 배너**~~ (SPEC 5.5) — SPEC 완성 작업에서 구현. `components/shell/budget-banner.tsx`.
- ~~**퀴즈 생성 / 강의자료 요약**~~ — Phase 2에서 구현. G2 통과.
- ~~자리표시자 페이지~~ — ui-widgets가 Phase 1–3 화면으로 교체. G1·G2·G3 통과.
- ~~PWA 아이콘 SVG만~~ — `public/icon-192.png` / `icon-512.png` 있음.
- **호스티드 `0010`** — `0009`가 먼저 올라가서 `0008`은 쓰지 않는다. `0010_event_exdates`를 `db push`. revert/`db pull` 금지.
- **사이드바 재정렬의 실제 입력 검증** — 로직·저장·복원은 확인했지만, 실제 마우스 드래그와 Alt+화살표 키 입력은 브라우저 자동화가 이벤트를 포커스된 요소로 전달하지 못해 확인하지 못했다. 수동으로 한 번 확인할 것.
- ~~**반복 일정(RRULE) 전개**~~ — `listEventsBetween` / `listEventsWithWritableFlag` / `nextClass`가 표시 범위만 전개한다.
- **RECURRENCE-ID 예외 인스턴스** — 수정된 반복 회차는 파서가 무시하고 마스터만 남긴다. 예외 회차를 쓰려면 uid+recurrence-id 복합 키가 필요하다.
- ~~**iCloud 삭제 반영**~~ — ctag가 바뀌어 객체를 가져온 캘린더에서, fetch된 UID 집합에 없는 행을 지운다. UID를 못 읽은 객체가 있으면 삭제하지 않고 ctag도 전진시키지 않는다.
- **ICS 라이브 URL 경로 실검증** — `WASEDA_ICS_URL`을 fetch하는 분기는 코드에 있지만 실제 URL로 돌려보지 못했다. MyWaseda가 구독 URL을 주는지 확인되면 그 URL로 한 번 실행하고 `cron.yml`에 스케줄을 추가한다. 지금 정식 경로는 `/settings` 수동 업로드다.
- **과목 코드 정규식 튜닝** — 실물 MyWaseda ICS를 못 구해서 후보를 넓게 뽑고 `courses.code`와 교집합만 채택하는 방식으로 두었다. 실물을 넣어보고 `job_runs.meta.unmatchedSamples`에 걸리는 제목이 있으면 `extractCourseCodes`를 조인다.
- ~~**시세·환율·GitHub 수집**~~ — Phase 3에서 구현 완료. G3 통과.
- **강의자료 원본 열기·삭제** — 업로드한 파일을 화면에서 다시 열거나 지우는 경로가 없다. 서명 URL을 발급하는 리포지토리 함수와 삭제 버튼이 필요하다. G2 조건에는 없어서 넣지 않았다.
- **스캔 PDF(이미지)** — 텍스트 레이어가 없는 자료는 0자로 추출되고 업로드가 거부된다. OCR은 넣지 않았다. 거부 메시지가 이유를 말해준다.
- **PDF의 일본어 장음 부호** — LibreOffice로 만든 검증용 PDF에서 `ー`가 빠져 "コ ポレ ト"로 추출됐다. PPTX는 정상이었다. 픽스처 폰트 문제인지 unpdf 문제인지 실물 강의 PDF로 한 번 확인할 것.
- **학기 추가 UI** — `semesters`에 행을 넣는 화면이 없다. 지금은 DB에 직접 넣어야 과목을 만들 수 있다.
- ~~**뉴스 보존 기간**~~ — `fetch-news` 말미에 `fetched_at` 30일 초과 행을 지우고 `job_runs.meta.pruned`에 건수를 남긴다. `briefing_sections`는 URL 배열이라 FK 없음.
- ~~**G4 실기기**~~ — 2026-08-19 운영자가 조건 1·4·5 수동 통과로 보고. `docs/G4-REPORT.md`.
- ~~**VAPID 키**~~ — 운영자가 생성·Vercel 반영. 리포에 넣지 않는다.
- ~~**G4 조건 2·6**~~ — 2026-08-20 Actions `generate-briefing` / `generate-weekly-review` 성공.
- ~~**G4 조건 8**~~ — 2026-08-20 운영자 면제. 사유·잔여 리스크는 `docs/G4-REPORT.md`. 첫 실제 예산 소진 달에 `job_runs`의 402 기록으로 자연 검증.
