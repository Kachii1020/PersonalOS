import { Suspense } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonLines } from "@/components/ui/skeleton";
import { MonthCalendar } from "@/components/widgets/month-calendar";
import { WeekCalendar } from "@/components/widgets/week-calendar";
import { TodaySchedule } from "@/components/widgets/today-schedule";
import { EventForm } from "@/components/widgets/event-form";
import { cn } from "@/lib/design/cn";
import { addDays, midnight, weekStartMonday, ymd } from "@/lib/time";

export const metadata = { title: "캘린더 · Personal OS" };

/** 월간 | 주간 탭 (2-A). 뷰는 URL로 남는다 — 새로고침해도 유지. */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string }>;
}) {
  const params = await searchParams;
  const isWeek = params.view === "week";
  const today = ymd(new Date());

  // ?week=YYYY-MM-DD (월요일). 값이 이상하면 이번 주로 떨어진다.
  const weekStart = resolveWeekStart(params.week);
  const prevWeek = ymd(addDays(weekStart, -7));
  const nextWeek = ymd(addDays(weekStart, 7));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text">캘린더</h1>
        <nav aria-label="캘린더 뷰" className="flex gap-1 rounded-lg bg-accent-soft p-1">
          <ViewTab href="/calendar" active={!isWeek}>
            월간
          </ViewTab>
          <ViewTab href="/calendar?view=week" active={isWeek}>
            주간
          </ViewTab>
        </nav>
      </div>

      {isWeek ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Link href={`/calendar?view=week&week=${prevWeek}`} className={tabLink()}>
              ← 이전 주
            </Link>
            <Link href="/calendar?view=week" className={tabLink()}>
              오늘
            </Link>
            <Link href={`/calendar?view=week&week=${nextWeek}`} className={tabLink()}>
              다음 주 →
            </Link>
          </div>
          <Suspense fallback={<CalendarSkeleton title="주간" />}>
            <WeekCalendar weekStart={weekStart} />
          </Suspense>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Suspense fallback={<CalendarSkeleton title="달력" className="lg:col-span-2 lg:row-span-2" />}>
            <MonthCalendar className="lg:col-span-2 lg:row-span-2" />
          </Suspense>

          <EventForm defaultDate={today} />

          <Suspense
            fallback={
              <Card>
                <CardHeader>
                  <CardTitle>오늘 일정</CardTitle>
                </CardHeader>
                <SkeletonLines lines={4} />
              </Card>
            }
          >
            <TodaySchedule />
          </Suspense>
        </div>
      )}
    </>
  );
}

function resolveWeekStart(week: string | undefined): Date {
  if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) {
    const parsed = midnight(week);
    if (!Number.isNaN(parsed.getTime())) return weekStartMonday(parsed);
  }
  return weekStartMonday(new Date());
}

function ViewTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-surface text-text" : "text-text-muted hover:text-text",
      )}
    >
      {children}
    </Link>
  );
}

function tabLink(): string {
  return "cursor-pointer rounded-lg px-2.5 py-1 text-xs text-text-muted transition-colors hover:bg-accent-soft hover:text-accent";
}

function CalendarSkeleton({ title, className }: { title: string; className?: string }) {
  return (
    <Card glass className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <SkeletonLines lines={8} />
    </Card>
  );
}
