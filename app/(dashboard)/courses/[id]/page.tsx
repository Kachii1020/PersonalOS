import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CalendarClock, ExternalLink, MapPin, NotebookText } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonLines } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GradeSelect } from "@/components/widgets/grade-select";
import { MaterialPanel } from "@/components/widgets/material-panel";
import { getCourse, nextClass } from "@/lib/repos/courses";
import { listMaterials } from "@/lib/repos/materials";
import { listCourseNotes } from "@/lib/repos/course-notes";
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
        <Suspense fallback={<Loading title="과목 노트" className="lg:col-span-3" />}>
          <Notes courseName={course.name} />
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
        <EmptyState icon={CalendarClock} message="예정된 수업이 없습니다. 설정에서 시간표 ICS를 올리면 여기에 뜹니다." />
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

async function Notes({ courseName }: { courseName: string }) {
  const notes = await listCourseNotes(courseName);

  // NOTION_DB_COURSE_NOTES 미설정이면 섹션 자체를 숨긴다
  if (notes.length === 0 && !process.env.NOTION_DB_COURSE_NOTES?.trim()) return null;

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>과목 노트</CardTitle>
        <CardHint>Notion 읽기 전용 · {notes.length}건</CardHint>
      </CardHeader>
      {notes.length === 0 ? (
        <EmptyState icon={NotebookText} message="이 과목의 Notion 노트가 아직 없습니다. 과목명과 일치하는 노트를 추가하면 여기에 올라옵니다." />
      ) : (
        <ul className="space-y-1">
          {notes.map((note) => (
            <li key={note.id}>
              <a
                href={note.url}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line px-3 py-2 transition-colors hover:border-accent/40"
              >
                <span className="min-w-0 shrink-0 text-sm font-medium text-text transition-colors group-hover:text-accent">
                  {note.title}
                </span>
                {note.week && <Badge>{note.week}</Badge>}
                {note.content && (
                  <span className="basis-full text-xs text-text-muted line-clamp-1">{note.content}</span>
                )}
                <span className="num ml-auto shrink-0 text-xs text-text-muted">
                  {monthDayWeekday(note.lastEditedAt)}
                </span>
                <ExternalLink
                  aria-hidden
                  className="size-3.5 shrink-0 text-text-muted transition-colors group-hover:text-accent"
                />
              </a>
            </li>
          ))}
        </ul>
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
