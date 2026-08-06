import "server-only";
import { unstable_cache } from "next/cache";
import { describeDatabase, queryDataSource } from "@/lib/integrations/notion/client";
import { labelOf, tagsOf, titleOf } from "@/lib/integrations/notion/properties";

/**
 * 위키 (Notion 미러, 읽기 전용).
 *
 * SPEC.md 12절: Notion 레이트 리밋 대응으로 6시간 캐시 + 서버에서만 호출.
 * Supabase에 복사하지 않는다 — 위키는 사람이 Notion에서 쓰는 것이고, 한 레코드는
 * 한쪽에만 산다 (CLAUDE.md 데이터 소유권).
 */

export type WikiEntry = {
  id: string;
  title: string;
  status: string | null;
  tags: string[];
  url: string;
  lastEditedAt: string;
};

const SIX_HOURS = 21_600;

export async function listWikiEntries(): Promise<WikiEntry[]> {
  const id = process.env.NOTION_DB_WIKI?.trim();
  if (!id) throw new Error("NOTION_DB_WIKI가 설정되지 않았습니다. docs/NOTION-SETUP.md를 보세요.");

  return fetchWiki(id);
}

/**
 * 캐시 키에 DB id를 넣는다. 설정을 바꾸면 옛 캐시가 남지 않는다.
 * revalidate가 지나기 전에 강제로 새로 받고 싶으면 revalidateTag("wiki").
 */
const fetchWiki = unstable_cache(
  async (id: string): Promise<WikiEntry[]> => {
    const info = await describeDatabase(id);
    const { results } = await queryDataSource(info.dataSourceId, { pageSize: 100 });

    return results.map((page) => ({
      id: page.id,
      title: titleOf(page.properties) || "(제목 없음)",
      status: labelOf(page.properties, ["상태", "status", "카테고리", "category"]),
      tags: tagsOf(page.properties),
      url: page.url,
      lastEditedAt: page.last_edited_time,
    }));
  },
  ["wiki"],
  { revalidate: SIX_HOURS, tags: ["wiki"] },
);
