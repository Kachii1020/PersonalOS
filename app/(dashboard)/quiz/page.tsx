import { HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { QuizFlow } from "@/components/widgets/quiz-flow";
import { QuizTrack } from "@/components/widgets/quiz-track";
import { SeedIbEngButton } from "@/components/widgets/seed-ib-eng-button";
import { QUIZ_DOMAINS, type QuizDomain } from "@/lib/ai/prompts/quiz";
import {
  allDomainLessons,
  ibEngProgress,
  todaysQuiz,
  type DomainLesson,
  type DomainProgress,
  type QuizQuestion,
} from "@/lib/repos/quiz";

export const metadata = { title: "IB Engineering · Personal OS" };

function parseTopic(raw?: string): QuizDomain | undefined {
  if (!raw) return undefined;
  return QUIZ_DOMAINS.includes(raw as QuizDomain) ? (raw as QuizDomain) : undefined;
}

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const topic = parseTopic((await searchParams).topic);

  let questions: QuizQuestion[];
  let lessons: DomainLesson[];
  let progress: DomainProgress[];
  try {
    [questions, lessons, progress] = await Promise.all([
      todaysQuiz(5, new Date(), topic),
      allDomainLessons(),
      ibEngProgress(),
    ]);
  } catch (e) {
    console.error(e);
    return (
      <>
        <h1 className="mb-4 text-xl font-semibold text-text">IB Engineering</h1>
        <Card>
          <ErrorState what="퀴즈를 불러오지 못했습니다" fix="설정에서 잡 로그를 확인하세요." />
        </Card>
      </>
    );
  }

  const reviewCount = questions.filter((q) => q.isReview).length;
  const todayLessons = topic ? lessons.filter((row) => row.domain === topic) : lessons;

  return (
    <>
      <QuizTrack progress={progress} activeDomain={topic} />

      {questions.length === 0 ? (
        <Card>
          <EmptyState
            icon={HelpCircle}
            message="90문항을 넣으면 오늘 5문제가 열립니다. SQL 시드를 써도 같은 은행입니다."
            action={<SeedIbEngButton />}
          />
        </Card>
      ) : (
        <QuizFlow questions={questions} lessons={todayLessons} reviewCount={reviewCount} />
      )}
    </>
  );
}
