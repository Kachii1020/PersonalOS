import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { buttonClass } from "@/components/ui/button";
import { NowLine } from "@/components/widgets/now-line";
import { listEventsBetween, type EventRow } from "@/lib/repos/events";
import { cn } from "@/lib/design/cn";
import { addDays, hhmm, monthDayWeekday, ymd } from "@/lib/time";

/**
 * 주간 타임라인 (2-A). 07:00–22:00, 시간당 60px.
 * 반복 일정은 listEventsBetween이 이미 전개한다.
 * 모바일은 가로 스크롤 스냅으로 하루씩 넘긴다 — 별도 1일 뷰를 만들지 않는다.
 */
const START_HOUR = 7;
const END_HOUR = 22;
const PX_PER_HOUR = 60;
const COLUMN_HEIGHT = (END_HOUR - START_HOUR) * PX_PER_HOUR;

export async function WeekCalendar({ weekStart, className }: { weekStart: Date; className?: string }) {
  const weekEnd = addDays(weekStart, 7);

  let events: EventRow[];
  try {
    events = await listEventsBetween(weekStart.toISOString(), weekEnd.toISOString());
  } catch (e) {
    return (
      <Card glass className={className}>
        <CardHeader>
          <CardTitle>주간</CardTitle>
        </CardHeader>
        <ErrorState
          what="주간 일정을 불러오지 못했습니다"
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

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const key = ymd(date);
    return {
      key,
      label: monthDayWeekday(date.toISOString()),
      allDay: events.filter((e) => e.isAllDay && ymd(new Date(e.startsAt)) === key),
      timed: events.filter((e) => !e.isAllDay && ymd(new Date(e.startsAt)) === key),
    };
  });

  const todayKey = ymd(new Date());
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <Card glass className={className}>
      <CardHeader>
        <CardTitle>
          {monthDayWeekday(weekStart.toISOString())} – {monthDayWeekday(addDays(weekStart, 6).toISOString())}
        </CardTitle>
        <CardHint>일정 {events.length}건</CardHint>
      </CardHeader>

      {events.length === 0 && (
        <p className="mb-3 flex items-center gap-2 text-sm text-text-muted">
          <CalendarDays aria-hidden className="size-4" />
          이번 주 일정이 없습니다. 동기화되면 여기에 표시됩니다.
        </p>
      )}

      {/* 모바일: 하루 폭 80vw + 스냅 스크롤. 데스크톱: 7열. */}
      <div className="flex snap-x snap-mandatory overflow-x-auto">
        <div className="sticky left-0 z-20 w-10 shrink-0 bg-transparent">
          <div className="h-12" />
          <div className="relative" style={{ height: COLUMN_HEIGHT }}>
            {hours.map((h) => (
              <span
                key={h}
                className="num absolute right-1.5 -translate-y-1/2 text-[10px] text-text-muted"
                style={{ top: (h - START_HOUR) * PX_PER_HOUR }}
              >
                {String(h).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>

        {days.map((day) => (
          <div
            key={day.key}
            className="min-w-[76vw] flex-1 snap-start border-l border-line sm:min-w-[40vw] lg:min-w-0"
          >
            <div className="flex h-12 flex-col items-center justify-center gap-0.5 px-1">
              <span className={cn("text-xs", day.key === todayKey ? "font-semibold text-accent" : "text-text-muted")}>
                {day.label}
              </span>
              {day.allDay.length > 0 && (
                <span className="max-w-full truncate rounded bg-accent-soft px-1.5 text-[10px] text-text">
                  {day.allDay.map((e) => e.summary).join(" · ")}
                </span>
              )}
            </div>

            <div className="relative" style={{ height: COLUMN_HEIGHT }}>
              {hours.map((h) => (
                <div
                  key={h}
                  aria-hidden
                  className="absolute inset-x-0 border-t border-line/60"
                  style={{ top: (h - START_HOUR) * PX_PER_HOUR }}
                />
              ))}

              {day.key === todayKey && (
                <NowLine startHour={START_HOUR} endHour={END_HOUR} pxPerHour={PX_PER_HOUR} />
              )}

              {day.timed.map((event, i) => (
                <EventBlock key={`${event.id}:${event.startsAt}`} event={event} index={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * 시간 블록. 겹치면 뒤 이벤트를 살짝 오른쪽으로 밀어 둘 다 보이게 한다 —
 * 단일 사용자 캘린더라 겹침이 드물어 열 분할 레이아웃은 과잉이다.
 */
function EventBlock({ event, index }: { event: EventRow; index: number }) {
  const startMin = minutesOfDay(event.startsAt);
  const endMin = Math.max(minutesOfDay(event.endsAt), startMin + 20);

  const clampedStart = Math.max(startMin, START_HOUR * 60);
  const clampedEnd = Math.min(endMin, END_HOUR * 60);
  if (clampedEnd <= START_HOUR * 60 || clampedStart >= END_HOUR * 60) return null;

  const top = ((clampedStart - START_HOUR * 60) / 60) * PX_PER_HOUR;
  const height = ((clampedEnd - clampedStart) / 60) * PX_PER_HOUR;

  return (
    <div
      title={`${event.summary} ${hhmm(event.startsAt)}–${hhmm(event.endsAt)}${event.location ? ` · ${event.location}` : ""}`}
      className="absolute overflow-hidden rounded-md border-l-2 border-accent bg-accent-soft px-1.5 py-0.5"
      style={{ top, height, left: 2 + (index % 3) * 6, right: 2, zIndex: 1 + (index % 3) }}
    >
      <p className="truncate text-xs font-medium text-text">{event.summary}</p>
      <p className="num truncate text-[10px] text-text-muted">
        {hhmm(event.startsAt)}–{hhmm(event.endsAt)}
      </p>
      {event.location && <p className="truncate text-[10px] text-text-muted">{event.location}</p>}
    </div>
  );
}

function minutesOfDay(iso: string): number {
  const [h, m] = hhmm(iso).split(":").map(Number) as [number, number];
  return h * 60 + m;
}
