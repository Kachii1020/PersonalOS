import test from "node:test";
import assert from "node:assert/strict";
import {
  CURRICULUM,
  allConcepts,
  allModules,
  allQuizzes,
} from "@/lib/learn/curriculum";
import { ALL_LAB_EXERCISES } from "@/lib/spreadsheet/exercises";

const CONCEPT_COUNTS: Record<string, number> = {
  nav: 7,
  "basic-fn": 4,
  logic: 6,
  lookup: 6,
  pivot: 7,
  "data-clean": 7,
  "fin-fn": 6,
  "model-structure": 6,
  "three-stmt": 7,
  "dcf-intro": 6,
};

const CONCEPT_TITLES: Record<string, string[]> = {
  nav: [
    "Ctrl+방향키로 데이터 끝까지 이동",
    "Ctrl+Shift+방향키로 범위 선택",
    "Ctrl+Space / Shift+Space (열/행 선택)",
    "Alt → 리본 단축키 체계",
    "F2 (셀 편집 모드 진입)",
    "Ctrl+1 (셀 서식), Ctrl+; (오늘 날짜)",
    "Ctrl+D / Ctrl+R (아래/오른쪽 채우기)",
  ],
  "basic-fn": [
    "SUM, AVERAGE, COUNT, COUNTA, COUNTBLANK",
    "MIN, MAX, LARGE, SMALL",
    "절대참조($A$1) vs 상대참조(A1) vs 혼합참조",
    "이름 정의(Name Manager)로 범위에 이름 붙이기",
  ],
  logic: [
    "IF / IFS / 중첩 IF",
    "AND, OR, NOT",
    "IFERROR, IFNA",
    "SUMIF, SUMIFS",
    "COUNTIF, COUNTIFS",
    "AVERAGEIF, AVERAGEIFS",
  ],
  lookup: [
    "VLOOKUP 구조와 한계",
    "XLOOKUP",
    "INDEX(범위, 행, [열])",
    "MATCH(값, 범위, [유형])",
    "INDEX-MATCH 조합",
    "2차원: INDEX-MATCH-MATCH",
  ],
  pivot: [
    "피벗 테이블 생성 (Alt+N+V)",
    "행/열/값/필터 영역",
    "값 필드 설정",
    "날짜 그룹화",
    "슬라이서",
    "피벗 차트",
    "Calculated Field",
  ],
  "data-clean": [
    "Text to Columns",
    "중복 제거, 빈 셀 처리",
    "TRIM, CLEAN, SUBSTITUTE",
    "LEFT, RIGHT, MID, FIND, LEN",
    "Power Query 기초",
    "열 병합/분할, 피벗 해제",
    "Merge & Append",
  ],
  "fin-fn": [
    "NPV, XNPV",
    "IRR, XIRR",
    "PMT, IPMT, PPMT",
    "PV, FV",
    "RATE, NPER",
    "부호 규칙 (유입=+, 유출=-)",
  ],
  "model-structure": [
    "컬러 컨벤션: 입력=파랑, 수식=검정, 링크=초록",
    "하드코딩 금지",
    "시트 구조: Assumptions → IS → BS → CF → Valuation",
    "BS 밸런스 체크 행",
    "시나리오 스위치",
    "순환참조 해결",
  ],
  "three-stmt": [
    "IS 구축",
    "BS 구축",
    "CF 간접법",
    "IS→BS: 순이익→이익잉여금",
    "BS→CF: 운전자본 변동, 감가상각",
    "CF→BS: 기말 현금",
    "순환참조: 이자비용↔차입금",
  ],
  "dcf-intro": [
    "FCF = 영업CF - Capex",
    "WACC",
    "Terminal Value",
    "EV → Equity Value",
    "감도분석 Data Table",
    "Football Field Chart",
  ],
};

const EXCEL_ONLY_REQUIRED = [
  "nav-ctrl-arrow",
  "nav-ctrl-shift",
  "nav-space",
  "nav-alt-ribbon",
  "nav-f2",
  "nav-format",
  "nav-fill-keys",
  "pivot-create",
  "pivot-areas",
  "pivot-value",
  "pivot-group",
  "pivot-slicer",
  "pivot-chart",
  "pivot-calc",
  "clean-pq",
  "clean-unpivot",
  "clean-merge-append",
  "model-circ",
  "stmt-circ-interest",
];

