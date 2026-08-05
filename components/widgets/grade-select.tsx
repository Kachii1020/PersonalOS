"use client";

import { Select } from "@/components/ui/input";
import { updateGrade } from "@/app/(dashboard)/courses/actions";
import { GRADES } from "@/lib/grades";

/** 성적은 값 하나라 저장 버튼을 두지 않고 선택 즉시 반영한다. */
export function GradeSelect({ courseId, grade }: { courseId: string; grade: string | null }) {
  return (
    <form action={updateGrade}>
      <input type="hidden" name="id" value={courseId} />
      <Select
        name="grade"
        defaultValue={grade ?? ""}
        aria-label="성적"
        className="h-8 w-24 py-0 text-xs"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">미평가</option>
        {GRADES.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </Select>
    </form>
  );
}
