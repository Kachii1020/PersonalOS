import Link from "next/link";
import { BookOpen, ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { WrongAnswerCard } from "@/components/widgets/wrong-answer-card";
import { wrongAnswersByDomain, type WrongAnswer } from "@/lib/repos/quiz";
import type { QuizDomain } from "@/lib/ai/prompts/quiz";

export const metadata = { title: "오답노트 · Personal OS" };

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

export default async function ReviewPage() {
  let groups: Partial<Record<QuizDomain, WrongAnswer[]>>;
  try {
    groups = await wrongAnswersByDomain();
  } catch (e) {
    console.error(e);
    return (
      <>
        <Header />
        <Card>
          <ErrorState what="오답 데이터를 불러오지 못했습니다" fix="잠시 후 새로고침하세요." />
        </Card>
      </>
    );
  }

  const domains = Object.keys(groups) as QuizDomain[];
  const totalWrong = domains.reduce((sum, d) => sum + (groups[d]?.length ?? 0), 0);

  return (
    <>
      <Header count={totalWrong} />

      {domains.length === 0 ? (
        <Card>
          <EmptyState icon={BookOpen} message="틀린 문제가 없습니다. 모든 문제를 맞혔어요!" />
        </Card>
      ) : (
        <div className="space-y-6">
          {domains.map((domain) => {
            const entries = groups[domain]!;
            return (
              <section key={domain}>
                <h2 className="mb-3 text-sm font-medium text-text-muted">
                  {DOMAIN_LABEL[domain] ?? domain}
                  <span className="ml-1 text-xs">({entries.length}문제)</span>
                </h2>
                <div className="grid gap-4 lg:grid-cols-2">
                  {entries.map((entry) => (
                    <WrongAnswerCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function Header({ count }: { count?: number }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <Link
        href="/quiz"
        className="flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text"
      >
        <ChevronLeft className="size-4" />
        퀴즈
      </Link>
      <h1 className="text-xl font-semibold text-text">오답노트</h1>
      {count != null && count > 0 && (
        <span className="text-xs text-text-muted">{count}문제</span>
      )}
    </div>
  );
}
