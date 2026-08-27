// components/widgets/LearnDashboard.tsx
"use client";

import { useState, useCallback } from "react";
import {
  BookOpen,
  CheckCircle2,
  Trophy,
  ArrowRight,
  RotateCcw,
  ExternalLink,
  Download,
} from "lucide-react";

// ─── Types ───
interface Exercise {
  q: string;
  options: string[];
  answer: number;
  explain: string;
}

interface Module {
  id: string;
  title: string;
  concepts: string[];
  exercises: Exercise[];
}

interface Phase {
  phase: number;
  title: string;
  weeks: string;
  desc: string;
  modules: Module[];
  practiceFile?: { name: string; href: string };
}

// ─── Data (mirrors seed-excel-finance.sql) ───
// In production, this comes from lib/repos/learn.ts → Supabase.
// Hardcoded here for offline-first rendering; Supabase syncs progress only.
const CURRICULUM: Phase[] = [
  {
    phase: 1,
    title: "Excel 기초 체력",
    weeks: "1–2주차",
    desc: "마우스 없이 엑셀을 다루는 속도감 + 핵심 함수 12개",
    practiceFile: { name: "phase1-practice.xlsx", href: "/learn/phase1-practice.xlsx" },
    modules: [
      {
        id: "nav",
        title: "네비게이션 & 단축키",
        concepts: [
          "Ctrl+방향키로 데이터 끝까지 이동",
          "Ctrl+Shift+방향키로 범위 선택",
          "Ctrl+Space / Shift+Space (열/행 선택)",
          "Alt → 리본 단축키 체계",
          "F2 (셀 편집 모드 진입)",
          "Ctrl+1 (셀 서식), Ctrl+; (오늘 날짜)",
          "Ctrl+D / Ctrl+R (아래/오른쪽 채우기)",
        ],
        exercises: [
          {
            q: "1000행 데이터에서 A1에서 마지막 데이터 행까지 이동하려면?",
            options: ["Ctrl+End", "Ctrl+↓", "Ctrl+Shift+End", "Page Down"],
            answer: 1,
            explain:
              "Ctrl+↓는 현재 열에서 데이터가 있는 마지막 셀까지 점프한다. Ctrl+End는 사용된 범위의 우하단 끝으로 간다.",
          },
          {
            q: "A1:A500을 한 번에 선택하는 가장 빠른 방법은?",
            options: [
              "드래그",
              "Ctrl+Shift+↓",
              "Shift+Ctrl+End",
              "이름 상자에 A1:A500 입력",
            ],
            answer: 1,
            explain:
              "A1에서 Ctrl+Shift+↓. 데이터가 연속이면 마지막 행까지 선택된다.",
          },
          {
            q: "셀 서식 대화상자를 여는 단축키는?",
            options: ["Ctrl+F", "Ctrl+1", "Ctrl+Shift+1", "Alt+H"],
            answer: 1,
            explain:
              "Ctrl+1이 셀 서식(Format Cells) 대화상자. Ctrl+Shift+1은 숫자 서식을 바로 적용한다.",
          },
        ],
      },
      {
        id: "basic-fn",
        title: "기본 함수",
        concepts: [
          "SUM, AVERAGE, COUNT, COUNTA, COUNTBLANK",
          "MIN, MAX, LARGE, SMALL",
          "절대참조($A$1) vs 상대참조(A1) vs 혼합참조",
          "이름 정의(Name Manager)로 범위에 이름 붙이기",
        ],
        exercises: [
          {
            q: "B2에 =A2*C$1 수식이 있다. B3로 복사하면?",
            options: ["=A3*C$1", "=A2*C$1", "=A3*C$2", "=A2*C$2"],
            answer: 0,
            explain:
              "A2→A3 (상대참조), C$1→C$1 (혼합참조, $가 행 고정). 세율 같은 고정 값 참조에 쓰는 패턴.",
          },
          {
            q: "빈 셀 제외하고 데이터가 있는 셀 수를 세려면?",
            options: ["COUNT", "COUNTA", "COUNTBLANK", "LEN"],
            answer: 1,
            explain:
              "COUNT는 숫자만, COUNTA는 비어있지 않은 셀 전부, COUNTBLANK는 빈 셀.",
          },
          {
            q: "두 번째로 큰 값을 구하려면?",
            options: ["MAX-1", "LARGE(범위, 2)", "RANK(2)", "INDEX(MAX)"],
            answer: 1,
            explain: "LARGE(범위, k)는 k번째로 큰 값. SMALL은 반대.",
          },
        ],
      },
      {
        id: "logic",
        title: "논리 & 조건부 집계",
        concepts: [
          "IF / IFS / 중첩 IF",
          "AND, OR, NOT",
          "IFERROR, IFNA",
          "SUMIF, SUMIFS",
          "COUNTIF, COUNTIFS",
          "AVERAGEIF, AVERAGEIFS",
        ],
        exercises: [
          {
            q: '매출 1억 이상 + 지역 "서울"인 행의 합계를 구하려면?',
            options: [
              'SUMIF(지역,"서울",매출)',
              'SUMIFS(매출,지역,"서울",매출,">="&1억)',
              "SUM(IF(...))",
              "SUMPRODUCT",
            ],
            answer: 1,
            explain:
              "SUMIFS는 복수 조건. 첫 인수가 합산 범위, 이후 (조건범위, 조건) 쌍을 나열.",
          },
          {
            q: "VLOOKUP에서 #N/A 대신 0을 표시하려면?",
            options: [
              "IF(VLOOKUP=NA,0)",
              "IFERROR(VLOOKUP(...), 0)",
              "VLOOKUP(..., FALSE, 0)",
              "ISNA(VLOOKUP(...))",
            ],
            answer: 1,
            explain:
              "IFERROR는 에러 시 지정한 값으로 대체. 재무 모델에서 필수.",
          },
          {
            q: '=IF(AND(A1>100, B1="Y"), "승인", "보류") — A1=150, B1="N"일 때?',
            options: ["승인", "보류", "#VALUE!", "TRUE"],
            answer: 1,
            explain:
              'AND는 모든 조건이 TRUE여야 함. B1="N"이므로 FALSE → "보류".',
          },
        ],
      },
      {
        id: "lookup",
        title: "INDEX-MATCH",
        concepts: [
          "VLOOKUP 구조와 한계",
          "XLOOKUP",
          "INDEX(범위, 행, [열])",
          "MATCH(값, 범위, [유형])",
          "INDEX-MATCH 조합",
          "2차원: INDEX-MATCH-MATCH",
        ],
        exercises: [
          {
            q: "INDEX-MATCH가 VLOOKUP보다 선호되는 핵심 이유는?",
            options: [
              "더 빠르다",
              "조회 열이 왼쪽에 있어도 작동한다",
              "자동 에러 처리",
              "피벗 호환",
            ],
            answer: 1,
            explain:
              "VLOOKUP은 왼→오 고정. INDEX-MATCH는 방향 제한 없고 열 삽입에 안전.",
          },
          {
            q: "MATCH의 세 번째 인수 0의 의미는?",
            options: ["오름차순 근사", "정확 일치", "내림차순 근사", "와일드카드"],
            answer: 1,
            explain: "0은 exact match. 재무 데이터에서는 거의 항상 0.",
          },
          {
            q: "특정 회사의 특정 연도 매출을 동적으로 찾을 때 쓰는 패턴은?",
            options: [
              "VLOOKUP 중첩",
              "INDEX-MATCH-MATCH",
              "INDIRECT",
              "OFFSET",
            ],
            answer: 1,
            explain:
              "INDEX(데이터, MATCH(행값,행헤더,0), MATCH(열값,열헤더,0)). 모델링 핵심 패턴.",
          },
        ],
      },
    ],
  },
  {
    phase: 2,
    title: "재무 분석 실무",
    weeks: "3–4주차",
    desc: "피벗 테이블, 데이터 정리, 재무 함수",
    practiceFile: { name: "phase2-practice.xlsx", href: "/learn/phase2-practice.xlsx" },
    modules: [
      {
        id: "pivot",
        title: "피벗 테이블",
        concepts: [
          "피벗 테이블 생성 (Alt+N+V)",
          "행/열/값/필터 영역",
          "값 필드 설정",
          "날짜 그룹화",
          "슬라이서",
          "피벗 차트",
          "Calculated Field",
        ],
        exercises: [
          {
            q: "일별 매출 데이터를 분기별로 묶으려면?",
            options: [
              "날짜 우클릭 → 그룹화 → 분기",
              "QUARTER 함수로 새 열",
              "필터에서 분기 선택",
              "정렬 후 소계",
            ],
            answer: 0,
            explain:
              "피벗 날짜 필드 우클릭 → 그룹화. 원본 데이터를 건드리지 않는다.",
          },
          {
            q: "피벗에서 매출 대비 원가 비율을 보려면?",
            options: [
              "옆 셀에 수식",
              "Calculated Field로 =원가/매출",
              "값 형식을 %로 변경",
              "조건부 서식",
            ],
            answer: 1,
            explain:
              "Calculated Field는 피벗 내부에서 필드 간 연산. 원본에 열을 추가하지 않아도 됨.",
          },
        ],
      },
      {
        id: "data-clean",
        title: "데이터 정리 & PQ",
        concepts: [
          "Text to Columns",
          "중복 제거, 빈 셀 처리",
          "TRIM, CLEAN, SUBSTITUTE",
          "LEFT, RIGHT, MID, FIND, LEN",
          "Power Query 기초",
          "열 병합/분할, 피벗 해제",
          "Merge & Append",
        ],
        exercises: [
          {
            q: "같은 형식의 월별 시트 여러 개를 합치는 가장 효율적 방법?",
            options: [
              "수동 복사",
              "INDIRECT",
              "Power Query Append",
              "VBA 매크로",
            ],
            answer: 2,
            explain:
              "Append는 같은 구조의 테이블을 합친다. 새 시트가 추가돼도 새로고침 한 번.",
          },
          {
            q: '" Samsung Electronics Co. " (앞뒤 공백)을 정리하려면?',
            options: ["CLEAN", "TRIM", 'SUBSTITUTE(," ","")', "LEFT"],
            answer: 1,
            explain:
              "TRIM은 앞뒤 공백 + 중간 연속 공백을 하나로. SUBSTITUTE는 단어 사이도 지운다.",
          },
        ],
      },
      {
        id: "fin-fn",
        title: "재무 함수",
        concepts: [
          "NPV, XNPV",
          "IRR, XIRR",
          "PMT, IPMT, PPMT",
          "PV, FV",
          "RATE, NPER",
          "부호 규칙 (유입=+, 유출=-)",
        ],
        exercises: [
          {
            q: "NPV와 XNPV의 차이는?",
            options: [
              "할인율 정확도",
              "NPV는 등간격, XNPV는 날짜 기반",
              "XNPV는 음수 처리",
              "차이 없음",
            ],
            answer: 1,
            explain:
              "NPV는 1기간 간격 가정. XNPV는 날짜 기반으로 불규칙 간격도 정확히 할인.",
          },
          {
            q: "=PMT(0.05/12, 360, -500000000)의 의미는?",
            options: [
              "5억, 연 5%, 30년 월 상환액",
              "5억의 5% 이자",
              "30년 후 미래가치",
              "월 5%로 적금",
            ],
            answer: 0,
            explain:
              "PMT(월이율, 기간수, 현재가치). 대출 스케줄링에서 핵심.",
          },
        ],
      },
    ],
  },
  {
    phase: 3,
    title: "재무 모델링 기초",
    weeks: "5–8주차",
    desc: "3-Statement Model + DCF",
    practiceFile: { name: "phase3-model-template.xlsx", href: "/learn/phase3-model-template.xlsx" },
    modules: [
      {
        id: "model-structure",
        title: "모델 설계 원칙",
        concepts: [
          "컬러 컨벤션: 입력=파랑, 수식=검정, 링크=초록",
          "하드코딩 금지",
          "시트 구조: Assumptions → IS → BS → CF → Valuation",
          "BS 밸런스 체크 행",
          "시나리오 스위치",
          "순환참조 해결",
        ],
        exercises: [
          {
            q: "성장률 15%를 =B5*1.15로 직접 쓰면 안 되는 이유는?",
            options: [
              "계산이 느림",
              "가정 변경 시 모든 셀을 수정해야 함",
              "에러 발생",
              "서식 깨짐",
            ],
            answer: 1,
            explain:
              "하드코딩은 감사 불가능 + 시나리오 변경 시 누락. Assumptions에서 참조해야.",
          },
          {
            q: "BS 밸런스 체크 행(자산-부채-자본=0)을 넣는 이유는?",
            options: [
              "보기 좋아서",
              "에러를 즉시 감지하기 위해",
              "엑셀 기능상 필수",
              "인쇄용",
            ],
            answer: 1,
            explain:
              "밸런스 안 맞으면 IS→BS→CF 연결 오류 신호. 역추적해서 버그 찾는다.",
          },
        ],
      },
      {
        id: "three-stmt",
        title: "3-Statement 연결",
        concepts: [
          "IS 구축",
          "BS 구축",
          "CF 간접법",
          "IS→BS: 순이익→이익잉여금",
          "BS→CF: 운전자본 변동, 감가상각",
          "CF→BS: 기말 현금",
          "순환참조: 이자비용↔차입금",
        ],
        exercises: [
          {
            q: "간접법 CF에서 감가상각비를 순이익에 더하는 이유는?",
            options: [
              "비용이 아님",
              "IS에서 차감됐지만 현금유출이 아니라서",
              "BS 밸런스 맞추기",
              "세금 절감",
            ],
            answer: 1,
            explain:
              "감가상각은 IS에서 빠졌지만 현금은 Capex 시점에 나감. CF에서 복원한다.",
          },
          {
            q: "매출채권 증가가 영업CF에 미치는 영향은?",
            options: [
              "CF 증가",
              "CF 감소",
              "영향 없음",
              "투자활동에 반영",
            ],
            answer: 1,
            explain:
              "매출채권↑ = 매출 인식됐지만 현금 미수취. CF에서 차감.",
          },
        ],
      },
      {
        id: "dcf-intro",
        title: "DCF 기초",
        concepts: [
          "FCF = 영업CF - Capex",
          "WACC",
          "Terminal Value",
          "EV → Equity Value",
          "감도분석 Data Table",
          "Football Field Chart",
        ],
        exercises: [
          {
            q: "TV가 기업가치의 60–80%를 차지한다. 이것이 의미하는 바는?",
            options: [
              "예측 기간 CF는 중요하지 않다",
              "TV 가정에 대한 감도분석이 필수다",
              "DCF는 신뢰할 수 없다",
              "예측 기간을 늘려야 한다",
            ],
            answer: 1,
            explain:
              "TV 비중이 크면 성장률/할인율의 작은 변화가 밸류에이션을 크게 흔든다.",
          },
          {
            q: "EV에서 Equity Value를 구하려면?",
            options: [
              "EV + 순차입금",
              "EV - 순차입금",
              "EV × 주식수",
              "EV / WACC",
            ],
            answer: 1,
            explain:
              "Equity = EV - Net Debt. EV는 채권자+주주 전체, 빚을 빼면 주주 몫.",
          },
        ],
      },
    ],
  },
];

