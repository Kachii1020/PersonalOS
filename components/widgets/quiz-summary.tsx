import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { buttonClass } from "@/components/ui/button";
import { todaysQuizProgress, wrongAnswerCount, type QuizProgress } from "@/lib/repos/quiz";

/** 대시보드의 '오늘의 퀴즈' 칸 (SPEC.md 6.1). 문제 풀이는 /quiz에서 한다. */
export async function QuizSummary({ className }: { className?: string }) {
  let progress: QuizProgress;
  let wrongCount = 0;
  try {
    [progress, wrongCount] = await Promise.all([todaysQuizProgress(), wrongAnswerCount()]);
  } catch {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>오늘의 퀴즈</CardTitle>
        </CardHeader>
        <ErrorState what="퀴즈를 불러오지 못했습니다" fix="설정에서 잡 로그를 확인하세요." />
      </Card>
    );
  }

  if (progress.total === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>오늘의 퀴즈</CardTitle>
        </CardHeader>
        <EmptyState icon={HelpCircle} message="아직 생성된 문항이 없습니다. 퀴즈 잡이 하루 한 번 돌면 5문제가 올라옵니다." />
      </Card>
    );
  }

  const done = progress.answered >= progress.total;
  const percent = Math.round((progress.answered / progress.total) * 100);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>오늘의 퀴즈</CardTitle>
        {progress.review > 0 && <CardHint>복습 {progress.review}문제</CardHint>}
      </CardHeader>

      <p className="num mb-2 text-xl text-text">
        {progress.answered}
        <span className="text-sm text-text-muted"> / {progress.total}문제</span>
      </p>

      <div
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="오늘의 퀴즈 진행률"
        className="h-2 w-full overflow-hidden rounded-full bg-accent-soft"
      >
        <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
      </div>

      <p className="mt-2 text-xs text-text-muted">
        {progress.answered === 0
          ? "아직 풀지 않았습니다"
          : done
            ? `${progress.total}문제 중 ${progress.correct}문제 정답`
            : `푼 ${progress.answered}문제 중 ${progress.correct}문제 정답`}
      </p>

      <Link href="/quiz" className={buttonClass({ className: "mt-3 w-full" })}>
        {done ? "다시 보기" : progress.answered === 0 ? "학습 시작" : "퀴즈 풀기"}
      </Link>

      {wrongCount > 0 && (
        <Link
          href="/quiz/review"
          className="mt-2 block text-center text-xs text-text-muted transition-colors hover:text-accent"
        >
          오답노트 {wrongCount}문제
        </Link>
      )}
    </Card>
  );
}
