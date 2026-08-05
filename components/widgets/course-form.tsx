"use client";

import { useActionState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addCourse, type FormState } from "@/app/(dashboard)/courses/actions";
import type { SemesterRow } from "@/lib/repos/courses";

export function CourseForm({ semesters, className }: { semesters: SemesterRow[]; className?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addCourse, null);
  const current = semesters.find((s) => s.isCurrent) ?? semesters[0];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>과목 추가</CardTitle>
      </CardHeader>

      {semesters.length === 0 ? (
        <p className="text-sm text-text-muted">
          학기가 없습니다. 과목은 학기에 속하므로 학기를 먼저 만들어야 합니다.
        </p>
      ) : (
        <form action={action} className="space-y-3">
          <Field label="과목명" htmlFor="name">
            <Input id="name" name="name" required maxLength={120} placeholder="コーポレート・ファイナンス" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="과목 코드" htmlFor="code" hint="시간표 연결에 쓰입니다">
              <Input id="code" name="code" maxLength={32} placeholder="2610012345" />
            </Field>
            <Field label="학점" htmlFor="credits">
              <Input id="credits" name="credits" type="number" min={0} max={12} step={0.5} defaultValue={2} required />
            </Field>
          </div>

          <Field label="학기" htmlFor="semesterId">
            <Select id="semesterId" name="semesterId" defaultValue={current?.id} required>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.isCurrent ? " (이번 학기)" : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Button type="submit" variant="primary" disabled={pending} className="w-full">
            {pending ? "추가하는 중" : "과목 추가"}
          </Button>

          {state && (
            <p role="status" className={state.ok ? "text-sm text-positive" : "text-sm text-negative"}>
              {state.message}
            </p>
          )}
        </form>
      )}
    </Card>
  );
}