const QUIZ_PROMPTS = [
  "1000행 데이터에서 A1에서 마지막 데이터 행까지 이동하려면?",
  "A1:A500을 한 번에 선택하는 가장 빠른 방법은?",
  "셀 서식 대화상자를 여는 단축키는?",
  "B2에 =A2*C$1 수식이 있다. B3로 복사하면?",
  "빈 셀 제외하고 데이터가 있는 셀 수를 세려면?",
  "두 번째로 큰 값을 구하려면?",
  '매출 1억 이상 + 지역 "서울"인 행의 합계를 구하려면?',
  "VLOOKUP에서 #N/A 대신 0을 표시하려면?",
  '=IF(AND(A1>100, B1="Y"), "승인", "보류") — A1=150, B1="N"일 때?',
  "INDEX-MATCH가 VLOOKUP보다 선호되는 핵심 이유는?",
  "MATCH의 세 번째 인수 0의 의미는?",
  "특정 회사의 특정 연도 매출을 동적으로 찾을 때 쓰는 패턴은?",
  "일별 매출 데이터를 분기별로 묶으려면?",
  "피벗에서 매출 대비 원가 비율을 보려면?",
  "같은 형식의 월별 시트 여러 개를 합치는 가장 효율적 방법?",
  '" Samsung Electronics Co. " (앞뒤 공백)을 정리하려면?',
  "NPV와 XNPV의 차이는?",
  "=PMT(0.05/12, 360, -500000000)의 의미는?",
  "성장률 15%를 =B5*1.15로 직접 쓰면 안 되는 이유는?",
  "BS 밸런스 체크 행(자산-부채-자본=0)을 넣는 이유는?",
  "간접법 CF에서 감가상각비를 순이익에 더하는 이유는?",
  "매출채권 증가가 영업CF에 미치는 영향은?",
  "TV가 기업가치의 60–80%를 차지한다. 이것이 의미하는 바는?",
  "EV에서 Equity Value를 구하려면?",
];

const LAB_IDS = new Set(ALL_LAB_EXERCISES.map((ex) => ex.id));

test("모듈 10개, 퀴즈 50개", () => {
  assert.equal(CURRICULUM.length, 3);
  assert.equal(allModules().length, 10);
  assert.equal(allQuizzes().length, 50);
  assert.deepEqual(
    allModules().map((m) => m.id),
    Object.keys(CONCEPT_COUNTS),
  );
});

test("모듈별 개념 수는 기존 불릿과 같다", () => {
  for (const mod of allModules()) {
    assert.equal(mod.concepts.length, CONCEPT_COUNTS[mod.id], mod.id);
    assert.deepEqual(
      mod.concepts.map((c) => c.title),
      CONCEPT_TITLES[mod.id],
      mod.id,
    );
  }
});

test("기존 퀴즈는 각 모듈 앞에 그대로 있다", () => {
  let offset = 0;
  for (const mod of allModules()) {
    const original = QUIZ_PROMPTS.slice(offset, offset + 2);
    if (mod.id === "nav" || mod.id === "basic-fn" || mod.id === "logic" || mod.id === "lookup") {
      const three = QUIZ_PROMPTS.slice(offset, offset + 3);
      assert.deepEqual(mod.quizzes.slice(0, 3).map((q) => q.q), three, mod.id);
      offset += 3;
    } else {
      assert.deepEqual(mod.quizzes.slice(0, 2).map((q) => q.q), original, mod.id);
      offset += 2;
    }
  }
  assert.equal(offset, 24);
});

test("AND/OR·AVERAGEIF·XLOOKUP은 grid로 뒤집혔다", () => {
  const byId = new Map(allConcepts().map((c) => [c.id, c]));
  for (const id of ["logic-and-or", "logic-averageif", "lookup-xlookup"]) {
    const concept = byId.get(id);
    assert.ok(concept, id);
    assert.equal(concept.kind, "grid", id);
    assert.ok(concept.labIds.length >= 1, id);
  }
});

test("개념·퀴즈 id는 유일하다", () => {
  const conceptIds = allConcepts().map((c) => c.id);
  assert.equal(new Set(conceptIds).size, conceptIds.length);
  const quizIds = allQuizzes().map((q) => q.id);
  assert.equal(new Set(quizIds).size, quizIds.length);
});

test("단축키·피벗·PQ·순환참조는 excel-only이고 lab이 없다", () => {
  const byId = new Map(allConcepts().map((c) => [c.id, c]));
  for (const id of EXCEL_ONLY_REQUIRED) {
    const concept = byId.get(id);
    assert.ok(concept, id);
    assert.equal(concept.kind, "excel-only", id);
    assert.equal(concept.labIds.length, 0, id);
  }
});

test("excel-only 개념은 labIds가 비어 있다", () => {
  for (const concept of allConcepts()) {
    if (concept.kind === "excel-only") {
      assert.equal(concept.labIds.length, 0, concept.id);
      assert.ok(concept.quizIds.length >= 1, concept.id);
    }
  }
});

test("grid 개념은 lab≥1, quiz≥1", () => {
  for (const concept of allConcepts()) {
    if (concept.kind === "grid") {
      assert.ok(concept.labIds.length >= 1, concept.id);
      assert.ok(concept.quizIds.length >= 1, concept.id);
    }
  }
});

test("labId는 기존 실습 id이고 quizId는 같은 모듈에 있다", () => {
  for (const mod of allModules()) {
    const quizIds = new Set(mod.quizzes.map((q) => q.id));
    for (const concept of mod.concepts) {
      for (const labId of concept.labIds) {
        assert.ok(LAB_IDS.has(labId), `${concept.id} → ${labId}`);
      }
      for (const quizId of concept.quizIds) {
        assert.ok(quizIds.has(quizId), `${concept.id} → ${quizId}`);
      }
    }
  }
});
