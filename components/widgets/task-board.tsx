"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/design/cn";
import { moveTaskCategory } from "@/app/(dashboard)/tasks/actions";
import type { TaskRow } from "@/lib/repos/tasks";
import { hhmm, monthDayWeekday } from "@/lib/time";

/**
 * 카테고리 칸반 (2-B). HTML Drag and Drop — 단일 사용자, 리스트가 작아 라이브러리가 필요 없다.
 * 카드를 다른 열에 놓으면 category만 바뀐다. 상태(open/done)는 리스트 뷰에서 다룬다.
 */
const COLUMNS: Array<{ key: string | null; label: string }> = [
  { key: "school", label: "school" },
  { key: "career", label: "career" },
  { key: "study", label: "study" },
  { key: "invest", label: "invest" },
  { key: "etc", label: "etc" },
  { key: null, label: "미분류" },
];

export function TaskBoard({ tasks }: { tasks: TaskRow[] }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function drop(category: string | null) {
    const id = dragId;
    setDragId(null);
    setOverColumn(null);
    if (!id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task || task.category === category) return;

    startTransition(async () => {
      const result = await moveTaskCategory(id, category);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) router.refresh();
    });
  }

  return (
    <div
      className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6", pending && "opacity-70")}
      aria-busy={pending}
    >
      {COLUMNS.map((column) => {
        const cards = tasks.filter((t) => (t.category ?? null) === column.key);
        const columnId = column.key ?? "__none__";
        return (
          <Card
            key={columnId}
            onDragOver={(e) => {
              e.preventDefault();
              setOverColumn(columnId);
            }}
            onDragLeave={() => setOverColumn((prev) => (prev === columnId ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              drop(column.key);
            }}
            className={cn("min-h-40 p-3 transition-colors", overColumn === columnId && "bg-accent-soft")}
          >
            <CardHeader className="mb-2">
              <CardTitle className="text-sm">{column.label}</CardTitle>
              <CardHint className="num">{cards.length}</CardHint>
            </CardHeader>

            {cards.length === 0 ? (
              <p className="text-xs text-text-muted">카드를 여기로 끌어 분류를 바꿉니다.</p>
            ) : (
              <ul className="space-y-2">
                {cards.map((task) => (
                  <li
                    key={task.id}
                    draggable
                    onDragStart={() => setDragId(task.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "cursor-grab rounded-lg border border-line bg-bg px-2.5 py-2 active:cursor-grabbing",
                      dragId === task.id && "opacity-50",
                    )}
                  >
                    <p className="text-sm text-text">{task.title}</p>
                    <p className="num mt-0.5 text-[10px] text-text-muted">
                      {task.dueAt ? `${monthDayWeekday(task.dueAt)} ${hhmm(task.dueAt)}` : "마감 없음"}
                      {task.status === "done" && " · 완료"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
