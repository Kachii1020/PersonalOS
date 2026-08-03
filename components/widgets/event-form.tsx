"use client";

import { useActionState } from "react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addEvent, type EventFormState } from "@/app/(dashboard)/calendar/actions";

/** 앱 전용 iCloud 캘린더에 일정을 추가한다. 다른 캘린더에는 쓰지 않는다. */
export function EventForm({ defaultDate, className }: { defaultDate: string; className?: string }) {
  const [state, action, pending] = useActionState<EventFormState, FormData>(addEvent, null);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>일정 추가</CardTitle>
        <CardHint>앱 전용 캘린더</CardHint>
      </CardHeader>

      <form action={action} className="space-y-3">
        <Field label="제목" htmlFor="summary">
          <Input id="summary" name="summary" required maxLength={200} placeholder="알고리즘 스터디" />
        </Field>

        <Field label="날짜" htmlFor="date">
          <Input id="date" name="date" type="date" required defaultValue={defaultDate} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="시작" htmlFor="startTime">
            <Input id="startTime" name="startTime" type="time" required defaultValue="10:00" step={300} />
          </Field>
          <Field label="종료" htmlFor="endTime">
            <Input id="endTime" name="endTime" type="time" required defaultValue="11:00" step={300} />
          </Field>
        </div>

        <Field label="장소" htmlFor="location" hint="선택 사항">
          <Input id="location" name="location" maxLength={200} placeholder="3호관 401" />
        </Field>

        <Button type="submit" variant="primary" disabled={pending} className="w-full">
          {pending ? "iCloud에 추가하는 중" : "일정 추가"}
        </Button>

        {state && (
          <p role="status" className={state.ok ? "text-sm text-positive" : "text-sm text-negative"}>
            {state.message}
          </p>
        )}
      </form>
    </Card>
  );
}
