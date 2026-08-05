import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonLines } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CourseForm } from "@/components/widgets/course-form";
import { GradeSelect } from "@/components/widgets/grade-select";
import { listCourses, listSemesters, type CourseRow } from "@/lib/repos/courses";
import { calculateGpa } from "@/lib/grades";

export const metadata = { title: "과목 · Personal OS" };

export default function CoursesPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold text-text">과목</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense fallback={<Loading title="과목" className="lg:col-span-2" />}>
          <CourseList className="lg:col-span-2" />
        </Suspense>
        <Suspense fallback={<Loading title="과목 추가" />}>
          <AddCourse />
        </Suspense>
      </div>
    </>
  );
}

function Loading({ title, className }: { title: string; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <SkeletonLines lines={3} />
    </Card>
  );
}

async function AddCourse() {
  try {
    return <CourseForm semesters={await listSemesters()} />;
  } catch (e) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>과목 추가</CardTitle>
        </CardHeader>
        <ErrorState what="학기를 불러오지 못했습니다" fix={e instanceof Error ? e.message : "잠시 후 새로고침하세요."} />
      </Card>
    );
  }
}

async function CourseList({ className }: { className?: string }) {
  let courses: CourseRow[];
  try {
    courses = await listCourses();
  } catch (e) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>과목</CardTitle>
        </CardHeader>
        <ErrorState what="과목을 불러오지 못했습니다" fix={e instanceof Error ? e.message : "잠시 후 새로고침하세요."} />
      </Card>
    );
  }

  const gpa = calculateGpa(courses);
  const bySemester = new Map<string, CourseRow[]>();
  for (const course of courses) {
    const list = bySemester.get(course.semesterLabel);
    if (list) list.push(course);
    else bySemester.set(course.semesterLabel, [course]);
  }

  return (
    <Card className={className}>
      <CardHeader className="flex-wrap">
        <CardTitle>과목</CardTitle>
        {/* 성적이 하나도 없으면 GPA 자리를 비워둔다. 0.00은 "F만 받았다"는 뜻이다. */}
        <CardHint>
          {gpa ? (
            <>
              GPA <span className="num text-text">{gpa.gpa.toFixed(2)}</span> / 4.00 · {gpa.credits}학점
            </>
          ) : (
            "성적 입력 전"
          )}
        </CardHint>
      </CardHeader>

      {courses.length === 0 ? (
        <EmptyState message="아직 과목이 없습니다. 오른쪽에서 추가하면 시간표·강의자료가 여기에 묶입니다." />
      ) : (
        <div className="space-y-4">
          {[...bySemester].map(([semester, list]) => (
            <section key={semester}>
              <h3 className="mb-1.5 text-xs font-medium text-text-muted">{semester}</h3>
              <ul className="space-y-1">
                {list.map((course) => (
                  <li
                    key={course.id}
                    // 375px에서는 한 줄에 안 들어간다. 접히지 않으면 성적 셀렉트가 화면 밖으로 잘린다.
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line px-3 py-2"
                  >
                    <Link
                      href={`/courses/${course.id}`}
                      className="group flex min-w-0 flex-1 basis-full items-center gap-2 text-sm text-text transition-colors hover:text-accent sm:basis-auto"
                    >
                      <span className="truncate">{course.name}</span>
                      {course.code && (
                        <Badge className="num shrink-0">{course.code}</Badge>
                      )}
                      <ChevronRight
                        aria-hidden
                        className="size-4 shrink-0 text-text-muted transition-colors group-hover:text-accent"
                      />
                    </Link>
                    <span className="num ml-auto shrink-0 text-xs text-text-muted sm:ml-0">{course.credits}학점</span>
                    <GradeSelect courseId={course.id} grade={course.grade} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
