# Learn 핵심 실습 경로

게이트 밖 `/learn` 규칙. SPEC.md는 고치지 않는다. 커리큘럼·실습 ID는 코드에 둔다. 함수명은 영어.

이 문서가 실습 기본 경로의 소스다. 볼륨(72실습)은 유지하되, 기본으로 푸는 것은 아래 20개뿐이다.

---

## 목표

한 모듈을 끝내는 데 필요한 그리드 실습을 핵심 20개로 고정한다. 나머지 52개는 「더 풀기」다. Coddy식 마이크로 드릴을 기본 경로에 넣지 않는다.

- 새 랩을 만들지 않는다. 아래 ID만 핵심이다.
- 52개 extra의 ID는 그대로 둔다 (`lab_completions`가 깨지지 않게).
- 퀴즈 50개와 원래 24문항 순서는 그대로 둔다.
- 피벗 lab은 1개 유지. 핵심이 아니다.

---

## 핵심 20

순서가 경로다. 모듈 안 핵심 목록도 이 순서의 부분열이다.

| # | id | 한 줄 |
|---|---|---|
| 1 | `nav-cell-ref` | 값 말고 참조 |
| 2 | `basic-fn-sum` | 범위 집계 |
| 3 | `basic-fn-mixed-ref` | `$`가 채우기를 잠근다 |
| 4 | `logic-if` | 분기 |
| 5 | `logic-iferror` | 조회 실패가 모델을 안 죽인다 |
| 6 | `logic-sumifs` | 피벗 없이 조건부 합 |
| 7 | `lookup-index-match` | 왼쪽 조회 |
| 8 | `lookup-2d` | 연도×항목 |
| 9 | `lookup-xlookup` | 지금 쓰는 조회 |
| 10 | `clean-trim` | 외부 이름 정리 |
| 11 | `clean-extract` | 코드에서 키 뽑기 |
| 12 | `fin-npv` | 등간격 할인 |
| 13 | `fin-xnpv` | 불규칙 날짜 |
| 14 | `fin-pmt` | 대출 스케줄 |
| 15 | `model-assumptions` | 하드코딩 금지 |
| 16 | `model-balance-check` | BS = 0 |
| 17 | `stmt-net-income` | IS → 순이익 |
| 18 | `stmt-cf-addback` | DA는 현금이 아니다 |
| 19 | `dcf-fcf` | 할인할 현금 |
| 20 | `dcf-ev-equity` | EV에서 주주 몫 |

모듈별 핵심 수: nav 1, basic-fn 2, logic 3, lookup 3, pivot 0, data-clean 2, fin-fn 3, model-structure 2, three-stmt 2, dcf-intro 2.

`nav` 개념 7개는 단축키라 `excel-only`다. `nav-cell-ref`는 개념 카드가 없고 실습 탭·「실습 시작」으로만 간다. 개념 수를 7에서 바꾸지 않는다.

`pivot`은 핵심 0이다. 레지스트리의 피벗 lab 1개는 extra다.

---

## UI (이 세 가지만)

1. 개념 카드 「실습으로」 → 그 개념의 핵심 랩. `labIds`에서 핵심 ID 중 첫 번째. 핵심이 없으면 첫 extra를 열고 「더 풀기」로 들어간다.
2. 실습 탭 기본 목록 = 그 모듈의 핵심만. 핵심을 모두 끝내면 퀴즈 CTA. extra를 다 풀 필요는 없다.
3. 「더 풀기」가 그 모듈의 나머지 랩을 연다. 「핵심만」으로 돌아온다.

핵심이 0인 모듈(피벗): 빈 화면은 「아직 데이터가 없습니다」가 아니라 퀴즈 또는 「더 풀기」를 권한다.

모듈 칩의 `실습 n/m`은 핵심만 센다.

---

## 진행률

`lab_completions`는 핵심·extra 모두 기록한다.

`learn_progress` complete = 그 모듈 퀴즈를 다 풀고 **핵심** 랩을 다 끝낸 것. extra 완료 건수는 분자에 넣지 않는다. 핵심이 0이면 랩 조건은 자동 충족.

원래 24 퀴즈의 `concept_hint` 순서는 바꾸지 않는다.

---

## 개념 → 랩

`practiceLabId(concept)`:

1. `concept.labIds`에서 핵심인 첫 ID.
2. 없으면 `labIds[0]` (extra).
3. `labIds`가 비면 `undefined` (excel-only).

예: `logic-sumif`의 `labIds`는 `logic-sumif`가 먼저지만 핵심은 `logic-sumifs`다. 「실습으로」는 `logic-sumifs`로 간다.

핵심이 없는 grid 개념 (AND/OR, AVERAGEIF, MIN/MAX, VLOOKUP, MATCH, IRR, PV/FV, RATE, 운전자본 extra 등)은 「실습으로」가 extra를 연다. 이 때문에 랩을 새로 만들지 않는다.

---

## 검증

1. `CORE_LAB_IDS` 길이 20, 중복 없음, 전부 `ALL_LAB_EXERCISES`에 있음 → extra 52, 피벗 lab 1
2. 모듈 핵심 수가 위 표와 같음. 모듈 핵심 순서는 `CORE_LAB_IDS` 부분열
3. `logic-sumif` → `logic-sumifs`. 핵심이 있는 grid 개념의 `practiceLabId`는 핵심
4. `npm run typecheck && npm run lint && npm run test:unit`
5. 브라우저: 논리 모듈 기본 목록 3개, 「더 풀기」 21개, SUMIFS 카드가 `logic-sumifs`로 점프, 핵심 3개 후 퀴즈 CTA

---

## 하지 않음

- 랩·모듈 추가, Coddy식 볼륨 확장
- SPEC.md 제품 재작성
- 피벗 UI / PQ / 순환참조 엔진 / 멀티시트 3-Statement
- `AVERAGEIFS` (엔진에 없음)
- 퀴즈 순서 변경, 실습 ID 변경
- `/learn` 공개, `/lab-preview` 커밋
