# Learn 다음 작업 — 자동완성 · 커리큘럼 · 볼륨

게이트 밖 `/learn` 확장. SPEC은 고치지 않는다. 커리큘럼은 코드에 둔다. 함수명은 영어.

---

## 1. 함수 자동완성 (구현됨 — PR #14)

수식바에 `=`를 치면 Excel처럼 함수 목록이 뜨고, Tab/Enter로 `SUM(`을 넣는다. 목록은 HyperFormula이 계산하는 커리큘럼 함수만 (약 47개). `AVERAGEIFS`는 엔진에 없어서 넣지 않는다. Excel 400개는 넣지 않는다.

1. `lib/spreadsheet/functions.ts`에 이름·문법·한 줄 힌트 목록 → verify: 모든 이름이 `HyperFormula.getRegisteredFunctionNames('enGB')`에 있음
2. `=su` → SUM, SUMIF, SUMIFS, SUMPRODUCT. `=SUM(`이면 목록 숨기고 `SUM(number1, [number2], …)` 표시 → verify: 단위 테스트
3. 수식바 아래 목록. 위/아래, Tab, Enter(완성만, 셀 커밋 아님), Esc. 클릭 완성 → verify: 브라우저에서 `=su` → Tab → `=SUM(`

하지 않음: 최근 사용, 인수 마법사, 한글 별칭, 목록에 없는 함수.

---

## 2. 커리큘럼 데이터 모델 (다음)

`LearnDashboard.tsx`의 페이즈·불릿·퀴즈를 `lib/learn/curriculum.ts`로 뺀다. 개념마다 `id`, `kind` (`grid` | `excel-only`), 이론 카드(왜/문법/함정/IB 장면), `labIds`, `quizIds`.

1. 기존 10모듈을 필드에 옮기고 UI는 같은 화면 → verify: 모듈·퀴즈 수 불변, typecheck
2. `nav` 단축키, 피벗 UI, PQ, 순환참조는 `excel-only`. 실습 탭에 억지로 넣지 않음 → verify: 그 개념의 labIds 길이 0
3. 이론 불릿을 카드로 교체 (모듈당 기존 개념 수만큼) → verify: `grid` 개념은 lab≥1, quiz≥1

하지 않음: DB/Notion에 커리큘럼 이전, AI로 이론 생성, 모듈 추가(그건 3).

---

## 3. 실습·퀴즈 볼륨 (그 다음)

목표: 실습 ~80, 퀴즈 ~50. 200개 만들지 않음. 2의 ID에만 붙인다.

우선 구멍: `AND`/`OR`/`IFS`/`SUMIFS`/`AVERAGEIF`/`IFNA`, `XLOOKUP`, `MIN`/`MAX`/`SMALL`/`COUNTBLANK`/`SUMPRODUCT`, `XNPV`/`XIRR`/`IPMT`/`NPER`. 피벗·PQ 실습은 늘리지 않음.

1. 위 함수마다 실습 1–3 + 퀴즈 1 → verify: 정답 수식 테스트 전부 통과
2. 자동완성 목록의 함수는 엔진이 계산함 → verify: 1의 이름 집합 ⊇ 새 실습이 요구하는 함수
3. `excel-only`는 xlsx 링크 + 퀴즈만 → verify: 피벗/PQ lab 증가 0

하지 않음: 멀티시트 3-Statement, 순환참조, 피벗 UI 클론.
