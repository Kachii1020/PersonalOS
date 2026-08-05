/**
 * 4.0 스케일 GPA (SPEC.md 6.2 /courses).
 *
 * 와세다의 등급 체계다. F는 0점으로 분모에 포함되고, 아직 성적이 안 나온 과목(grade = null)은
 * 분자·분모 어디에도 안 들어간다 — 미평가 과목을 0점으로 세면 학기 중 GPA가 항상 낮게 나온다.
 */
export const GRADE_POINTS = { "A+": 4.0, A: 3.0, B: 2.0, C: 1.0, F: 0.0 } as const;

export type Grade = keyof typeof GRADE_POINTS;

export const GRADES = Object.keys(GRADE_POINTS) as Grade[];

export function isGrade(value: string): value is Grade {
  return value in GRADE_POINTS;
}

export function gradePoint(grade: Grade): number {
  return GRADE_POINTS[grade];
}

/** 성적이 매겨진 과목이 없으면 null. 0.00과 "아직 없음"은 다르다. */
export function calculateGpa(
  courses: Array<{ credits: number; grade: string | null }>,
): { gpa: number; credits: number; gradedCourses: number } | null {
  let weighted = 0;
  let credits = 0;
  let gradedCourses = 0;

  for (const course of courses) {
    if (!course.grade || !isGrade(course.grade)) continue;
    weighted += course.credits * GRADE_POINTS[course.grade];
    credits += course.credits;
    gradedCourses++;
  }

  if (gradedCourses === 0) return null;
  // 학점이 전부 0인 과목만 있는 경우(청강 등) 0으로 나누는 것을 막는다.
  if (credits === 0) return { gpa: 0, credits: 0, gradedCourses };

  return { gpa: weighted / credits, credits, gradedCourses };
}
