import { HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { QuizCard } from "@/components/widgets/quiz-card";
import { todaysQuiz, type QuizQuestion } from "@/lib/repos/quiz";

export const metadata = { title: "오늘의 퀴즈 · Personal OS" };

export default async function QuizPage() {
  let questions: QuizQuestion[];
  try {
    questions = await todaysQuiz();
  } catch {
    return (
      <>
        <h1 className="mb-4 text-xl font-semibold text-text">오늘의 퀴즈</h1>
        <Card>
          <ErrorState what="퀴즈를 불러오지 못했습니다" fix="설정에서 잡 로그를 확인하세요." />
        </Card>
      </>
    );
  }

  const reviewCount = questions.filter((q) => q.isReview).length;

  return (
    <>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold text-text">오늘의 퀴즈</h1>
        {questions.length > 0 && (
          <p className="text-xs text-text-muted">
            {questions.length}문제{reviewCount > 0 && ` · 복습 ${reviewCount}문제`}
          </p>
        )}
      </div>

      {questions.length === 0 ? (
        <Card>
          <EmptyState icon={HelpCircle} message="아직 생성된 문항이 없습니다. 퀴즈 잡이 하루 한 번 돌면 5문제가 여기에 올라옵니다." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {questions.map((question, i) => (
            <QuizCard key={question.id} index={i} question={question} />
          ))}
        </div>
      )}
    </>
  );
}
