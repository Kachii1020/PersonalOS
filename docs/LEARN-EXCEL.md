# Learn 엑셀 과제 — 스펙

게이트 밖 `/learn` 확장. **SPEC.md는 고치지 않는다.** 이 파일이 소스다.
커리큘럼은 코드에 둔다. 함수명은 영어. 그리드 랩 72개·핵심 20·퀴즈 50은 그대로다.

상태: **슬라이스 1 구현됨** (뼈대 + `hands`). 슬라이스 2–4는 아직 구현하지 않는다.

관련: `docs/LEARN-CORE.md` (그리드 기본 경로), `docs/LEARN-NEXT.md` §5.

---

## 0. 한 줄

그리드는 수식을 채점한다. 엑셀은 손과 작품을 만든다. 앱은 제출된 `.xlsx`를 열어 닫힘을 거부할 수 있다.

웹에서 단축키·피벗·PQ·순환·감도를 “연습한 척” 만들지 않는다.

---

## 1. 목표 / 비목표

### 목표

1. `excel-only` 개념 31개 각각이 엑셀 과제 하나 이상에 연결된다.
2. 제출 파일의 **Output 시트 + 구조 신호**로 자동 채점한다. 체크박스만으로 통과 금지.
3. 공시 숫자(또는 동일 형태의 고정 팩)로 3표+DCF 한 개를 닫으면 트랙이 끝난다.
4. 그리드 엔진 함정은 고치지 않고, 엑셀 과제에서 반대 수식을 돌린다.

트랙 complete (새 정의):

- 지금: 모듈 퀴즈 + 그 모듈 핵심 랩 (`LEARN-CORE`)
- 추가: 그 모듈이 속한 과제 팩 pass
- 트랙 끝: 위 전부 + `capstone` pass

### 비목표 (구현하면 반려)

- 피벗 UI / PQ / 순환참조 / 멀티시트 / Data Table을 HyperFormula에 넣기
- Univer, Luckysheet, Excel Online 임베드
- `AVERAGEIFS`를 그리드에 넣기
- 랩 ID 변경, 퀴즈 앞 24문항 재배열, 모듈 추가
- `/learn` 공개, `/lab-preview` 커밋
- 구현 전에 기억으로 DART/EDGAR URL을 코드에 넣기
- 제출 없이 “했어요” 체크만으로 pass

단축키 **방법**은 파일만으로 증명할 수 없다. 손 팩은 단축키가 아니면 번거로운 **결과**를 채점하고, 기존 nav 퀴즈를 유지한다. 스펙이 손을 위조했다고 쓰지 않는다.

---

## 2. 역할 분리

| 층 | 담당 | 증거 |
|---|---|---|
| 개념 카드 | 왜 / 함정 / IB | 기존 62장 |
| 그리드 | 핵심 20 + extra 52 | `lab_completions` |
| 퀴즈 | 50문항 | `quiz_attempts` |
| 엑셀 팩 5개 | 손·피벗·PQ·규약·대조 | `workbook_submissions` |
| 작품 1개 | 3표+DCF 닫힘 | `workbook_submissions` task `capstone` |

외부 파일 파서는 `lib/integrations/xlsx/*`만. UI·액션은 `lib/repos/learn-workbooks.ts`만 부른다. `exceljs` / SheetJS를 컴포넌트에서 import하면 반려.

파서는 이미 있는 `fflate` + `fast-xml-parser`로 OOXML을 읽는다. xlsx 전용 SDK를 먼저 넣지 않는다. 슬라이스 1에서 zip+worksheet 읽기가 부족하면 그때 라이브러리를 DECISIONS에 적고 추가한다.

---

## 3. 데이터

### 3.1 코드 — 과제 정의

`lib/learn/types.ts`에만 필드를 더한다. 개념 수·ID는 불변.

