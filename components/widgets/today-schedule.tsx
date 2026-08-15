import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { buttonClass } from "@/components/ui/button";
import { listEventsBetween, type EventRow } from "@/lib/repos/events";
import { addDays, hhmm, todayStart } from "@/lib/time";

/** 오늘 일정 타임라인. 지금 시각 기준으로 지난 일정은 흐리게 둔다. */
export async function TodaySchedule({ className }: { className?: string }) {
  const now = new Date();
  const start = todayStart(now);
  const end = addDays(start, 1);

  let events: EventRow[];
  try {
    events = await listEventsBetween(start.toISOString(), end.toISOString());
  } catch (e) {
    console.error(e);
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>오늘 일정</CardTitle>
        </CardHeader>
        <ErrorState
          what="오늘 일정을 불러오지 못했습니다"
          fix="설정에서 iCloud 동기화 상태를 확인하세요."
          action={
            <Link href="/settings" className={buttonClass({ size: "sm" })}>
              설정 열기
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>오늘 일정</CardTitle>
        {events.length > 0 && <CardHint>{events.length}건</CardHint>}
      </CardHeader>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          message="오늘은 잡힌 일정이 없습니다. 캘린더에서 새 일정을 추가할 수 있습니다."
          action={
            <Link href="/calendar" className={buttonClass({ size: "sm" })}>
              캘린더 열기
            </Link>
          }
        />
      ) : (
        <ol className="space-y-3">
          {events.map((event) => {
            const past = new Date(event.endsAt) < now;
            return (
              <li key={event.id} className={past ? "flex gap-3 opacity-50" : "flex gap-3"}>
                <span className="num w-20 shrink-0 pt-0.5 text-xs text-text-muted">
                  {event.isAllDay ? "종일" : `${hhmm(event.startsAt)}–${hhmm(event.endsAt)}`}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-text">{event.summary}</span>
                  {event.location && (
                    <span className="block truncate text-xs text-text-muted">{event.location}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
