"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { BookOpen, PenLine, BarChart3, ChevronRight, SkipForward } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/design/cn";
import { QuizCard } from "@/components/widgets/quiz-card";
import { DomainLessonCard } from "@/components/widgets/domain-lesson-card";
import { DOMAIN_SHORT } from "@/lib/ai/prompts/quiz";

type QuizQuestion = {
  id: string;
  domain: string;
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  conceptHint: string | null;
  difficulty: number;
  isReview: boolean;
};

type DomainLesson = {
  domain: string;
  title: string;
  content: string;
  keyTerms: string[];
};

type Props = {
  questions: QuizQuestion[];
  lessons: DomainLesson[];
  reviewCount: number;
};

const STEPS = [
  { label: "학습", icon: BookOpen },
  { label: "퀴즈", icon: PenLine },
  { label: "결과", icon: BarChart3 },
] as const;

/**
 * 학습 → 퀴즈 → 결과 3단계 흐름.
 * 학습 단계에서는 오늘 퀴즈 도메인의 레슨을 보여주고,
 * 퀴즈 단계에서는 기존 QuizCard 그리드,
 * 결과 단계에서는 성적 요약과 오답노트 링크를 보여준다.
 */
export function QuizFlow({ questions, lessons, reviewCount }: Props) {
  const [step, setStep] = useState(0);
  const [answered, setAnswered] = useState<Map<string, boolean>>(new Map());

  const handleAnswered = useCallback((questionId: string, isCorrect: boolean) => {
    setAnswered((prev) => new Map(prev).set(questionId, isCorrect));
  }, []);

  const allAnswered = answered.size >= questions.length;
  const correctCount = [...answered.values()].filter(Boolean).length;
  const wrongCount = answered.size - correctCount;

  // 오늘 퀴즈에 나오는 도메인의 레슨만 필터
  const todayDomains = new Set(questions.map((q) => q.domain));
  const relevantLessons = lessons.filter((l) => todayDomains.has(l.domain));

  return (
    <div>
      {/* 스텝 인디케이터 */}
      <nav className="mb-6 flex items-center justify-center gap-2" aria-label="퀴즈 진행 단계">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                if (i <= step || (i === 2 && allAnswered)) setStep(i);
              }}
              disabled={i > step && !(i === 2 && allAnswered)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                active && "bg-accent text-bg",
                done && "bg-accent/10 text-accent",
                !active && !done && "text-text-muted",
                "disabled:cursor-default",
              )}
            >
              <Icon className="size-3.5" />
              {s.label}
            </button>
          );
        })}
      </nav>

      {/* Step 0: 학습 */}
      {step === 0 && (
        <div className="space-y-4">
          {relevantLessons.length > 0 ? (
            <>
              <p className="text-sm text-text-muted">
                오늘 퀴즈 도메인의 핵심 개념을 먼저 읽어보세요.
              </p>
              {relevantLessons.map((lesson) => (
                <DomainLessonCard key={lesson.domain} lesson={lesson} defaultOpen={relevantLessons.length <= 2} />
              ))}
            </>
          ) : (
            <Card className="py-8 text-center">
              <p className="text-sm text-text-muted">오늘 세트에 해당하는 레슨이 없습니다. 퀴즈로 넘어가세요.</p>
            </Card>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={buttonClass({ className: "flex-1" })}
            >
              학습 완료, 퀴즈 시작
              <ChevronRight className="ml-1 size-4" />
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex cursor-pointer items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
            >
              <SkipForward className="size-3.5" />
              건너뛰기
            </button>
          </div>
        </div>
      )}

      {/* Step 1: 퀴즈 */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-text-muted">
              {questions.length}문제{reviewCount > 0 && ` · 복습 ${reviewCount}문제`}
            </p>
            <p className="num text-xs text-text-muted">
              {answered.size} / {questions.length}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {questions.map((question, i) => (
              <QuizCard
                key={question.id}
                index={i}
                question={question}
                onAnswered={handleAnswered}
              />
            ))}
          </div>

          {allAnswered && (
            <button
              type="button"
              onClick={() => setStep(2)}
              className={buttonClass({ className: "w-full" })}
            >
              결과 보기
              <ChevronRight className="ml-1 size-4" />
            </button>
          )}
        </div>
      )}

      {/* Step 2: 결과 */}
      {step === 2 && (
        <div className="space-y-4">
          <Card className="p-6 text-center">
            <p className="num text-4xl font-bold text-text">
              {correctCount}
              <span className="text-lg text-text-muted"> / {questions.length}</span>
            </p>
            <p className="mt-2 text-sm text-text-muted">
              {correctCount === questions.length
                ? "전부 맞혔습니다!"
                : wrongCount === 1
                  ? "1문제 틀렸습니다. 오답노트에서 복습하세요."
                  : `${wrongCount}문제 틀렸습니다. 오답노트에서 복습하세요.`}
            </p>

            {/* 도메인별 결과 */}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[...todayDomains].map((domain) => {
                const domainQs = questions.filter((q) => q.domain === domain);
                const domainCorrect = domainQs.filter((q) => answered.get(q.id) === true).length;
                const allCorrect = domainCorrect === domainQs.length;
                return (
                  <Badge key={domain} tone={allCorrect ? "positive" : "neutral"}>
                    {DOMAIN_SHORT[domain] ?? domain} {domainCorrect}/{domainQs.length}
                  </Badge>
                );
              })}
            </div>
          </Card>

          {wrongCount > 0 && (
            <Link href="/quiz/review" className={buttonClass({ className: "w-full" })}>
              오답노트 보기
            </Link>
          )}

          <button
            type="button"
            onClick={() => { setStep(0); setAnswered(new Map()); }}
            className="w-full cursor-pointer text-center text-xs text-text-muted transition-colors hover:text-text"
          >
            다시 풀기
          </button>
        </div>
      )}
    </div>
  );
}