const RESOURCES = [
  {
    phase: 1,
    links: [
      {
        name: "Excel Practice Online",
        url: "https://excel-practice-online.com/",
        note: "브라우저에서 바로 연습",
      },
      {
        name: "LogicExcel 95 Exercises",
        url: "https://logicexcel.com/practice/excel-exercises",
        note: "함수별 무료 연습문제",
      },
    ],
  },
  {
    phase: 2,
    links: [
      {
        name: "CFI Excel Fundamentals",
        url: "https://corporatefinanceinstitute.com/course/excel-fundamentals-formulas-for-finance/",
        note: "재무용 엑셀 기초 (무료)",
      },
    ],
  },
  {
    phase: 3,
    links: [
      {
        name: "Damodaran Corporate Finance",
        url: "https://www.youtube.com/playlist?list=PLUkh9m2BorqlJsEfix7R9jtSXClFZhGvC",
        note: "재무 개념 (YouTube, 무료)",
      },
      {
        name: "CFI 3-Statement Model",
        url: "https://corporatefinanceinstitute.com/course/3-statement-modeling/",
        note: "모델 구축 (무료)",
      },
      {
        name: "Macabacus Tutorials",
        url: "https://macabacus.com/learn",
        note: "IB 엑셀 컨벤션",
      },
    ],
  },
];

