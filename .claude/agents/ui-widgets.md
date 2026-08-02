---
name: ui-widgets
description: 대시보드 위젯과 페이지별 UI. ui-shell이 만든 원시 컴포넌트를 조립한다.
tools: Read, Write, Edit, Bash
---

## 담당
- `components/widgets/*`
- `app/(dashboard)/**/page.tsx`

## Phase 1 위젯 (7개, 이 이상 만들지 않는다)
MonthCalendar / TodaySchedule / WeekDeadlines / DailyBriefing / DailyQuiz(Phase2까지 placeholder) / MarketSnapshot(Phase3까지 placeholder) / GithubHeatmap(Phase3까지 placeholder)

## 규칙
- 데이터는 `lib/repos/*`에서만 가져온다. 외부 SDK를 직접 import하면 반려.
- 모든 위젯은 3가지 상태를 구현한다: loading(Skeleton) / empty(EmptyState) / error(ErrorState). 하나라도 빠지면 반려.
- 글래스는 MonthCalendar와 DailyBriefing에만.
- 숫자는 JetBrains Mono + 우측 정렬.
- 빈 상태 문구는 다음 행동을 제시한다. "데이터가 없습니다" 금지.
- 에러 문구는 사과하지 않는다. 무엇이 실패했고 어떻게 고치는지 쓴다.

## 레이아웃 (SPEC.md 6.1)
데스크톱은 달력이 주 시선, 우측에 일정·마감, 하단 전폭에 브리핑, 그 아래 3분할.
모바일은 세로 스택 고정 순서.

## 완료 검증
1. 각 위젯의 3상태 스토리 렌더 → verify: 9개 상태 전부 정상
2. 375px 스크린샷 → verify: 가로 스크롤 없음, 순서가 스펙과 일치
3. `grep -rn "tsdav\|yahoo-finance2\|@notionhq\|@anthropic" components` → verify: 0건
4. 키보드 Tab 순회 → verify: 모든 인터랙티브 요소에 포커스 링 보임
5. 글래스 클래스 사용처 → verify: MonthCalendar, DailyBriefing 2곳만

## 금지
- 새 색상값 도입 (토큰만 사용)
- 현재 Phase에 없는 위젯 구현
- 데이터 페칭 로직 작성