```ts
export type XlsxUnlock = "always" | "after-phase1-cores" | "after-phase2-cores" | "after-packs";

export type XlsxCheck =
  | { id: string; kind: "sheet-exists"; name: string }
  | { id: string; kind: "sheet-order"; names: string[] }
  | { id: string; kind: "cell-value"; sheet: string; addr: string; expected: number | string; tolerance?: number }
  | { id: string; kind: "cell-formula"; sheet: string; addr: string; pattern: string }
  | { id: string; kind: "named-range"; name: string }
  | { id: string; kind: "font-theme"; sheet: string; addr: string; role: "input" | "formula" | "link" }
  | { id: string; kind: "part-exists"; part: "pivot" | "query" | "chart" | "iteration" };

export type XlsxTask = {
  id: string;            // 6개만. 아래 표
  title: string;
  file: string;          // public/learn/xlsx/{id}-starter.xlsx
  conceptIds: string[];
  unlock: XlsxUnlock;
  instruction: string;   // 앱에 표시. 파일 안에 장문 가이드를 넣지 않음
  checks: XlsxCheck[];
};
```

`Concept`에 `xlsxTaskId?: string`을 넣는다. `excel-only` 31개는 필수. `grid`는 넣지 않는다 (대조 팩의 개념은 excel-only가 아니라 그리드 함정 복습이므로 `conceptIds`에 grid ID를 넣되 카드의 `xlsxTaskId`는 비운다).

`Phase.practiceFile` 세 개는 지금 404다. 구현 시 제거하고, 엑셀 탭이 팩 다운로드를 맡는다.

### 3.2 과제 6개 (파일이 6개, 개념이 31개)

한 개념에 파일 하나씩 만들지 않는다.

| id | 제목 | 개념 | unlock |
|---|---|---|---|
| `hands` | 손: 이동·선택·이름 | nav 7 + `basic-fn-names` | always |
| `pivot` | 피벗 한 테이블 | pivot 7 | after-phase1-cores |
| `pq` | 정리 + PQ | `clean-text-to-columns`, `clean-dedupe`, `clean-pq`, `clean-unpivot`, `clean-merge-append` | after-phase1-cores |
| `convention` | 5탭·색·스위치·순환 | `model-color`, `model-sheets`, `model-scenario`, `model-circ`, `stmt-bs`, `stmt-cf-bs`, `stmt-circ-interest` | after-phase2-cores |
| `contrast` | 그리드가 거절하는 수식 | (카드 연결 없음) 아래 4절 | after-phase2-cores |
| `capstone` | 한 회사 닫기 | `dcf-wacc`, `dcf-tv`, `dcf-dt`, `dcf-ff` + 작품 전체 | after-packs |

`xlsxTaskId` 매핑 (31):

```
nav-*                  → hands
basic-fn-names         → hands
pivot-*                → pivot
clean-text-to-columns  → pq
clean-dedupe           → pq
clean-pq               → pq
clean-unpivot          → pq
clean-merge-append     → pq
model-color            → convention
model-sheets           → convention
model-scenario         → convention
model-circ             → convention
stmt-bs                → convention
stmt-cf-bs             → convention
stmt-circ-interest     → convention
dcf-wacc               → capstone
dcf-tv                 → capstone
dcf-dt                 → capstone
dcf-ff                 → capstone
```

`contrast`는 개념 카드를 늘리지 않는다. 엑셀 탭에만 보인다. 함정 문장은 기존 grid 카드에 이미 있다.

### 3.3 DB — `0014_workbook_submissions.sql`

`lab_completions`를 재사용하지 않는다. 과제는 파일이고 랩은 그리드다.

```sql
create table workbook_submissions (
  id            uuid primary key default gen_random_uuid(),
  task_id       text not null unique,          -- 단일 사용자, 과제당 1행
  storage_path  text not null,
  status        text not null,                 -- 'passed' | 'failed'
  results       jsonb not null default '[]',   -- [{id, passed, message}]
  submitted_at  timestamptz not null default now()
);
```

RLS: authenticated + `is_allowed_user()`. GRANT는 `lab_completions`와 같게.

버킷 `learn-workbooks`:

- private
- 5MB
- mime `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`만
- 경로 `{user_id}/{task_id}.xlsx` (단일 유저라도 user_id를 넣어 정책을 단순하게)

기존 `materials` 버킷에 xlsx를 넣지 않는다. mime 목록이 PDF/PPTX다.

