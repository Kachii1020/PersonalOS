import { HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { QuizFlow } from "@/components/widgets/quiz-flow";
import { todaysQuiz, allDomainLessons, type QuizQuestion, type DomainLesson } from "@/lib/repos/quiz";

export const metadata = { title: "오늘의 퀴즈 · Personal OS" };

export default async function QuizPage() {
  let questions: QuizQuestion[];
  let lessons: DomainLesson[];
  try {
    [questions, lessons] = await Promise.all([todaysQuiz(), allDomainLessons()]);
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
      <h1 className="mb-4 text-xl font-semibold text-text">오늘의 퀴즈</h1>

      {questions.length === 0 ? (
        <Card>
          <EmptyState icon={HelpCircle} message="아직 생성된 문항이 없습니다. 퀴즈 잡이 하루 한 번 돌면 5문제가 여기에 올라옵니다." />
        </Card>
      ) : (
        <QuizFlow questions={questions} lessons={lessons} reviewCount={reviewCount} />
      )}
    </>
  );
}
