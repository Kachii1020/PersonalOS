// components/widgets/LearnDashboard.tsx
"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useTransition } from "react";
import {
  BookOpen,
  CheckCircle2,
  Trophy,
  ArrowRight,
  RotateCcw,
  ExternalLink,
  Download,
} from "lucide-react";
import { submitLearnAnswer, submitLabCompletion } from "@/app/(dashboard)/learn/actions";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CURRICULUM,
  RESOURCES,
  type Concept,
  type Module,
  type Quiz,
} from "@/lib/learn/curriculum";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
import { getExercisesForModule } from "@/lib/spreadsheet/exercises";

const LabExercise = dynamic(
  () => import("@/components/widgets/lab-exercise").then((m) => m.LabExercise),
  { ssr: false, loading: () => <Skeleton className="h-64 rounded-xl" /> },
);


// ─── Props ───
export type LearnDashboardProps = {
  /** module_slug → quiz_questions.id[] (concept_hint 순) */
  questionIdMap?: Record<string, string[]>;
  /** question_id → 기존 응시 결과 */
  existingAttempts?: Record<string, { chosenIndex: number; isCorrect: boolean }>;
  /** 완료된 lab exercise_id 목록 */
  labCompletions?: string[];
};

type ContentTab = "concepts" | "lab" | "quiz" | "resources";