`learn_progress` 스키마는 안 바꾼다. `syncModuleProgress`가 그 모듈의 팩 `task_id`가 passed인지 추가로 본다. `capstone`은 모듈 complete에 안 넣고, 트랙 끝 CTA만 본다.

---

## 4. 채점 규칙

### 4.1 공통

1. 스타터를 받아 엑셀(데스크톱 또는 웹)에서 작업하고 **계산 후 저장**한 `.xlsx`만 낸다.
2. 모든 채점 값은 **`Output` 시트**에서 읽는다. 피벗/쿼리/모델은 다른 시트에 두고, 학생이 숫자나 `GETPIVOTDATA`를 Output에 넣는다.
3. 수식 칸은 캐시 값이 있어야 한다. 수식만 있고 `v`가 없으면 실패 메시지: `엑셀에서 계산한 뒤 저장해 제출하세요.`
4. `cell-value` 숫자는 `tolerance` 기본 0.005 (금액·비율). 정수는 tolerance 0.
5. `cell-formula`는 대소문자 무시, 공백 무시. 패턴은 코드에 리터럴로 둔다.
6. `part-exists`는 OOXML 파트가 있는지만 본다. 내용 정답은 Output이다.
7. 한 체크라도 fail이면 과제 `failed`. 이전 passed를 덮어쓴다.
8. 실패는 사과하지 않는다. `{check.id}: {무엇을} / {고치려면}` (SPEC 6.4 규칙 11).
9. 채점 실패(파서 예외)는 `job_runs`가 아니라 제출 응답과 `results`에 `parse` 한 줄로 남긴다. `catch {}` 금지.

### 4.2 체크 kind 의미

| kind | 읽는 것 | 통과 |
|---|---|---|
| `sheet-exists` | workbook.xml 시트 이름 | 이름 일치 |
| `sheet-order` | 시트 순서 | 배열과 동일 |
| `cell-value` | Output(또는 지정 시트) 캐시 값 | expected ± tolerance |
| `cell-formula` | 셀 `f` 텍스트 | `pattern` 매치 |
| `named-range` | definedNames | 이름 존재 |
| `font-theme` | 스타일+색 | input≈파랑, formula≈검정, link≈초록. 정확한 hex는 구현 시 스타터 테마에 고정하고 테스트에 적는다 |
| `part-exists:pivot` | `xl/pivotTables/` | 파일 ≥1 |
| `part-exists:query` | 연결/쿼리 파트 (`xl/connections.xml` 또는 queryTables) | ≥1 |
| `part-exists:chart` | `xl/charts/` | ≥1 |
| `part-exists:iteration` | workbook calcPr `iterate="1"` | true |

새 kind를 슬라이스 중에 필요해서 넣으면 DECISIONS에 한 줄. 슬라이스 1에서 6개를 넘는 kind를 미리 만들지 않는다.

### 4.3 언락

```
phase1 cores = nav + basic-fn + logic + lookup 의 CORE_LAB_IDS
phase2 cores = data-clean + fin-fn   (pivot 핵심 0)
packs        = hands, pivot, pq, convention, contrast 전부 passed
```

- `always`: 바로 업로드 가능
- `after-phase1-cores`: 위 집합의 모든 핵심 랩이 `lab_completions`에 있을 때
- `after-phase2-cores`: phase1+phase2 핵심 전부
- `after-packs`: 다섯 팩 passed. 핵심 20도 전부 완료여야 한다

잠긴 과제는 다운로드는 되고 업로드 버튼은 비활성. 빈 상태가 “아직 데이터가 없습니다”가 아니라 `핵심 실습 n개를 더 끝내면 제출할 수 있습니다` + 실습 탭 링크.

---

## 5. 파일별 과제 (스타터 내용 + 체크 ID)

스타터는 `public/learn/xlsx/`에 커밋한다. 정답 파일은 `tests/fixtures/learn/`에만 둔다. 정답을 public에 두지 않는다.

구현 전에 스타터를 엑셀에서 만들어 zip이 열리는지 확인한다. 빈 파일을 이름만 넣지 않는다.

### 5.1 `hands` — 손

스타터 시트: `Data`, `Output`.

