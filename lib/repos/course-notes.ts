import "server-only";
import { unstable_cache } from "next/cache";
import { describeDatabase, queryDataSource } from "@/lib/integrations/notion/client";
import { titleOf, labelOf, richTextOf } from "@/lib/integrations/notion/properties";

/**
 * 과목별 노트 (Notion 읽기 전용).
 *
 * SPEC.md 3절: Course Notes — 과목, 주차, 내용.
 * 위키와 같은 패턴: 6시간 캐시, Supabase에 복사 안 함.
 * NOTION_DB_COURSE_NOTES 미설정이면 빈 배열.
 */

export type CourseNote = {
  id: string;
  title: string;
  course: string | null;
  week: string | null;
  content: string | null;
  url: string;
  lastEditedAt: string;
};

const SIX_HOURS = 21_600;

export async function listCourseNotes(courseName?: string): Promise<CourseNote[]> {
  const id = process.env.NOTION_DB_COURSE_NOTES?.trim();
  if (!id) return [];

  const all = await fetchCourseNotes(id);
  if (!courseName) return all;

  // 과목명으로 필터 (부분 일치)
  const lower = courseName.toLowerCase();
  return all.filter((n) => n.course?.toLowerCase().includes(lower));
}

const fetchCourseNotes = unstable_cache(
  async (id: string): Promise<CourseNote[]> => {
    const info = await describeDatabase(id);
    const { results } = await queryDataSource(info.dataSourceId, { pageSize: 100 });

    return results.map((page) => ({
      id: page.id,
      title: titleOf(page.properties) || "(제목 없음)",
      course: labelOf(page.properties, ["과목", "course", "수업", "class"]),
      week: labelOf(page.properties, ["주차", "week", "차시"]),
      content: richTextOf(page.properties, ["내용", "content", "요약", "summary", "메모", "memo"]),
      url: page.url,
      lastEditedAt: page.last_edited_time,
    }));
  },
  ["course-notes"],
  { revalidate: SIX_HOURS, tags: ["course-notes"] },
);