// ─── Helpers ───
function useLocalProgress() {
  // In production: lib/repos/learn.ts → Supabase learn_progress.
  // For now: React state (matches SPEC rule: no localStorage in artifacts).
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [correct, setCorrect] = useState<Record<string, boolean>>({});

  const answer = useCallback(
    (moduleId: string, exIdx: number, optIdx: number, correctIdx: number) => {
      const key = `${moduleId}-${exIdx}`;
      if (answers[key] !== undefined) return;
      setAnswers((prev) => ({ ...prev, [key]: optIdx }));
      if (optIdx === correctIdx) setCorrect((prev) => ({ ...prev, [key]: true }));
    },
    [answers],
  );

  const getModuleDone = (m: Module) =>
    m.exercises.filter((_, i) => answers[`${m.id}-${i}`] !== undefined).length;

  const getModuleCorrect = (m: Module) =>
    m.exercises.filter((_, i) => correct[`${m.id}-${i}`]).length;

  const totalDone = Object.keys(answers).length;
  const totalCorrect = Object.keys(correct).length;
  const totalQuestions = CURRICULUM.reduce(
    (s, p) => s + p.modules.reduce((s2, m) => s2 + m.exercises.length, 0),
    0,
  );

  const reset = () => {
    setAnswers({});
    setCorrect({});
  };

  return {
    answers,
    answer,
    getModuleDone,
    getModuleCorrect,
    totalDone,
    totalCorrect,
    totalQuestions,
    reset,
  };
}

