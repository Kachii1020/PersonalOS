"use client";

import { useActionState, useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { addSemester, type FormState } from "@/app/(dashboard)/courses/actions";

/**
 * 학기 추가. 과목은 학기에 속하므로 학기가 없으면 아무것도 못 만든다.
 * 학기당 한 번 쓰는 폼이라 평소에는 접어둔다.
 */
export function SemesterForm({ hasSemesters, className }: { hasSemesters: boolean; className?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addSemester, null);
  // 학기가 하나도 없으면 지금 해야 할 일이므로 펼친 채로 시작한다.
  const [open, setOpen] = useState(!hasSemesters);
  const toast = useToast();

  useEffect(() => {
    if (state) toast(state.message, state.ok ? "success" : "error");
  }, [state, toast]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>학기 추가</CardTitle>
        {hasSemesters && (
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? "접기" : "펼치기"}
          </Button>
        )}
      </CardHeader>

      {open && (
        <form action={action} className="space-y-3">
          <Field label="학기 이름" htmlFor="label" hint="예: 2026 Autumn">
            <Input id="label" name="label" required maxLength={40} placeholder="2026 Autumn" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="시작일" htmlFor="startsOn">
              <Input id="startsOn" name="startsOn" type="date" required />
            </Field>
            <Field label="종료일" htmlFor="endsOn">
              <Input id="endsOn" name="endsOn" type="date" required />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-text">
            <input
              type="checkbox"
              name="isCurrent"
              defaultChecked={!hasSemesters}
              className="size-4 cursor-pointer accent-accent"
            />
            이번 학기로 지정
          </label>

          <Button type="submit" variant="primary" disabled={pending} className="w-full">
            {pending ? "추가하는 중" : "학기 추가"}
          </Button>
        </form>
      )}
    </Card>
  );
}
