import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { TaskForm } from "@/components/widgets/task-form";
import { TaskBoard } from "@/components/widgets/task-board";
import { listTasksFiltered, type TaskFilters, type TaskRow } from "@/lib/repos/tasks";
import { cn } from "@/lib/design/cn";
import { completeTask } from "./actions";
import { addDays, hhmm, monthDayWeekday, todayStart, ymd } from "@/lib/time";

export const metadata = { title: "마감·할 일 · Personal OS" };

/** 마감 기준으로 묶는다. 목록을 그냥 나열하면 무엇이 급한지 안 보인다. */
function bucketOf(task: TaskRow, now: Date): (typeof ORDER)[number] {
  if (!task.dueAt) return "마감 없음";
  const due = new Date(task.dueAt);
  const start = todayStart(now);
  if (due < now) return "지남";
  if (due < addDays(start, 1)) return "오늘";
  if (due < addDays(start, 7)) return "이번 주";
  return "나중";
}

const ORDER = ["지남", "오늘", "이번 주", "나중", "마감 없음"] as const;
const CATEGORIES = ["school", "career", "study", "invest", "etc"] as const;

/** 리스트 | 칸반 + 필터 (2-B). 전부 URL 파라미터 — 새로고침·공유에도 유지. */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string; category?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();

  const isBoard = params.view === "board";
  const filters: TaskFilters = {
    status: params.status === "all" ? "all" : params.status === "done" ? "done" : "open",
    category: CATEGORIES.includes(params.category as (typeof CATEGORIES)[number]) ? params.category! : null,
    sort: params.sort === "created" ? "created" : "due",
  };

  let tasks: TaskRow[];
  try {
    tasks = await listTasksFiltered(filters);
  } catch (e) {
    console.error(e);
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text">마감·할 일</h1>
        <nav aria-label="할 일 뷰" className="flex gap-1 rounded-lg bg-accent-soft p-1">
          <ViewTab href={viewHref(params, undefined)} active={!isBoard}>
            리스트
          </ViewTab>
          <ViewTab href={viewHref(params, "board")} active={isBoard}>
            칸반
          </ViewTab>
        </nav>
      </div>

      <FilterBar params={params} />

      {isBoard ? (
        <TaskBoard tasks={tasks} />
      ) : (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {tasks.length === 0 ? (
            <Card>
              <EmptyState icon={CheckCircle2} message="조건에 맞는 할 일이 없습니다. 필터를 바꾸거나 오른쪽에서 추가해 보세요." />
            </Card>
          ) : (
            ORDER.filter((key) => groups.has(key)).map((key) => (
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
                        <form action={completeTask}>
                          <input type="hidden" name="id" value={task.id} />
                          <button
                            type="submit"
                            aria-label={`'${task.title}' 완료 처리`}
                            className="cursor-pointer rounded-lg px-2 py-0.5 text-xs text-text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                          >
                            완료
                          </button>
                        </form>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))
          )}
        </div>

        <TaskForm defaultDate={ymd(now)} />
      </div>
      )}
    </>
  );
}

type Params = { view?: string; status?: string; category?: string; sort?: string };

function viewHref(params: Params, view: "board" | undefined): string {
  const next = new URLSearchParams();
  if (view) next.set("view", view);
  if (params.status) next.set("status", params.status);
  if (params.category) next.set("category", params.category);
  if (params.sort) next.set("sort", params.sort);
  const qs = next.toString();
  return qs ? `/tasks?${qs}` : "/tasks";
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

/** GET 폼 — 서버 컴포넌트만으로 필터가 URL에 남는다. */
function FilterBar({ params }: { params: Params }) {
  return (
    <form method="get" action="/tasks" className="mb-4 flex flex-wrap items-end gap-2">
      {params.view && <input type="hidden" name="view" value={params.view} />}
      <label className="space-y-1">
        <span className="block text-xs font-medium text-text">상태</span>
        <Select name="status" defaultValue={params.status ?? "open"} className="w-28">
          <option value="open">열림</option>
          <option value="done">완료</option>
          <option value="all">전체</option>
        </Select>
      </label>
      <label className="space-y-1">
        <span className="block text-xs font-medium text-text">분류</span>
        <Select name="category" defaultValue={params.category ?? ""} className="w-32">
          <option value="">전체</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </label>
      <label className="space-y-1">
        <span className="block text-xs font-medium text-text">정렬</span>
        <Select name="sort" defaultValue={params.sort ?? "due"} className="w-28">
          <option value="due">마감순</option>
          <option value="created">생성순</option>
        </Select>
      </label>
      <button
        type="submit"
        className="h-9 cursor-pointer rounded-lg bg-accent-soft px-3 text-sm font-medium text-accent transition-colors hover:brightness-95"
      >
        적용
      </button>
    </form>
  );
}
