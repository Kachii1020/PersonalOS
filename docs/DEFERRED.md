# 미룬 것들

- `scripts/spike-caldav.ts` 삭제 — caldav-spike 정의상 판정 후 지워야 하지만, integration-caldav가 같은 호출을 프로덕션 코드로 옮길 때까지 참조용으로 남긴다. Phase 1의 integration-caldav 완료 시점에 삭제한다.
- `app/(dashboard)/**/page.tsx` 5개는 ui-shell이 만든 자리표시자다. ui-widgets 차례에 실제 화면으로 교체한다.
- PWA 아이콘이 SVG 하나뿐이다. 홈 화면 설치 품질을 높이려면 192/512 PNG가 필요하다. 접근성 게이트에는 영향 없다.
- **호스티드 Supabase 반영** — 마이그레이션 2개를 로컬에만 적용했다. `supabase link` + `db push`에 액세스 토큰과 DB 비밀번호가 필요해서 사람이 직접 해야 한다. 그전까지는 `.env.development.local`이 로컬 스택을 가리킨다.
- **사이드바 재정렬의 실제 입력 검증** — 로직·저장·복원은 확인했지만(아래), 실제 마우스 드래그와 Alt+화살표 키 입력은 브라우저 자동화가 이벤트를 포커스된 요소로 전달하지 못해 확인하지 못했다. 수동으로 한 번 확인할 것.
