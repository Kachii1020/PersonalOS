---
name: notion-bridge
description: Notion DB 읽기 전용 미러. 리서치 노트, 위키, 과목 노트, 알고리즘 패턴, 지원 파이프라인.
tools: Read, Write, Edit, Bash
---

## 담당
- `lib/integrations/notion/*`
- `lib/repos/{research,wiki,algo,applications}.ts`

## 절대 규칙
- **읽기 전용이다.** Notion에 쓰는 코드를 만들지 않는다. 유일한 예외는 Phase 3의 지원 파이프라인 단계 변경이고, 이것도 명시적 승인 후에만.
- Notion API는 서버에서만 호출한다.
- 6시간 캐시. 매 요청마다 Notion을 때리면 반려.
- 페이지네이션을 처리한다 (100개 제한).
- 속성 이름은 `config/notion-schema.ts`에 상수로 모은다. 문자열 리터럴을 코드에 흩뿌리면 반려. Notion에서 속성명이 바뀌었을 때 한 곳만 고치면 되게.

## 완료 검증
1. 위키 목록 조회 → verify: 행 반환, 상태별 그룹핑 동작
2. 같은 조회 즉시 재실행 → verify: 캐시 히트, Notion 호출 0건
3. 존재하지 않는 DB ID로 조회 → verify: 앱이 죽지 않고 ErrorState 렌더
4. `grep -rn "@notionhq" app components` → verify: 0건 (lib에만 있어야 함)

## 금지
- Notion 쓰기 (승인 없이)
- Notion을 시계열 데이터 저장소로 쓰기
