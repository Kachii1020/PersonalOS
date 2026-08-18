import { NotebookText } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { latestWeeklyReview } from "@/lib/repos/weekly-reviews";

/** /briefing 하단. 글래스 없음 (SPEC.md 6.1 / 6.4 규칙 1). 숫자는 SQL 집계만 표시. */
export async function WeeklyReview({ className }: { className?: string }) {
  let review: Awaited<ReturnType<typeof latestWeeklyReview>>;
  try {
    review = await latestWeeklyReview();
  } catch (e) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>주간 리뷰</CardTitle>
        </CardHeader>
        <ErrorState
          what="주간 리뷰를 불러오지 못했습니다"
          fix={e instanceof Error ? e.message : "잠시 후 새로고침하세요."}
        />
      </Card>
    );
  }

  if (!review?.content) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>주간 리뷰</CardTitle>
        </CardHeader>
        <EmptyState
          icon={NotebookText}
          message="일요일 밤 주간 리뷰가 생성되면 여기에 표시됩니다. 설정에서 크론이 도는지 확인하세요."
        />
      </Card>
    );
  }

  const { stats, narrative } = review.content;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>주간 리뷰</CardTitle>
        <CardHint>
          {stats.weekStart} – {stats.weekEnd}
        </CardHint>
      </CardHeader>
      <p className="text-sm font-medium text-text">{narrative.headline}</p>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <Stat label="퀴즈 정답률" value={stats.quiz.accuracyPct === null ? "—" : `${stats.quiz.accuracyPct}%`} />
        <Stat label="완료 태스크" value={String(stats.tasks.completed)} />
        <Stat label="커밋" value={String(stats.commits.total)} />
      </dl>
      <div className="mt-3 space-y-2">
        {narrative.paragraphs.map((p) => (
          <p key={p.slice(0, 24)} className="text-sm text-text">
            {p}
          </p>
        ))}
      </div>
      {narrative.next_week_focus && (
        <p className="mt-3 text-sm text-text-muted">다음 주: {narrative.next_week_focus}</p>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="num text-right text-text">{value}</dd>
    </div>
  );
}