- `Data!A1:B1` 헤더 `이름`, `금액`. A2:A501 고유 이름, B2:B501 정수 금액. 값은 스타터에 고정(시드 상수). 빈 칸 없음.
- `Output` 빈 칸 + 라벨(A열만):

| 칸 | 학생이 넣을 것 | 체크 |
|---|---|---|
| B2 | Data 마지막 행 번호 | `hands-last-row` cell-value 501 |
| B3 | Data 금액 합 | `hands-sum` cell-value = 스타터 합(구현 시 상수로 박음) , formula `SUM` |
| B4 | `TaxRate` 이름을 쓴 세후 1원 가정 `=100*(1-TaxRate)` | `hands-name` named-range `TaxRate`, formula TaxRate |
| B5 | C2에 `=B2*$E$1`을 두고 Ctrl+D로 C2:C6를 채운 뒤 C6 값 | `hands-fill` cell-value (스타터 E1 고정) |

앱 instruction: Ctrl+↓로 마지막 행, Ctrl+Shift+↓로 합 범위, 이름 상자, Ctrl+D. 방법 자체는 채점하지 않는다고 명시.

시트 `Data` 존재: `hands-data` sheet-exists.

### 5.2 `pivot` — 피벗

스타터: `Sales` (날짜, 지역, 제품, 금액 — 고정 120행, 2023-01~2024-12, 지역 3, 제품 3), `Output`.

학생이 `Pivot` 시트를 만들고 Alt+N+V로 피벗. 행=지역, 열=분기(날짜 그룹), 값=합계, 계산필드 `원가율` (금액*0.6 같은 고정 식), 슬라이서 지역, 피벗 차트 1.

Output:

| 칸 | 의미 | 체크 |
|---|---|---|
| B2 | 서울 2023Q1 매출 | `pivot-seoul-q1` cell-value (스타터에서 미리 계산한 상수) |
| B3 | 슬라이서에서 부산만 켠 뒤의 총매출 | `pivot-busan` — **하지 않음**. 슬라이서 상태는 파일에 불안정. 퀴즈로 남김 |
| B4 | 계산필드가 가리키는 서울 연간 원가 | `pivot-cogs` cell-value |

구조: `pivot-sheet` sheet-exists `Pivot`, `pivot-part` part-exists pivot, `pivot-chart` part-exists chart.

슬라이서·값 필드 설정은 기존 피벗 퀴즈가 맡는다. 파일이 증명하는 것은 “피벗이 있고 Output 숫자가 맞다”.

### 5.3 `pq` — 정리 + PQ

스타터: `Raw` (앞뒤 공백 이름, `코드-연도` 한 칸, 연도 가로 열 2022 2023 2024), `Jan`, `Feb` (같은 열 이름, 행 10).

학생:

1. Raw를 Text to Columns 또는 PQ split
2. 중복 1행 제거
3. Unpivot 연도
4. Jan+Feb Append
5. 결과를 `Clean` 시트에 두기

Output:

| 칸 | 체크 |
|---|---|
| B2 | Clean 행 수 | `pq-rows` cell-value |
| B3 | 첫 키의 2023 값 | `pq-first-2023` cell-value |
| B4 | Append 합계 | `pq-append-sum` cell-value |

구조: `pq-query` part-exists query. T2C만 하고 쿼리가 없으면 fail. 수동 복붙으로 숫자만 맞추는 것을 거절하는 장치다.

Text to Columns / 중복제거 개념은 이 한 파일에 묶인다. 퀴즈는 기존 유지.

### 5.4 `convention` — 규약 + 작은 순환

스타터 시트 순서 고정: `Assumptions`, `IS`, `BS`, `CF`, `Valuation`, `Output`.

Assumptions (입력, 파랑):

- B1 시나리오 `1` (1=Base, 2=Upside)
- B2 Base 성장, C2 Upside 성장
- B3 세율, B4 금리, B5 기초 차입

학생:

