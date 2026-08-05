"use client";

import { useActionState } from "react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { uploadIcs, type IcsFormState } from "@/app/(dashboard)/settings/actions";

/**
 * MyWaseda 시간표 업로드 (SPEC.md 5.1b).
 * 학기당 1~2회 쓰는 화면이라 파일 하나만 받고 결과를 문장으로 돌려준다.
 */
export function IcsUpload({ className }: { className?: string }) {
  const [state, action, pending] = useActionState<IcsFormState, FormData>(uploadIcs, null);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>시간표 ICS</CardTitle>
        <CardHint>학기당 1~2회</CardHint>
      </CardHeader>

      <form action={action} className="space-y-3">
        <Field
          label="MyWaseda .ics 파일"
          htmlFor="ics"
          hint="같은 파일을 다시 올리면 아무것도 바뀌지 않습니다. 이전 학기 수업은 지우지 않습니다."
        >
          <Input id="ics" name="ics" type="file" accept=".ics,text/calendar" required className="file:mr-3 file:rounded file:border-0 file:bg-accent-soft file:px-2 file:py-1 file:text-xs file:text-text" />
        </Field>

        <Button type="submit" variant="primary" disabled={pending} className="w-full">
          {pending ? "반영하는 중" : "시간표 반영"}
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
