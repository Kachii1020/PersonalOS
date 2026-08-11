import "server-only";
import { unstable_cache } from "next/cache";
import { describeDatabase, queryDataSource } from "@/lib/integrations/notion/client";
import { titleOf, labelOf, tagsOf, richTextOf } from "@/lib/integrations/notion/properties";

/**
 * 투자 리서치 노트 (Notion 읽기 전용).
 *
 * SPEC.md 3절: Research Notes — 티커, 회사명, 테마 태그, 논지, 리스크, 업데이트일.
 * 위키와 같은 패턴: 6시간 캐시, Supabase에 복사 안 함.
 * NOTION_DB_RESEARCH 미설정이면 빈 배열.
 */

export type ResearchNote = {
  id: string;
  title: string;
  ticker: string | null;
  theme: string | null;
  tags: string[];
  thesis: string | null;
  url: string;
  lastEditedAt: string;
};

const SIX_HOURS = 21_600;

export async function listResearchNotes(): Promise<ResearchNote[]> {
  const id = process.env.NOTION_DB_RESEARCH?.trim();
  if (!id) return [];

  return fetchResearch(id);
}

const fetchResearch = unstable_cache(
  async (id: string): Promise<ResearchNote[]> => {
    const info = await describeDatabase(id);
    const { results } = await queryDataSource(info.dataSourceId, { pageSize: 100 });

    return results.map((page) => ({
      id: page.id,
      title: titleOf(page.properties) || "(제목 없음)",
      ticker: labelOf(page.properties, ["티커", "ticker", "symbol"]),
      theme: labelOf(page.properties, ["테마", "theme", "섹터", "sector"]),
      tags: tagsOf(page.properties),
      thesis: richTextOf(page.properties, [
        "논지", "thesis", "투자 논리", "investment thesis", "요약", "summary",
      ]),
      url: page.url,
      lastEditedAt: page.last_edited_time,
    }));
  },
  ["research"],
  { revalidate: SIX_HOURS, tags: ["research"] },
);
