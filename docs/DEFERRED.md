# 미룬 것들

- **AI 예산 80% 경고 배너** (SPEC 5.5) — `budgetStatus()`는 만들었지만 화면에 붙이지 않았다. ui-widgets 차례에 `SyncBanner` 옆에 붙인다.
- **퀴즈 생성 / 강의자료 요약** — SPEC 5.5의 나머지 AI 호출 2곳은 Phase 2다. `callStructured`를 그대로 재사용하면 예산 가드가 자동으로 적용된다.

- `app/(dashboard)/**/page.tsx` 5개는 ui-shell이 만든 자리표시자다. ui-widgets 차례에 실제 화면으로 교체한다.
- PWA 아이콘이 SVG 하나뿐이다. 홈 화면 설치 품질을 높이려면 192/512 PNG가 필요하다. 접근성 게이트에는 영향 없다.
- **호스티드 Supabase 반영** — 마이그레이션 2개를 로컬에만 적용했다. `supabase link` + `db push`에 액세스 토큰과 DB 비밀번호가 필요해서 사람이 직접 해야 한다. 그전까지는 `.env.development.local`이 로컬 스택을 가리킨다.
- **사이드바 재정렬의 실제 입력 검증** — 로직·저장·복원은 확인했지만, 실제 마우스 드래그와 Alt+화살표 키 입력은 브라우저 자동화가 이벤트를 포커스된 요소로 전달하지 못해 확인하지 못했다. 수동으로 한 번 확인할 것.
- **반복 일정(RRULE) 전개** — `events.rrule`에 원문만 저장하고 인스턴스를 펼치지 않는다. 달력 화면에서 표시 범위만 전개하는 게 미러를 작게 유지한다. ui-widgets가 MonthCalendar를 만들 때 필요하다.
- **iCloud 삭제 반영** — 동기화는 upsert만 한다. iCloud에서 지운 이벤트가 미러에 남는다. ctag가 바뀐 캘린더에 한해 조회된 uid 집합에 없는 행을 지우는 처리가 필요하다.
- **integration-caldav 완료 검증 7~9번(ICS)** — SPEC 5.1b는 Phase 2다. `lib/integrations/ics/*`, `sync-ics` 라우트, 과목 코드 매칭은 그때 만든다.
- **시세·환율·GitHub 수집** (integration-ingest 완료 검증 3~5) — SPEC 7절상 Phase 3이다. `yahoo-finance2`, frankfurter, FRED, ECOS, GitHub API와 `fetch-prices`/`fetch-github` 잡은 그때 만든다. `cron.yml`에도 그때 추가한다.
- **뉴스 보존 기간** — `news_items`가 무한히 쌓인다. 하루 270건이면 한 달에 8천 행. 오래된 행을 지우는 정리 잡이 필요하다.
