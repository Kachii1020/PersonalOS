import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Badge } from "@/components/ui/badge";
import { listOpenTasks, type TaskRow } from "@/lib/repos/tasks";
import { addDays, hhmm, monthDayWeekday, todayStart } from "@/lib/time";

export const metadata = { title: "마감·할 일 · Personal OS" };

/** 마감 기준으로 묶는다. 목록을 그냥 나열하면 무엇이 급한지 안 보인다. */
function bucketOf(task: TaskRow, now: Date): "지남" | "오늘" | "이번 주" | "나중" | "마감 없음" {
  if (!task.dueAt) return "마감 없음";
  const due = new Date(task.dueAt);
  const start = todayStart(now);
  if (due < now) return "지남";
  if (due < addDays(start, 1)) return "오늘";
  if (due < addDays(start, 7)) return "이번 주";
  return "나중";
}

const ORDER = ["지남", "오늘", "이번 주", "나중", "마감 없음"] as const;

export default async function TasksPage() {
  const now = new Date();

  let tasks: TaskRow[];
  try {
    tasks = await listOpenTasks();
  } catch {
    return (
      <>
        <h1 className="mb-4 text-xl font-semibold text-text">마감·할 일</h1>
        <Card>
          <ErrorState what="할 일 목록을 불러오지 못했습니다" fix="잠시 후 새로고침하세요." />
        </Card>
      </>
    );
  }

  const groups = new Map<string, TaskRow[]>();
  for (const task of tasks) {
    const key = bucketOf(task, now);
    const bucket = groups.get(key);
    if (bucket) bucket.push(task);
    else groups.set(key, [task]);
  }

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold text-text">마감·할 일</h1>

      {tasks.length === 0 ? (
        <Card>
          <EmptyState message="열린 할 일이 없습니다. 캘린더 일정과 별개로 마감이 있는 일을 여기에 모아둡니다." />
        </Card>
      ) : (
        <div className="space-y-4">
          {ORDER.filter((key) => groups.has(key)).map((key) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle>{key}</CardTitle>
                <CardHint>{groups.get(key)!.length}건</CardHint>
              </CardHeader>
              <ul className="space-y-2">
                {groups.get(key)!.map((task) => (
                  <li key={task.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-text">{task.title}</span>
                      {task.notes && <span className="block truncate text-xs text-text-muted">{task.notes}</span>}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-2">
                      {task.category && <Badge>{task.category}</Badge>}
                      <span className={key === "지남" ? "num text-xs text-negative" : "num text-xs text-text-muted"}>
                        {task.dueAt ? `${monthDayWeekday(task.dueAt)} ${hhmm(task.dueAt)}` : "—"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
