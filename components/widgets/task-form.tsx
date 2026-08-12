"use client";

import { useActionState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { addTask, type TaskFormState } from "@/app/(dashboard)/tasks/actions";

/** SPEC.md 4절 tasks.category의 값들. 자유 입력으로 두면 배지가 제각각이 된다. */
const CATEGORIES = ["school", "career", "study", "invest", "etc"] as const;

export function TaskForm({ defaultDate, className }: { defaultDate: string; className?: string }) {
  const [state, action, pending] = useActionState<TaskFormState, FormData>(addTask, null);
  const toast = useToast();

  useEffect(() => {
    if (state) toast(state.message, state.ok ? "success" : "error");
  }, [state, toast]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>할 일 추가</CardTitle>
      </CardHeader>

      <form action={action} className="space-y-3">
        <Field label="할 일" htmlFor="title">
          <Input id="title" name="title" required maxLength={200} placeholder="DCF 모델 v2 마무리" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="마감일" htmlFor="dueDate" hint="비우면 마감 없음">
            <Input id="dueDate" name="dueDate" type="date" defaultValue={defaultDate} />
          </Field>
          <Field label="마감 시각" htmlFor="dueTime">
            <Input id="dueTime" name="dueTime" type="time" defaultValue="23:59" step={300} />
          </Field>
        </div>

        <Field label="분류" htmlFor="category">
          <Select id="category" name="category" defaultValue="">
            <option value="">없음</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" variant="primary" disabled={pending} className="w-full">
          {pending ? "추가하는 중" : "할 일 추가"}
        </Button>
      </form>
    </Card>
  );
}
