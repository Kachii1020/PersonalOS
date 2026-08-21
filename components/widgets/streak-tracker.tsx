import Link from "next/link";
import { BrainCircuit, GitGraph, Newspaper, type LucideIcon } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { getStreaks } from "@/lib/repos/streaks";

/**
 * 연속 일수 3개 (1-A). 대시보드 하단 전폭 — SPEC 6.1 기존 그리드는 건드리지 않는다.
 * 글래스 아님 (6.4 규칙 1).
 */
export async function StreakTracker({ className }: { className?: string }) {
  let streaks: Awaited<ReturnType<typeof getStreaks>>;
  try {
    streaks = await getStreaks();
  } catch (e) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>스트릭</CardTitle>
        </CardHeader>
        <ErrorState what="연속 기록을 계산하지 못했습니다" fix={e instanceof Error ? e.message : "잠시 후 새로고침하세요."} />
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>스트릭</CardTitle>
        <CardHint>연속 일수</CardHint>
      </CardHeader>
      <div className="grid grid-cols-3 gap-3">
        <StreakCell icon={BrainCircuit} label="퀴즈" days={streaks.quiz} zeroHint="오늘 퀴즈를 풀어보세요" href="/quiz" />
        <StreakCell icon={Newspaper} label="브리핑" days={streaks.briefing} zeroHint="브리핑은 매일 아침 생성됩니다" href="/briefing" />
        <StreakCell icon={GitGraph} label="커밋" days={streaks.commits} zeroHint="오늘 커밋 하나를 남겨보세요" href="/portfolio" />
      </div>
    </Card>
  );
}

function StreakCell({
  icon: Icon,
  label,
  days,
  zeroHint,
  href,
}: {
  icon: LucideIcon;
  label: string;
  days: number;
  zeroHint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-line px-2 py-3 transition-colors hover:bg-accent-soft"
    >
      <Icon aria-hidden className="size-5 text-text-muted transition-colors group-hover:text-accent" />
      <span className="text-xs text-text-muted">{label}</span>
      {days > 0 ? (
        <span className="num text-xl font-semibold text-text">
          {days}
          <span className="ml-0.5 text-xs font-normal text-text-muted">일</span>
        </span>
      ) : (
        <span className="text-center text-xs text-text-muted">{zeroHint}</span>
      )}
    </Link>
  );
}
