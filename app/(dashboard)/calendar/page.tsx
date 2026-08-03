import { Suspense } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonLines } from "@/components/ui/skeleton";
import { MonthCalendar } from "@/components/widgets/month-calendar";
import { TodaySchedule } from "@/components/widgets/today-schedule";
import { EventForm } from "@/components/widgets/event-form";
import { ymd } from "@/lib/time";

export const metadata = { title: "캘린더 · Personal OS" };

export default function CalendarPage() {
  const today = ymd(new Date());

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold text-text">캘린더</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense
          fallback={
            <Card glass className="lg:col-span-2 lg:row-span-2">
              <CardHeader>
                <CardTitle>달력</CardTitle>
              </CardHeader>
              <SkeletonLines lines={8} />
            </Card>
          }
        >
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
    </>
  );
}