- IS 매출은 전년*(1+성장). 성장은 `INDEX`/`CHOOSE`로 B1에 연결. 하드코딩 금지.
- 이자는 평균차입×금리 (순환). 통합문서 반복계산 켜기.
- BS 현금은 CF 기말. BS 체크 행.
- 입력 파랑, 수식 검정, IS에서 Assumptions를 가리키는 칸 초록.

Output:

| 칸 | 체크 |
|---|---|
| B2 | 시나리오 1일 때 NI | `conv-ni-base` cell-value |
| B3 | 시나리오를 2로 바꾼 뒤의 NI — **제출 파일은 시나리오 1로 저장**. 시나리오 2는 채점 안 함. 퀴즈 + instruction “제출 전 B1=1” |
| B4 | BS 체크 | `conv-bs` cell-value 0 |
| B5 | CF 기말 현금 | `conv-cash` = BS 현금과 같은 값, formula 참조 |
| B6 | 이자 | `conv-int` cell-value (반복 수렴 상수) |

구조: `conv-order` sheet-order 위 6개, `conv-iter` part-exists iteration, `conv-input-color` font-theme Assumptions!B2 input, `conv-formula-color` font-theme IS!B5 formula, `conv-link-color` font-theme IS!B2 link.

성장 하드코딩: `conv-growth-ref` cell-formula IS 매출 칸이 `Assumptions`를 포함.

### 5.5 `contrast` — 엔진이 거절하는 것

스타터: `GridNote` (읽기 전용 텍스트: 그리드에서는 이 수식이 죽는다), `Work`, `Output`.

Work에 날짜(DATE), 현금흐름, 지역/금액.

학생이 Output에:

| 칸 | 수식 | 체크 |
|---|---|---|
| B2 | `XNPV(rate, values, DATE() 날짜열)` | `ctr-xnpv` cell-value (우리가 엑셀에서 한 번 계산한 상수) + formula `XNPV`와 `DATE` |
| B3 | `SUMPRODUCT((지역="서울")*(금액))` | `ctr-sp` cell-value + formula `SUMPRODUCT` |
| B4 | `AVERAGEIFS(금액, 지역, "서울")` | `ctr-aifs` cell-value + formula `AVERAGEIFS` |
| B5 | `IFS` 마지막 `TRUE, "그외"` | `ctr-ifs` cell-value + formula `IFS`와 `TRUE` |

그리드 테스트를 이 수식에 맞춰 고치지 않는다.

### 5.6 `capstone` — 작품

스타터: `Source`, `Assumptions`, `IS`, `BS`, `CF`, `Valuation`, `Output`.
`Source`는 파랑 입력. 다른 시트는 헤더·라벨만.

**Source 숫자**는 구현 슬라이스 4에서 고른다.

1. DART에서 LG생활건강 연간 연결 손익·재무·현금흐름을 **실제로 받아** `docs/LEARN-EXCEL-SOURCE.md`에 출처(공시 일자, 문서명)와 표를 적고 `public/learn/xlsx/capstone-source.csv`로 고정한다. 런타임 fetch 없음.
2. 그 호출이 실패하면 합성 `Acme Consumer`를 같은 행 구조로 넣고, UI와 출처 문서에 `합성`이라고 쓴다. 가짜 URL을 만들지 않는다.

행 구조 (Source!A:C, 연도 2개 + YoY는 학생이 계산):

```
매출 / COGS / 판관비 / DA / 이자 / 세율
현금 / 매출채권 / 재고 / 유형자산 / 매입채무 / 차입금 / 자본금 / 이익잉여금
감가상각(CF) / Capex / 운전자본 증감은 학생이 BS 차분으로
```

시작 연도 잔액은 Source에 있다. 학생은 예측 1년을 Assumptions 성장으로 민다.

Output 체크 (8개, 이전 대화의 닫힘):

| id | 칸 | 규칙 |
|---|---|---|
| `cap-bs` | B2 | 자산−부채−자본 = 0 |
| `cap-re` | B3 | 기말 RE = 기초 RE + NI − 배당(배당 0으로 고정) |
| `cap-da` | B4 | CFO에 DA가 가산된 값. formula에 DA 참조 |
| `cap-cash` | B5 | CF 기말 현금 = BS 현금 |
| `cap-circ` | B6 | 이자 수식이 차입을 참조, iteration on |
| `cap-fcf` | B7 | 영업CF − Capex |
| `cap-eq` | B8 | EV − Net Debt |
| `cap-dt` | B9 | Data Table 격자 중앙값(WACC×g). part chart는 `cap-ff` part-exists chart (Football Field는 차트 1 + Output B10 min/max EV) |

