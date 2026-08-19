import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { buttonClass } from "@/components/ui/button";
import { InteractiveCalendar } from "@/components/widgets/interactive-calendar";
import { listEventsWithWritableFlag } from "@/lib/repos/events";
import { addDays, monthRange, weekday, ymd } from "@/lib/time";

/**
 * 이번 달 달력. 대시보드의 주 시선이라 글래스를 쓰는 두 위젯 중 하나다
 * (SPEC.md 6.4 규칙 1).
 *
 * 반복 일정은 listEventsWithWritableFlag가 표시 범위만 전개한다.
 * 서버에서 데이터를 가져오고, 날짜 선택·상세·삭제는 InteractiveCalendar(클라이언트)가 맡는다.
 */
export async function MonthCalendar({ className }: { className?: string }) {
  const now = new Date();
  const { start, end, year, month } = monthRange(now);

  let events: Awaited<ReturnType<typeof listEventsWithWritableFlag>>;
  try {
    events = await listEventsWithWritableFlag(start.toISOString(), end.toISOString());
  } catch (e) {
    return (
      <Card glass className={className}>
        <Header year={year} month={month} />
        <ErrorState
          what="캘린더를 불러오지 못했습니다"
          fix="설정에서 iCloud 동기화 상태를 확인하세요."
          action={
            <Link href="/settings" className={buttonClass({ size: "sm" })}>
              설정 열기
            </Link>
          }
        />
        <p className="sr-only">{e instanceof Error ? e.message : String(e)}</p>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card glass className={className}>
        <Header year={year} month={month} />
        <EmptyState
          icon={CalendarDays}
          message="이번 달 일정이 없습니다. iCloud 캘린더를 동기화하면 여기에 표시됩니다."
          action={
            <Link href="/settings" className={buttonClass({ size: "sm" })}>
              동기화 상태 보기
            </Link>
          }
        />
      </Card>
    );
  }

  const byDay = new Map<string, typeof events>();
  for (const event of events) {
    const key = ymd(new Date(event.startsAt));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(event);
    else byDay.set(key, [event]);
  }

  // 달력 격자는 그 달 1일이 속한 주의 일요일부터 시작한다.
  const gridStart = addDays(start, -weekday(start));
  const todayKey = ymd(now);
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = addDays(gridStart, i);
    const key = ymd(day);
    const dayEvents = byDay.get(key) ?? [];
    return {
      key,
      day: Number(key.slice(8)),
      inMonth: key.startsWith(monthPrefix),
      isToday: key === todayKey,
      events: dayEvents.map((e) => ({
        id: e.id,
        summary: e.summary,
        description: e.description,
        location: e.location,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        isAllDay: e.isAllDay,
        source: e.source,
        isDeletable: e.isDeletable,
      })),
    };
  });

  return <InteractiveCalendar year={year} month={month} cells={cells} totalEvents={events.length} className={className} />;
}

function Header({ year, month, count }: { year: number; month: number; count?: number }) {
  return (
    <CardHeader>
      <CardTitle>
        {year}년 {month}월
      </CardTitle>
      {count !== undefined && <CardHint>일정 {count}건</CardHint>}
    </CardHeader>
  );
}
