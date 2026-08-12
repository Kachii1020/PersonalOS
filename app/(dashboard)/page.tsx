import { Suspense } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonLines } from "@/components/ui/skeleton";
import { MonthCalendar } from "@/components/widgets/month-calendar";
import { TodaySchedule } from "@/components/widgets/today-schedule";
import { WeekDeadlines } from "@/components/widgets/week-deadlines";
import { DailyBriefing } from "@/components/widgets/daily-briefing";
import { QuizSummary } from "@/components/widgets/quiz-summary";
import { MarketSnapshotWidget } from "@/components/widgets/market-snapshot";
import { GithubHeatmapWidget } from "@/components/widgets/github-heatmap";

export const metadata = { title: "대시보드 · Personal OS" };

const CALENDAR_SPAN = "lg:col-span-2 lg:row-span-2";
const FULL_SPAN = "lg:col-span-3";

/**
 * SPEC.md 6.1 배치.
 *
 * 데스크톱(≥1024px): 달력이 2열 2행을 차지하고 오른쪽에 오늘 일정·이번 주 마감이 쌓인다.
 * 그 아래 전폭 브리핑, 다시 그 아래 3분할.
 * 모바일: DOM 순서 그대로 세로 스택 — 스펙의 고정 순서와 같다.
 */
export default function DashboardPage() {
  return (
    <>
      <h1 className="sr-only">대시보드</h1>

      <div className="widget-grid grid gap-4 lg:grid-cols-3">
        <Suspense fallback={<WidgetSkeleton title="달력" glass lines={8} className={CALENDAR_SPAN} />}>
          <MonthCalendar className={CALENDAR_SPAN} />
        </Suspense>

        <Suspense fallback={<WidgetSkeleton title="오늘 일정" lines={4} />}>
          <TodaySchedule />
        </Suspense>

        <Suspense fallback={<WidgetSkeleton title="이번 주 마감" lines={4} />}>
          <WeekDeadlines />
        </Suspense>

        <Suspense fallback={<WidgetSkeleton title="오늘의 브리핑" glass lines={6} className={FULL_SPAN} />}>
          <DailyBriefing className={FULL_SPAN} />
        </Suspense>

        <Suspense fallback={<WidgetSkeleton title="오늘의 퀴즈" lines={3} />}>
          <QuizSummary />
        </Suspense>

        <Suspense fallback={<WidgetSkeleton title="지수·환율" lines={4} />}>
          <MarketSnapshotWidget />
        </Suspense>

        <Suspense fallback={<WidgetSkeleton title="GitHub 잔디" lines={4} />}>
          <GithubHeatmapWidget />
        </Suspense>
      </div>
    </>
  );
}

function WidgetSkeleton({
  title,
  glass,
  lines,
  className,
}: {
  title: string;
  glass?: boolean;
  lines: number;
  className?: string;
}) {
  return (
    <Card glass={glass} className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <SkeletonLines lines={lines} />
    </Card>
  );
}
