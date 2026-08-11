import "server-only";
import { unstable_cache } from "next/cache";
import { describeDatabase, queryDataSource } from "@/lib/integrations/notion/client";
import { titleOf, tagsOf, richTextOf } from "@/lib/integrations/notion/properties";

/**
 * 알고리즘 패턴 정리 (Notion 읽기 전용).
 *
 * SPEC.md 3절: Algo Patterns — 패턴명, 핵심 아이디어, 대표 문제, 코드 스니펫.
 * 위키와 같은 패턴: 6시간 캐시, Supabase에 복사 안 함.
 * NOTION_DB_ALGO 미설정이면 빈 배열 (앱이 깨지면 안 된다).
 */

export type AlgoPattern = {
  id: string;
  title: string;
  coreIdea: string | null;
  tags: string[];
  url: string;
  lastEditedAt: string;
};

const SIX_HOURS = 21_600;

export async function listAlgoPatterns(): Promise<AlgoPattern[]> {
  const id = process.env.NOTION_DB_ALGO?.trim();
  if (!id) return [];

  return fetchAlgoPatterns(id);
}

const fetchAlgoPatterns = unstable_cache(
  async (id: string): Promise<AlgoPattern[]> => {
    const info = await describeDatabase(id);
    const { results } = await queryDataSource(info.dataSourceId, { pageSize: 100 });

    return results.map((page) => ({
      id: page.id,
      title: titleOf(page.properties) || "(패턴명 없음)",
      coreIdea: richTextOf(page.properties, [
        "핵심 아이디어", "core idea", "아이디어", "idea", "설명", "description",
      ]),
      tags: tagsOf(page.properties),
      url: page.url,
      lastEditedAt: page.last_edited_time,
    }));
  },
  ["algo-patterns"],
  { revalidate: SIX_HOURS, tags: ["algo-patterns"] },
);
