import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CalendarClock, MapPin } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonLines } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GradeSelect } from "@/components/widgets/grade-select";
import { MaterialPanel } from "@/components/widgets/material-panel";
import { getCourse, nextClass } from "@/lib/repos/courses";
import { listMaterials } from "@/lib/repos/materials";
import { hhmm, monthDayWeekday } from "@/lib/time";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const course = await getCourse((await params).id).catch(() => null);
  return { title: `${course?.name ?? "과목"} · Personal OS` };
}

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await getCourse(id);
  if (!course) notFound();

  return (
    <>
      <Link
        href="/courses"
        className="mb-3 inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        과목 목록
      </Link>

      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
        <h1 className="text-xl font-semibold text-text">{course.name}</h1>
        <div className="flex items-center gap-2">
          {course.code && <Badge className="num">{course.code}</Badge>}
          <span className="num text-xs text-text-muted">
            {course.semesterLabel} · {course.credits}학점
          </span>
          <GradeSelect courseId={course.id} grade={course.grade} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense fallback={<Loading title="다음 수업" />}>
          <NextClass courseId={course.id} />
        </Suspense>
        <Suspense fallback={<Loading title="강의자료" className="lg:col-span-2 lg:row-span-2" />}>
          <Materials courseId={course.id} className="lg:col-span-2 lg:row-span-2" />
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
      <SkeletonLines lines={2} />
    </Card>
  );
}

async function NextClass({ courseId }: { courseId: string }) {
  let next: Awaited<ReturnType<typeof nextClass>>;
  try {
    next = await nextClass(courseId);
  } catch (e) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>다음 수업</CardTitle>
        </CardHeader>
        <ErrorState what="일정을 불러오지 못했습니다" fix={e instanceof Error ? e.message : "잠시 후 새로고침하세요."} />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>다음 수업</CardTitle>
        <CardHint>시간표 ICS</CardHint>
      </CardHeader>
      {!next ? (
        <EmptyState message="예정된 수업이 없습니다. 설정에서 시간표 ICS를 올리면 여기에 뜹니다." />
      ) : (
        <div className="space-y-1.5">
          <p className="text-sm text-text">{next.summary}</p>
          <p className="num flex items-center gap-1.5 text-sm text-text-muted">
            <CalendarClock aria-hidden className="size-4" />
            {monthDayWeekday(next.startsAt)} {hhmm(next.startsAt)}
          </p>
          {next.location && (
            <p className="flex items-center gap-1.5 text-sm text-text-muted">
              <MapPin aria-hidden className="size-4" />
              {next.location}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

async function Materials({ courseId, className }: { courseId: string; className?: string }) {
  try {
    return <MaterialPanel courseId={courseId} materials={await listMaterials(courseId)} className={className} />;
  } catch (e) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>강의자료</CardTitle>
        </CardHeader>
        <ErrorState what="강의자료를 불러오지 못했습니다" fix={e instanceof Error ? e.message : "잠시 후 새로고침하세요."} />
      </Card>
    );
  }
}