// ─── Helpers ───
function useProgress(
  questionIdMap: Record<string, string[]>,
  existingAttempts: Record<string, { chosenIndex: number; isCorrect: boolean }>,
) {
  // 기존 응시 기록에서 초기 상태 복원
  const initialAnswers: Record<string, number> = {};
  const initialCorrect: Record<string, boolean> = {};
  for (const [moduleSlug, qIds] of Object.entries(questionIdMap)) {
    qIds.forEach((qId, idx) => {
      const attempt = existingAttempts[qId];
      if (attempt) {
        const key = `${moduleSlug}-${idx}`;
        initialAnswers[key] = attempt.chosenIndex;
        if (attempt.isCorrect) initialCorrect[key] = true;
      }
    });
  }

  const [answers, setAnswers] = useState<Record<string, number>>(initialAnswers);
  const [correct, setCorrect] = useState<Record<string, boolean>>(initialCorrect);
  const [, startTransition] = useTransition();

  const answer = useCallback(
    (moduleId: string, exIdx: number, optIdx: number, correctIdx: number) => {
      const key = `${moduleId}-${exIdx}`;
      if (answers[key] !== undefined) return;

      // 낙관적 UI 업데이트
      setAnswers((prev) => ({ ...prev, [key]: optIdx }));
      if (optIdx === correctIdx) setCorrect((prev) => ({ ...prev, [key]: true }));

      // 서버 기록 (quiz_attempts + quiz_review_queue + learn_progress)
      const questionId = questionIdMap[moduleId]?.[exIdx];
      if (questionId) {
        startTransition(() => {
          void submitLearnAnswer(questionId, optIdx, moduleId);
        });
      }
    },
    [answers, questionIdMap],
  );

  const getModuleDone = (m: Module) =>
    m.quizzes.filter((_, i) => answers[`${m.id}-${i}`] !== undefined).length;

  const getModuleCorrect = (m: Module) =>
    m.quizzes.filter((_, i) => correct[`${m.id}-${i}`]).length;

  const totalDone = Object.keys(answers).length;
  const totalCorrect = Object.keys(correct).length;
  const totalQuestions = CURRICULUM.reduce(
    (s, p) => s + p.modules.reduce((s2, m) => s2 + m.quizzes.length, 0),
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

function ConceptCard({
  concept,
  index,
  onOpenLab,
  onOpenQuiz,
}: {
  concept: Concept;
  index: number;
  onOpenLab: () => void;
  onOpenQuiz: () => void;
}) {
  const grid = concept.kind === "grid";
  return (
    <article className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="w-5 shrink-0 text-right text-[10px] font-bold tabular-nums text-accent font-mono">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-sm font-semibold leading-relaxed text-text">
            {concept.title}
          </h3>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            grid
              ? "border-accent bg-accent-soft text-accent"
              : "border-line bg-surface text-text-muted"
          }`}
        >
          {grid ? "실습" : "엑셀"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-text">{concept.why}</p>
      {concept.syntax && (
        <p className="mt-2 font-mono text-xs leading-relaxed text-text-muted">
          {concept.syntax}
        </p>
      )}
      <dl className="mt-3 space-y-2 text-xs leading-relaxed">
        <div>
          <dt className="font-semibold text-text-muted">함정</dt>
          <dd className="mt-0.5 text-text">{concept.trap}</dd>
        </div>
        <div>
          <dt className="font-semibold text-text-muted">IB</dt>
          <dd className="mt-0.5 text-text">{concept.ib}</dd>
        </div>
      </dl>
      {grid ? (
        <button
          type="button"
          onClick={onOpenLab}
          className={`mt-4 cursor-pointer text-xs font-semibold text-accent ${FOCUS}`}
        >
          실습으로
        </button>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-text-muted">
            엑셀에서 연습한다. 퀴즈로 확인한다.
          </p>
          <button
            type="button"
            onClick={onOpenQuiz}
            className={`cursor-pointer text-xs font-semibold text-accent ${FOCUS}`}
          >
            퀴즈로
          </button>
        </div>
      )}
    </article>
  );
}

function QuizCard({
  ex,
  answered,
  selected,
  onSelect,
}: {
  ex: Quiz;
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
              `border-line bg-transparent text-text hover:border-accent cursor-pointer ${FOCUS}`;
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
export function LearnDashboard({
  questionIdMap = {},
  existingAttempts = {},
  labCompletions = [],
}: LearnDashboardProps) {
  const [activePhase, setActivePhase] = useState(0);
  const [activeModule, setActiveModule] = useState(0);
  const [tab, setTab] = useState<ContentTab>("concepts");
  const [completedLabs, setCompletedLabs] = useState(labCompletions);
  const progress = useProgress(questionIdMap, existingAttempts);

  const phase = CURRICULUM[activePhase];
  const mod = phase.modules[activeModule];

  const handleLabCompleted = useCallback(
    async (exerciseId: string) => {
      const result = await submitLabCompletion(exerciseId, mod.id);
      if (result.ok) {
        setCompletedLabs((prev) => (prev.includes(exerciseId) ? prev : [...prev, exerciseId]));
      }
      return result;
    },
    [mod.id],
  );

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
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-muted hover:text-text cursor-pointer ${FOCUS}`}
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
            (s, m) => s + m.quizzes.length,
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
              className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${FOCUS} ${
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
          const total = m.quizzes.length;
          const moduleLabs = getExercisesForModule(m.id);
          const moduleLabTotal = moduleLabs.length;
          const moduleLabDone = moduleLabs.filter((ex) =>
            completedLabs.includes(ex.id),
          ).length;
          const active = activeModule === i;
          return (
            <button
              key={m.id}
              onClick={() => {
                setActiveModule(i);
                setTab("concepts");
              }}
              className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${FOCUS} ${
                active
                  ? "bg-surface text-text border border-line"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {m.title}
              {(done > 0 || moduleLabDone > 0) && (
                <span
                  className="ml-1.5 tabular-nums font-mono"
                  style={{
                    color:
                      done === total && moduleLabDone === moduleLabTotal
                        ? "var(--positive)"
                        : "var(--accent)",
                  }}
                >
                  {done}/{total}
                  {moduleLabTotal > 0 && ` · 실습 ${moduleLabDone}/${moduleLabTotal}`}
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
            ["lab", "실습"],
            ["quiz", "퀴즈"],
            ["resources", "리소스"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`cursor-pointer border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${FOCUS} ${
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
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-base font-bold text-text">
              {mod.title}
            </h2>
            <p className="mt-1 text-xs text-text-muted">{phase.desc}</p>
            {phase.practiceFile && (
              <a
                href={phase.practiceFile.href}
                download
                className={`mt-4 flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs text-text-muted hover:text-accent transition-colors ${FOCUS}`}
              >
                <Download size={12} />
                {phase.practiceFile.name}
              </a>
            )}
          </div>
          {mod.concepts.map((c, i) => (
            <ConceptCard
              key={c.id}
              concept={c}
              index={i}
              onOpenLab={() => setTab("lab")}
              onOpenQuiz={() => setTab("quiz")}
            />
          ))}
          <button
            onClick={() => setTab("lab")}
            className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 ${FOCUS}`}
          >
            실습 시작
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Lab */}
      {tab === "lab" && (
        <LabExercise
          key={mod.id}
          moduleSlug={mod.id}
          completedIds={completedLabs}
          onCompleted={handleLabCompleted}
          onGoToQuiz={() => setTab("quiz")}
        />
      )}

      {/* Quiz */}
      {tab === "quiz" && (
        <div className="space-y-4">
          {mod.quizzes.map((ex, i) => (
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
          {progress.getModuleDone(mod) === mod.quizzes.length && (
            <div className="rounded-xl border border-line bg-surface p-5 text-center">
              <div className="flex items-center justify-center gap-2">
                {progress.getModuleCorrect(mod) === mod.quizzes.length ? (
                  <Trophy size={18} className="text-positive" />
                ) : (
                  <CheckCircle2
                    size={18}
                    className="text-accent"
                  />
                )}
                <span className="text-sm font-semibold text-text">
                  {progress.getModuleCorrect(mod)}/{mod.quizzes.length} 정답
                </span>
              </div>
              {activeModule < phase.modules.length - 1 ? (
                <button
                  onClick={() => {
                    setActiveModule(activeModule + 1);
                    setTab("concepts");
                  }}
                  className={`mt-3 cursor-pointer rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white ${FOCUS}`}
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
                  className={`mt-3 cursor-pointer rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white ${FOCUS}`}
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
                  className={`flex cursor-pointer items-start gap-2 border-t border-line py-2.5 first:border-0 ${FOCUS}`}
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