`cap-dt`는 엑셀 Data Table이 XML로 불안정하면 **학생이 채운 3×3 격자**를 값으로 채점한다 (B12:D14). instruction에 “Data Table로 채워도 되고 수식으로 채워도 된다. 값은 WACC±1%p, g±1%p”. 방법은 강제하지 않고 값의 단조성만 본다: 중앙이 우리 상수와 같고, WACC이 오르면 EV가 내린다 (`cap-dt-mono`: B12 > B14).

WACC·TV 공식은 Assumptions에 두고 Output은 결과만. `dcf-wacc`/`dcf-tv` 카드는 이 과제로 연결된다.

---

## 6. UI

탭을 다섯 개로 늘린다: 개념 | 실습 | **엑셀** | 퀴즈 | 리소스.
실습은 그리드만. 엑셀 탭이 팩 목록이다.

SPEC 6.4: 글래스 없음, 그라디언트 없음, 이모지 없음, `cursor-pointer` + 포커스 링, 숫자는 등폭, 빈 상태는 다음 행동.

엑셀 탭 한 행 = 과제 1개.

- 제목, 언락 여부, 마지막 status (없음 / 실패 / 통과)
- 스타터 다운로드
- 파일 선택 + 제출 (언락 시)
- 실패면 `results`에서 failed 체크만 목록

개념 카드:

- `grid`: 지금처럼 「실습으로」
- `excel-only`: 「퀴즈로」 옆에 「엑셀 과제」 → 엑셀 탭 + 해당 `task_id`로 스크롤
- 두 버튼 모두 포커스 링

모듈 칩: `실습 a/b · 과제 passed/1` (그 모듈에 팩이 있을 때만 과제). 피벗은 실습 0, 과제 0/1.

트랙 헤더 진행 숫자는 퀴즈 50을 유지한다. 과제 6개를 헤더에 섞어 분모를 바꾸지 않는다. 엑셀 탭 상단에 `과제 2/6`을 따로 둔다.

제출 중 스켈레톤. 서버 액션 `submitWorkbook(taskId, formData)`. 클라이언트에서 xlsx를 파싱하지 않는다.

---

## 7. 서버 경로

```
submitWorkbook
  → 언락 확인 (아니면 400)
  → mime/크기 검사
  → storage upload
  → gradeWorkbook(taskId, bytes)
  → workbook_submissions upsert
  → 그 모듈 syncModuleProgress (팩이 모듈에 묶인 경우)
  → revalidatePath("/learn")
  → { status, results }
```

`gradeWorkbook`은 순수 함수 + zip 읽기. 네트워크 없음. 단위 테스트는 픽스처 바이트만.

언락 함수 `canSubmitXlsx(task, completions, submissions)`도 순수. 테스트 필수.

---

## 8. 진행률

모듈 complete:

```
퀴즈 전부 응시
AND 핵심 랩 전부 (0개면 참)
AND 그 모듈 concept의 xlsxTaskId들이 모두 passed
```

nav complete는 퀴즈 + `nav-cell-ref` + `hands` passed.
pivot complete는 퀴즈 + `pivot` passed (핵심 0).
dcf-intro complete는 퀴즈 + 핵심 2 + `capstone` passed.

`contrast`는 모듈에 안 묶인다. 트랙 끝(`after-packs`의 packs에 포함)에만 필요하다.

헤더 “전체 커리큘럼 완료”는 모듈 10개 complete + contrast passed. (capstone은 dcf-intro에 묶여 있음)

---

## 9. 테스트

