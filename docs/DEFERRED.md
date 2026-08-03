# 미룬 것들

- `scripts/spike-caldav.ts` 삭제 — caldav-spike 정의상 판정 후 지워야 하지만, integration-caldav가 같은 호출을 프로덕션 코드로 옮길 때까지 참조용으로 남긴다. Phase 1의 integration-caldav 완료 시점에 삭제한다.
- **사이드바 드래그 재정렬** (ui-shell 담당, SPEC.md 6.1) — 순서를 Supabase `user_prefs`에 저장하라고 되어 있는데 SPEC.md 4절 스키마에 `user_prefs` 테이블이 없다. 승인 후 마이그레이션을 추가해야 진행 가능. 접기/펴기만 먼저 구현했고 그 상태는 localStorage에 있다.
- **인증(로그인)** — SPEC.md 7절 Phase 1 범위에 "인증"이 있는데 AGENTS.md의 에이전트 9개 중 담당이 없다. `app/(dashboard)/layout.tsx`는 "인증된 영역"이지만 지금은 세션 검사가 없다. 담당 에이전트를 정하거나 ui-shell 범위에 넣어야 한다.
- `app/(dashboard)/**/page.tsx` 5개는 ui-shell이 만든 자리표시자다. ui-widgets 차례에 실제 화면으로 교체한다.
- PWA 아이콘이 SVG 하나뿐이다. 홈 화면 설치 품질을 높이려면 192/512 PNG가 필요하다. 접근성 게이트에는 영향 없다.
