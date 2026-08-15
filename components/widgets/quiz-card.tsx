"use client";

import { useActionState } from "react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/design/cn";
import { submitAnswer, type AnswerResult } from "@/app/(dashboard)/quiz/actions";

const DOMAIN_LABEL: Record<string, string> = {
  ib: "투자은행",
  accounting: "회계",
  macro: "거시경제",
  ai_ml: "머신러닝",
  system_design: "시스템 설계",
  japanese: "일본어",
  devops: "DevOps",
  ai_engineering: "AI 엔지니어링",
};

type Props = {
  index: number;
  question: {
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
  /** 퀴즈 흐름에서 완료 추적용. */
  onAnswered?: (questionId: string, isCorrect: boolean) => void;
};

/**
 * 문항 하나. 답을 고르면 서버가 채점하고 해설을 연다.
 * answerIndex는 채점 뒤에만 쓴다 — 고르기 전에는 화면에 드러나지 않는다.
 */
export function QuizCard({ index, question, onAnswered }: Props) {
  const [result, action, pending] = useActionState<AnswerResult, FormData>(async (prev, formData) => {
    const res = await submitAnswer(prev, formData);
    if (res && onAnswered) onAnswered(res.questionId, res.isCorrect);
    return res;
  }, null);
  const answered = result !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="num mr-2 text-text-muted">{index + 1}.</span>
          {DOMAIN_LABEL[question.domain] ?? question.domain}
        </CardTitle>
        <span className="flex items-center gap-2">
          {question.isReview && <Badge tone="accent">복습</Badge>}
          <CardHint>난이도 {question.difficulty}</CardHint>
        </span>
      </CardHeader>

      <p className="mb-3 text-sm text-text">{question.question}</p>

      {question.conceptHint && !answered && (
        <details className="mb-3">
          <summary className="cursor-pointer text-xs font-medium text-accent transition-colors hover:text-accent/80">
            힌트 보기
          </summary>
          <p className="mt-1 rounded-lg bg-accent-soft/50 px-3 py-2 text-sm text-text-muted">
            {question.conceptHint}
          </p>
        </details>
      )}

      <form action={action} className="space-y-2">
        <input type="hidden" name="questionId" value={question.id} />
        {question.choices.map((choice, i) => {
          const isAnswer = answered && i === question.answerIndex;
          const isWrongPick = answered && i === result.chosenIndex && !result.isCorrect;
          return (
            <button
              key={i}
              type="submit"
              name="chosenIndex"
              value={i}
              disabled={answered || pending}
              className={cn(
                "flex w-full cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                "disabled:cursor-default",
                isAnswer && "border-positive text-positive",
                isWrongPick && "border-negative text-negative",
                !isAnswer && !isWrongPick && "border-line text-text hover:bg-accent-soft",
              )}
            >
              <span className="num shrink-0 text-text-muted">{i + 1}</span>
              <span>{choice}</span>
            </button>
          );
        })}
      </form>

      {answered && (
        <div className="mt-3 space-y-1" role="status">
          <p className={result.isCorrect ? "text-sm font-medium text-positive" : "text-sm font-medium text-negative"}>
            {result.isCorrect ? "정답입니다" : "오답입니다. 1·3·7일 뒤 복습 큐에 들어갑니다."}
          </p>
          <p className="text-sm text-text-muted">{question.explanation}</p>
        </div>
      )}
    </Card>
  );
}
