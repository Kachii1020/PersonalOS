import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listWikiEntries } from "@/lib/repos/wiki";
import { monthDayWeekday } from "@/lib/time";

/**
 * 커맨드 팔레트 전역 검색 (1-C). 페이지·퀵 액션 같은 정적 항목은 클라이언트가 거른다 —
 * 여기는 DB(ilike)와 캐시된 위키만 본다. 단일 사용자 규모라 FTS는 과잉이다.
 */

export type SearchResult = {
  type: "event" | "task" | "course" | "wiki";
  title: string;
  subtitle?: string;
  href: string;
};

const PER_KIND = 5;

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const like = `%${escapeLike(q)}%`;

  const [events, tasks, courses, wiki] = await Promise.all([
    supabase
      .from("events")
      .select("summary, location, starts_at")
      .or(`summary.ilike.${like},location.ilike.${like}`)
      .order("starts_at", { ascending: false })
      .limit(PER_KIND),
    supabase
      .from("tasks")
      .select("title, due_at, status")
      .eq("status", "open")
      .ilike("title", like)
      .limit(PER_KIND),
    supabase
      .from("courses")
      .select("id, name, code")
      .or(`name.ilike.${like},code.ilike.${like}`)
      .limit(PER_KIND),
    // 위키는 캐시(6시간)에서 제목만 거른다. NOTION_DB_WIKI 미설정이면 조용히 제외 —
    // 검색은 보조 기능이라 위키 없이도 나머지 결과는 나와야 한다.
    listWikiEntries().catch(() => []),
  ]);

  if (events.error) throw new Error(`일정 검색 실패: ${events.error.message}`);
  if (tasks.error) throw new Error(`할 일 검색 실패: ${tasks.error.message}`);
  if (courses.error) throw new Error(`과목 검색 실패: ${courses.error.message}`);

  const lower = q.toLowerCase();
  const results: SearchResult[] = [
    ...(events.data ?? []).map((r) => ({
      type: "event" as const,
      title: r.summary,
      subtitle: `${monthDayWeekday(r.starts_at)}${r.location ? ` · ${r.location}` : ""}`,
      href: "/calendar",
    })),
    ...(tasks.data ?? []).map((r) => ({
      type: "task" as const,
      title: r.title,
      subtitle: r.due_at ? `마감 ${monthDayWeekday(r.due_at)}` : "마감 없음",
      href: "/tasks",
    })),
    ...(courses.data ?? []).map((r) => ({
      type: "course" as const,
      title: r.name,
      subtitle: r.code ?? undefined,
      href: `/courses/${r.id}`,
    })),
    ...wiki
      .filter((w) => w.title.toLowerCase().includes(lower))
      .slice(0, PER_KIND)
      .map((w) => ({
        type: "wiki" as const,
        title: w.title,
        subtitle: w.tags.join(" · ") || undefined,
        href: w.url,
      })),
  ];

  return results.slice(0, 12);
}

/** ilike 패턴 문자를 이스케이프한다. 검색어의 %·_가 와일드카드로 새면 안 된다. */
function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, (m) => `\\${m}`);
}
