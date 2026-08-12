import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/design/cn";
import { listEventsBetween, type EventRow } from "@/lib/repos/events";
import { addDays, monthRange, weekday, ymd } from "@/lib/time";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 이번 달 달력. 대시보드의 주 시선이라 글래스를 쓰는 두 위젯 중 하나다
 * (SPEC.md 6.4 규칙 1).
 *
 * 반복 일정은 마스터 날짜에만 찍힌다 — RRULE 전개는 docs/DEFERRED.md 참조.
 */
export async function MonthCalendar({ className }: { className?: string }) {
  const now = new Date();
  const { start, end, year, month } = monthRange(now);

  let events: EventRow[];
  try {
    events = await listEventsBetween(start.toISOString(), end.toISOString());
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

  const byDay = new Map<string, EventRow[]>();
  for (const event of events) {
    const key = ymd(new Date(event.startsAt));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(event);
    else byDay.set(key, [event]);
  }

  // 달력 격자는 그 달 1일이 속한 주의 일요일부터 시작한다.
  const gridStart = addDays(start, -weekday(start));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayKey = ymd(now);

  return (
    <Card glass className={className}>
      <Header year={year} month={month} count={events.length} />

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          message="이번 달 일정이 없습니다. iCloud 캘린더를 동기화하면 여기에 표시됩니다."
          action={
            <Link href="/settings" className={buttonClass({ size: "sm" })}>
              동기화 상태 보기
            </Link>
          }
        />
      ) : (
        <div role="grid" aria-label={`${year}년 ${month}월 달력`}>
          <div role="row" className="grid grid-cols-7 border-b border-line pb-1">
            {WEEKDAY_LABELS.map((label, i) => (
              <div
                key={label}
                role="columnheader"
                className={cn(
                  "text-center text-xs font-medium",
                  i === 0 ? "text-negative" : i === 6 ? "text-accent" : "text-text-muted",
                )}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day) => {
              const key = ymd(day);
              const inMonth = key.startsWith(`${year}-${String(month).padStart(2, "0")}`);
              const dayEvents = byDay.get(key) ?? [];
              const isToday = key === todayKey;

              return (
                <div
                  key={key}
                  role="gridcell"
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "min-h-14 border-b border-r border-line p-1 last:border-r-0 sm:min-h-20",
                    !inMonth && "opacity-40",
                  )}
                >
                  <div
                    className={cn(
                      "num mb-1 w-6 rounded px-1 text-xs",
                      isToday ? "bg-accent font-semibold text-bg" : "text-text-muted",
                    )}
                  >
                    {Number(key.slice(8))}
                  </div>

                  {/* 좁은 화면에서는 칸 너비가 50px 남짓이라 제목이 "알…"로 잘린다. 점만 찍고
                      상세는 아래 '오늘 일정' 위젯이 맡는다. */}
                  {dayEvents.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden="true">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span key={event.id} className="size-1.5 rounded-full bg-accent" />
                      ))}
                    </div>
                  )}
                  <span className="sr-only">{dayEvents.length > 0 ? `일정 ${dayEvents.length}건` : ""}</span>

                  <ul className="hidden space-y-0.5 sm:block">
                    {dayEvents.slice(0, 2).map((event) => (
                      <li
                        key={event.id}
                        title={event.summary}
                        className="truncate rounded bg-accent-soft px-1 text-xs text-accent"
                      >
                        {event.summary}
                      </li>
                    ))}
                    {dayEvents.length > 2 && (
                      <li className="num px-1 text-xs text-text-muted">+{dayEvents.length - 2}</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
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
