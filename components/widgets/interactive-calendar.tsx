"use client";

import { useState } from "react";
import { X, MapPin, Clock, Trash2 } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/design/cn";
import { deleteEvent } from "@/app/(dashboard)/calendar/actions";

type CalendarEvent = {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  source: string;
  isDeletable: boolean;
};

type CellData = {
  key: string; // YYYY-MM-DD
  day: number; // day of month
  inMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
};

type Props = {
  year: number;
  month: number;
  cells: CellData[];
  totalEvents: number;
  className?: string;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function InteractiveCalendar({ year, month, cells, totalEvents, className }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);

  const selectedEvents = selectedDate ? (cells.find((c) => c.key === selectedDate)?.events ?? []) : [];

  async function handleDelete(eventId: string) {
    setDeleting(eventId);
    try {
      const result = await deleteEvent(eventId);
      if (result) {
        setToast(result);
        if (result.ok) {
          setConfirmDelete(null);
        }
      }
    } finally {
      setDeleting(null);
    }
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <Card glass className={className}>
      <CardHeader>
        <CardTitle>
          {year}년 {month}월
        </CardTitle>
        {totalEvents > 0 && <CardHint>일정 {totalEvents}건</CardHint>}
      </CardHeader>

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
          {cells.map((cell) => (
            <button
              key={cell.key}
              type="button"
              onClick={() => setSelectedDate(selectedDate === cell.key ? null : cell.key)}
              aria-current={cell.isToday ? "date" : undefined}
              aria-pressed={selectedDate === cell.key}
              className={cn(
                "min-h-14 cursor-pointer border-b border-r border-line p-1 text-left transition-colors last:border-r-0 sm:min-h-20",
                "hover:bg-accent-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                !cell.inMonth && "opacity-40",
                selectedDate === cell.key && "bg-accent-soft/50",
              )}
            >
              <div
                className={cn(
                  "num mb-1 w-6 rounded px-1 text-xs",
                  cell.isToday ? "bg-accent font-semibold text-bg" : "text-text-muted",
                )}
              >
                {cell.day}
              </div>

              {/* 좁은 화면에서는 칸 너비가 50px 남짓이라 제목이 "알…"로 잘린다. 점만 찍는다. */}
              {cell.events.length > 0 && (
                <div className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden="true">
                  {cell.events.slice(0, 3).map((event) => (
                    <span key={`${event.id}:${event.startsAt}`} className="size-1.5 rounded-full bg-accent" />
                  ))}
                </div>
              )}
              <span className="sr-only">{cell.events.length > 0 ? `일정 ${cell.events.length}건` : ""}</span>

              <ul className="hidden space-y-0.5 sm:block">
                {cell.events.slice(0, 2).map((event) => (
                  <li key={`${event.id}:${event.startsAt}`} title={event.summary} className="truncate rounded bg-accent-soft px-1 text-xs text-accent">
                    {event.summary}
                  </li>
                ))}
                {cell.events.length > 2 && <li className="num px-1 text-xs text-text-muted">+{cell.events.length - 2}</li>}
              </ul>
            </button>
          ))}
        </div>
      </div>

      {selectedDate && (
        <div className="border-t border-line pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-text">{formatDateHeader(selectedDate)}</h3>
            <button
              type="button"
              onClick={() => {
                setSelectedDate(null);
                setConfirmDelete(null);
              }}
              className="cursor-pointer rounded-full p-1 text-text-muted transition-colors hover:bg-accent-soft hover:text-text"
              aria-label="닫기"
            >
              <X className="size-4" />
            </button>
          </div>

          {toast && (
            <p
              className={cn(
                "mb-3 rounded-lg px-3 py-2 text-sm",
                toast.ok ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative",
              )}
            >
              {toast.message}
            </p>
          )}

          {selectedEvents.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-muted">이 날짜에 일정이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((event) => (
                <li key={`${event.id}:${event.startsAt}`} className="rounded-lg border border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text">{event.summary}</p>

                      {!event.isAllDay && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                          <Clock className="size-3 shrink-0" />
                          {formatTime(event.startsAt)} – {formatTime(event.endsAt)}
                        </p>
                      )}

                      {event.location && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </p>
                      )}

                      {event.description && <p className="mt-2 line-clamp-3 text-xs text-text-muted">{event.description}</p>}
                    </div>

                    {event.isDeletable && (
                      <div className="shrink-0">
                        {confirmDelete === event.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(event.id)}
                              disabled={deleting === event.id}
                              className="cursor-pointer rounded-lg bg-negative px-2 py-1 text-xs font-medium text-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deleting === event.id ? "삭제 중…" : "확인"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              className="cursor-pointer rounded-lg border border-line px-2 py-1 text-xs text-text-muted transition-colors hover:text-text"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(event.id)}
                            className="cursor-pointer rounded-lg p-1.5 text-text-muted transition-colors hover:bg-negative/10 hover:text-negative"
                            aria-label={`${event.summary} 삭제`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const wd = weekdays[d.getDay()];
  return `${month}월 ${day}일 (${wd})`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