| 테스트 | 내용 |
|---|---|
| `tests/learn-excel-map.test.ts` | excel-only 31개 전부 `xlsxTaskId`. 6 task id. conceptIds 합집합이 31 |
| `tests/learn-excel-unlock.test.ts` | 언락 네 단계 |
| `tests/learn-excel-grade.test.ts` | 과제마다 fail 픽스처 1 + pass 픽스처 1. 슬라이스마다 그 과제만 추가 |
| 기존 `curriculum.test.ts` | 개념 수·퀴즈 순서 불변 |
| 기존 `core-track.test.ts` | 20/52/피벗1 불변 |
| 기존 스프레드시트 정답 | 한 줄도 안 고침 |

픽스처는 진짜 xlsx다. 구현자가 엑셀에서 저장한다. 빈 zip을 만들지 않는다.

---

## 10. 구현 슬라이스

한 PR에 6과제를 넣지 않는다. SPEC 여러 Phase를 한 번에 열지 않는 것과 같다.

### 슬라이스 1 — 뼈대 + `hands`

verify:

- 마이그레이션 0014, 버킷, 리포, 엑셀 탭, `hands` 다운로드/업로드
- pass 픽스처 passed, 합을 틀린 파일은 `hands-sum` fail
- 그리드/퀴즈 숫자 불변, typecheck/lint/unit
- 호스티드에 0014를 올렸다고 **주장하지 않음**. 운영자가 `db push`

하지 않음: 나머지 5과제, 언락(hands는 always라 스텁만).

### 슬라이스 2 — `pivot` + `pq` + 언락

verify: phase1 핵심을 테스트 더블로 채운 뒤에만 pivot 제출 허용. 쿼리 없는 pq 파일은 `pq-query` fail.

### 슬라이스 3 — `convention` + `contrast`

verify: iteration 꺼진 convention은 `conv-iter` fail. contrast 수식에 DATE/AVERAGEIFS/TRUE. 그리드 XNPV 테스트는 여전히 일련번호.

### 슬라이스 4 — `capstone` + 출처 문서

verify: 8체크 pass 픽스처 / 현금 하드코딩 fail(`cap-cash`). `docs/LEARN-EXCEL-SOURCE.md`에 출처 또는 `합성`.

---

## 11. UI 복사 (고정)

- 탭 라벨: `엑셀`
- 카드 버튼: `엑셀 과제`
- 잠김: `핵심 실습을 더 끝내면 제출할 수 있습니다`
- 파서: `엑셀에서 계산한 뒤 저장해 제출하세요.`
- 통과: `이 과제를 통과했습니다`
- 트랙 끝: `핵심 실습과 엑셀 과제를 모두 통과했습니다` (지금 “전체 커리큘럼 완료”를 이 문장으로 교체하는 것은 슬라이스 4)

이모지 금지.

---

## 12. 가정 (구현 전 뒤집지 말 것)

1. 사용자는 엑셀을 쓸 수 있다. 앱이 엑셀을 대체하지 않는다.
2. 단일 사용자라 `task_id` unique면 충분하다.
3. 슬라이서 상태·시나리오 2는 파일 채점에서 뺀다.
4. Football Field는 차트 존재 + min/max 값이다. 축 단위까지 읽지 않는다.
5. PQ는 데스크톱 엑셀 기준이다. Excel Online이 쿼리를 빼면 그 환경은 지원 밖이다. instruction에 적는다.
6. 스타터는 git에 바이너리로 넣는다. 5MB 제한보다 작게.

---

## 13. 열린 결정 (스펙이 고른 값)

| 항목 | 선택 | 버린 것 |
|---|---|---|
| 채점 위치 | Output 시트 + 구조 파트 | 피벗 캐시 숫자만, 또는 명예 시스템 |
| 파일 수 | 6 | 개념당 1파일 (31) |
| 파서 | fflate+XML 먼저 | 처음부터 exceljs |
| 작품 회사 | 슬라이스 4에서 실공시 1회, 실패 시 합성 | 런타임 DART |
| 손 | 결과 채점 + 기존 퀴즈 | 키로거, 매크로 기록 |
| 탭 | 엑셀을 실습과 분리 | 실습 탭에 업로드 섞기 |

---

## 14. 슬라이스 1 착수 조건

이 문서 승인 후. SPEC.md 개정은 필요 없다. 마이그레이션은 `0014` 새 파일만.
