import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { listOpenTasksDueBetween, type TaskRow } from "@/lib/repos/tasks";
import { addDays, hhmm, monthDayWeekday, todayStart } from "@/lib/time";

/** 이번 주(오늘부터 7일) 마감. 오늘 마감은 눈에 띄게 둔다. */
export async function WeekDeadlines({ className }: { className?: string }) {
  const now = new Date();
  const start = todayStart(now);
  const end = addDays(start, 7);
  const tomorrow = addDays(start, 1);

  let tasks: TaskRow[];
  try {
    tasks = await listOpenTasksDueBetween(start.toISOString(), end.toISOString());
  } catch (e) {
    console.error(e);
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>이번 주 마감</CardTitle>
        </CardHeader>
        <ErrorState what="마감 목록을 불러오지 못했습니다" fix="잠시 후 새로고침하세요." />
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>이번 주 마감</CardTitle>
        {tasks.length > 0 && <CardHint>{tasks.length}건</CardHint>}
      </CardHeader>

      {tasks.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          message="7일 안에 마감인 할 일이 없습니다. 할 일을 추가하면 여기에 마감 순으로 쌓입니다."
          action={
            <Link href="/tasks" className={buttonClass({ size: "sm" })}>
              할 일 열기
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => {
            const due = new Date(task.dueAt!);
            const isToday = due < tomorrow;
            return (
              <li key={task.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-text">{task.title}</span>
                <span className="flex shrink-0 items-baseline gap-2">
                  {task.category && <Badge>{task.category}</Badge>}
                  <span className={isToday ? "num text-xs text-negative" : "num text-xs text-text-muted"}>
                    {isToday ? `오늘 ${hhmm(task.dueAt!)}` : monthDayWeekday(task.dueAt!)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