// ─── Components ───
function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-line">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${pct}%`,
          backgroundColor: pct === 100 ? "var(--positive)" : "var(--accent)",
        }}
      />
    </div>
  );
}

function QuizCard({
  ex,
  answered,
  selected,
  onSelect,
}: {
  ex: Exercise;
  answered: boolean;
  selected: number | undefined;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="mb-4 text-sm font-semibold leading-relaxed text-text">
        {ex.q}
      </p>
      <div className="flex flex-col gap-2">
        {ex.options.map((opt, i) => {
          let cls =
            "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ";
          if (!answered) {
            cls +=
              "border-line bg-transparent text-text hover:border-accent cursor-pointer";
          } else if (i === ex.answer) {
            cls +=
              "border-positive bg-positive/10 text-positive";
          } else if (i === selected) {
            cls +=
              "border-negative bg-negative/10 text-negative";
          } else {
            cls += "border-line text-text-muted opacity-50";
          }
          return (
            <button
              key={i}
              onClick={() => !answered && onSelect(i)}
              disabled={answered}
              className={cls}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-3 rounded-lg bg-accent-soft p-3 text-xs leading-relaxed text-text-muted">
          {ex.explain}
        </div>
      )}
    </div>
  );
}

// ─── Main Widget ───
export function LearnDashboard() {
  const [activePhase, setActivePhase] = useState(0);
  const [activeModule, setActiveModule] = useState(0);
  const [tab, setTab] = useState<"concepts" | "quiz" | "resources">("concepts");
  const progress = useLocalProgress();

  const phase = CURRICULUM[activePhase];
  const mod = phase.modules[activeModule];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-accent" />
            <h1 className="text-xl font-bold text-text">
              Excel for Finance
            </h1>
          </div>
          <button
            onClick={progress.reset}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-muted hover:text-text cursor-pointer"
            title="진행률 초기화"
          >
            <RotateCcw size={12} />
            초기화
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1">
            <ProgressBar
              value={progress.totalDone}
              max={progress.totalQuestions}
            />
          </div>
          <span className="whitespace-nowrap text-xs tabular-nums text-text-muted font-mono">
            {progress.totalDone}/{progress.totalQuestions} · 정답{" "}
            {progress.totalCorrect}
          </span>
        </div>
      </div>

      {/* Phase cards */}
      <div className="grid grid-cols-3 gap-3">
        {CURRICULUM.map((p, i) => {
          const phaseDone = p.modules.reduce(
            (s, m) => s + progress.getModuleDone(m),
            0,
          );
          const phaseTotal = p.modules.reduce(
            (s, m) => s + m.exercises.length,
            0,
          );
          const active = activePhase === i;
          return (
            <button
              key={i}
              onClick={() => {
                setActivePhase(i);
                setActiveModule(0);
                setTab("concepts");
              }}
              className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${
                active
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface"
              }`}
            >
              <div className="text-[10px] text-text-muted">
                {p.weeks}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-text">
                {p.title}
              </div>
              <div className="mt-2">
                <ProgressBar value={phaseDone} max={phaseTotal} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Module tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {phase.modules.map((m, i) => {
          const done = progress.getModuleDone(m);
          const total = m.exercises.length;
          const active = activeModule === i;
          return (
            <button
              key={m.id}
              onClick={() => {
                setActiveModule(i);
                setTab("concepts");
              }}
              className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? "bg-surface text-text border border-line"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {m.title}
              {done > 0 && (
                <span
                  className="ml-1.5 tabular-nums font-mono"
                  style={{
                    color:
                      done === total ? "var(--positive)" : "var(--accent)",
                  }}
                >
                  {done}/{total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content tabs */}
      <div className="flex border-b border-line">
        {(
          [
            ["concepts", "개념"],
            ["quiz", "퀴즈"],
            ["resources", "리소스"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`cursor-pointer border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              tab === key
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Concepts */}
      {tab === "concepts" && (
        <div className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-base font-bold text-text">
            {mod.title}
          </h2>
          <p className="mt-1 text-xs text-text-muted">{phase.desc}</p>
          <div className="mt-4 space-y-0">
            {mod.concepts.map((c, i) => (
              <div
                key={i}
                className="flex gap-3 border-b border-line py-2.5 last:border-0"
              >
                <span className="w-5 shrink-0 text-right text-[10px] font-bold tabular-nums text-accent font-mono">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm leading-relaxed text-text">
                  {c}
                </span>
              </div>
            ))}
          </div>
          {phase.practiceFile && (
            <a
              href={phase.practiceFile.href}
              download
              className="mt-4 flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs text-text-muted hover:text-accent transition-colors"
            >
              <Download size={12} />
              {phase.practiceFile.name}
            </a>
          )}
          <button
            onClick={() => setTab("quiz")}
            className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            퀴즈 시작
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Quiz */}
      {tab === "quiz" && (
        <div className="space-y-4">
          {mod.exercises.map((ex, i) => (
            <QuizCard
              key={`${mod.id}-${i}`}
              ex={ex}
              answered={progress.answers[`${mod.id}-${i}`] !== undefined}
              selected={progress.answers[`${mod.id}-${i}`]}
              onSelect={(optIdx) =>
                progress.answer(mod.id, i, optIdx, ex.answer)
              }
            />
          ))}
          {progress.getModuleDone(mod) === mod.exercises.length && (
            <div className="rounded-xl border border-line bg-surface p-5 text-center">
              <div className="flex items-center justify-center gap-2">
                {progress.getModuleCorrect(mod) === mod.exercises.length ? (
                  <Trophy size={18} className="text-positive" />
                ) : (
                  <CheckCircle2
                    size={18}
                    className="text-accent"
                  />
                )}
                <span className="text-sm font-semibold text-text">
                  {progress.getModuleCorrect(mod)}/{mod.exercises.length} 정답
                </span>
              </div>
              {activeModule < phase.modules.length - 1 ? (
                <button
                  onClick={() => {
                    setActiveModule(activeModule + 1);
                    setTab("concepts");
                  }}
                  className="mt-3 cursor-pointer rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white"
                >
                  다음: {phase.modules[activeModule + 1].title}
                </button>
              ) : activePhase < CURRICULUM.length - 1 ? (
                <button
                  onClick={() => {
                    setActivePhase(activePhase + 1);
                    setActiveModule(0);
                    setTab("concepts");
                  }}
                  className="mt-3 cursor-pointer rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white"
                >
                  다음 Phase: {CURRICULUM[activePhase + 1].title}
                </button>
              ) : (
                <p className="mt-2 text-xs text-positive">
                  전체 커리큘럼 완료
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resources */}
      {tab === "resources" && (
        <div className="space-y-3">
          {RESOURCES.map((r) => (
            <div
              key={r.phase}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <div className="mb-3 text-xs font-bold text-accent">
                Phase {r.phase} · {CURRICULUM[r.phase - 1].title}
              </div>
              {r.links.map((l, i) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 border-t border-line py-2.5 first:border-0"
                >
                  <ExternalLink
                    size={12}
                    className="mt-0.5 shrink-0 text-accent"
                  />
                  <div>
                    <div className="text-sm font-medium text-text">
                      {l.name}
                    </div>
                    <div className="text-xs text-text-muted">
                      {l.note}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ))}
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-2 text-xs font-bold text-text">
              실전 프로젝트 (Phase 3 이후)
            </div>
            <p className="text-xs leading-relaxed text-text-muted">
              DART에서 LG생활건강 재무제표를 받아 3-Statement Model을 백지에서
              구축하고, DCF Valuation까지 연결한다. WCIG 프로젝트 연장선으로
              포트폴리오 겸용 가능.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
