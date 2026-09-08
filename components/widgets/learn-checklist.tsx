"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Code, Wrench } from "lucide-react";
import { QuizCard } from "@/components/widgets/learn-quiz-card";
import { parseTopic, type TopicKind } from "@/lib/learn/topic";
import type { LearnTrackTree } from "@/lib/repos/learn";
import type { Quiz } from "@/lib/learn/curriculum";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const KIND_ICON: Record<TopicKind, typeof BookOpen> = {
  concept: BookOpen,
  practice: Code,
  project: Wrench,
};

function kindClass(kind: TopicKind): string {
  if (kind === "practice") return "border-positive text-positive";
  if (kind === "project") return "border-accent bg-accent-soft text-accent";
  return "border-accent text-accent";
}

function kindLabel(kind: TopicKind): string {
  if (kind === "practice") return "실습";
  if (kind === "project") return "작품";
  return "개념";
}

function storageKey(trackSlug: string, moduleSlug: string): string {
  return `learn-topic-checks:${trackSlug}:${moduleSlug}`;
}

function readChecks(trackSlug: string, moduleSlug: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(trackSlug, moduleSlug));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

type Tab = "concepts" | "quiz";

type Props = {
  track: LearnTrackTree;
  dbQuizzes: Record<string, Quiz[]>;
  answers: Record<string, number>;
  correct: Record<string, boolean>;
  onAnswer: (moduleId: string, exIdx: number, optIdx: number, correctIdx: number) => void;
};

export function LearnChecklist({ track, dbQuizzes, answers, correct, onAnswer }: Props) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [moduleIdx, setModuleIdx] = useState(0);
  const [tab, setTab] = useState<Tab>("concepts");
  const [openTopic, setOpenTopic] = useState<number | null>(null);
  const [checks, setChecks] = useState<number[]>([]);

  const phase = track.phases[phaseIdx];
  const mod = phase?.modules[moduleIdx];
  const topics = useMemo(() => (mod?.concepts ?? []).map(parseTopic), [mod?.concepts]);
  const quizzes = mod ? (dbQuizzes[mod.slug] ?? []) : [];

  useEffect(() => {
    if (!mod) return;
    setChecks(readChecks(track.slug, mod.slug));
    setOpenTopic(null);
  }, [track.slug, mod]);

  const toggleCheck = (index: number) => {
    if (!mod) return;
    setChecks((prev) => {
      const next = prev.includes(index) ? prev.filter((n) => n !== index) : [...prev, index];
      window.localStorage.setItem(storageKey(track.slug, mod.slug), JSON.stringify(next));
      return next;
    });
  };

  if (!phase || !mod) {
    return (
      <p className="text-sm text-text-muted">첫 번째 토픽을 완료하면 진행률이 여기 표시됩니다</p>
    );
  }

  const done = quizzes.filter((_, i) => answers[`${mod.slug}-${i}`] !== undefined).length;
  const correctCount = quizzes.filter((_, i) => correct[`${mod.slug}-${i}`]).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text">{track.title}</h1>
        {track.description && (
          <p className="mt-1 text-xs text-text-muted">{track.description}</p>
        )}
        <p className="mt-3 text-xs tabular-nums text-text-muted font-mono">
          {checks.length === 0
            ? "첫 번째 토픽을 완료하면 진행률이 여기 표시됩니다"
            : `토픽 ${checks.length}/${topics.length}`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {track.phases.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setPhaseIdx(i);
              setModuleIdx(0);
              setTab("concepts");
            }}
            className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${FOCUS} ${
              phaseIdx === i ? "border-accent bg-accent-soft" : "border-line bg-surface"
            }`}
          >
            <div className="text-[10px] text-text-muted">{item.weeks_label}</div>
            <div className="mt-0.5 text-sm font-semibold text-text">{item.title}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {phase.modules.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setModuleIdx(i);
              setTab("concepts");
            }}
            className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${FOCUS} ${
              moduleIdx === i ? "bg-surface text-text border border-line" : "text-text-muted hover:text-text"
            }`}
          >
            {item.title}
          </button>
        ))}
      </div>

      <div className="flex border-b border-line">
        {(
          [
            ["concepts", "개념"],
            ["quiz", "퀴즈"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`cursor-pointer border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${FOCUS} ${
              tab === key ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "concepts" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-base font-bold text-text">{mod.title}</h2>
            {phase.description && (
              <p className="mt-1 text-xs text-text-muted">{phase.description}</p>
            )}
          </div>
          {topics.map((topic, i) => {
            const Icon = KIND_ICON[topic.kind];
            const open = openTopic === i;
            return (
              <article key={`${mod.slug}-${i}`} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checks.includes(i)}
                    onChange={() => toggleCheck(i)}
                    className={`mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--accent)] ${FOCUS}`}
                    aria-label={`${topic.title} 완료`}
                  />
                  <button
                    type="button"
                    onClick={() => setOpenTopic(open ? null : i)}
                    className={`min-w-0 flex-1 cursor-pointer text-left ${FOCUS}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold leading-relaxed text-text">{topic.title}</h3>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${kindClass(topic.kind)}`}
                      >
                        <Icon size={10} />
                        {kindLabel(topic.kind)}
                      </span>
                    </div>
                  </button>
                </div>
                {open && topic.resource && (
                  <p className="mt-3 pl-7 text-xs leading-relaxed text-text-muted">{topic.resource}</p>
                )}
              </article>
            );
          })}
          <button
            type="button"
            onClick={() => setTab("quiz")}
            className={`flex w-full cursor-pointer items-center justify-center rounded-xl bg-accent py-3 text-sm font-semibold text-white ${FOCUS}`}
          >
            이 모듈 퀴즈 풀기
          </button>
        </div>
      )}

      {tab === "quiz" && (
        <div className="space-y-4">
          {quizzes.length === 0 ? (
            <p className="text-sm text-text-muted">
              이 모듈 퀴즈는 아직 없습니다. 토픽 체크리스트부터 진행하세요.
            </p>
          ) : (
            quizzes.map((ex, i) => (
              <QuizCard
                key={`${mod.slug}-${i}`}
                ex={ex}
                answered={answers[`${mod.slug}-${i}`] !== undefined}
                selected={answers[`${mod.slug}-${i}`]}
                onSelect={(optIdx) => onAnswer(mod.slug, i, optIdx, ex.answer)}
              />
            ))
          )}
          {quizzes.length > 0 && done === quizzes.length && (
            <p className="text-sm font-semibold text-text">
              <span className="tabular-nums font-mono">
                {correctCount}/{quizzes.length}
              </span>{" "}
              정답
            </p>
          )}
        </div>
      )}
    </div>
  );
}
