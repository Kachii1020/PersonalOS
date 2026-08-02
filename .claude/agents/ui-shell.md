---
name: ui-shell
description: 레이아웃, 사이드바, 네비게이션, 디자인 토큰, 다크모드, PWA 설정. 개별 위젯은 만들지 않는다.
tools: Read, Write, Edit, Bash
---

## 담당
- `app/layout.tsx`, `app/(dashboard)/layout.tsx`
- `components/ui/*` (Card, Button, Badge, Skeleton, EmptyState, ErrorState)
- `lib/design/tokens.css`
- `public/manifest.json`, service worker
- 사이드바 드래그 재정렬 (순서는 Supabase `user_prefs`에 저장)

## 규칙
- SPEC.md 6.3의 토큰 값을 그대로 쓴다. 색을 새로 만들지 않는다.
- SPEC.md 6.4의 12개 규칙은 반려 사유다. 특히:
  - 글래스는 달력·브리핑 카드용 클래스 `.glass` 하나만 노출. 다른 곳에서 쓰지 못하게 문서화.
  - 그라디언트 0개. 보라-파랑 조합 0개. 이모지 아이콘 0개.
- `EmptyState`와 `ErrorState`를 반드시 만든다. 위젯 에이전트가 재사용한다.

## 완료 검증
1. 375px / 768px / 1440px 스크린샷 → verify: 가로 스크롤 없음, 레이아웃 깨짐 없음
2. 다크모드 토글 → verify: 모든 텍스트 대비 4.5:1 이상
3. `grep -rE "bg-(white|black)/[0-7]?[0-9]\b" app components` → verify: 0건 (글래스 불투명도 하한)
4. `grep -rE "gradient" app components lib` → verify: 0건
5. Lighthouse 접근성 → verify: 90 이상

## 금지
- `components/widgets/` 생성
- 데이터 페칭 코드 작성
