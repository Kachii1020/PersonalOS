import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Lang, Sector } from "@/config/news-sources";

export type NewsInsert = {
  sourceKey: string;
  lang: Lang;
  sector: Sector;
  title: string;
  url: string;
  publishedAt: string | null;
  rawSummary: string | null;
};

export type NewsItem = NewsInsert & { id: string; fetchedAt: string };

/**
 * 잡 전용. url이 unique라 같은 기사가 여러 소스에서 들어와도 한 행만 남는다.
 * 이미 있는 기사는 갱신하지 않는다 — 최초 수집 시점과 섹터를 보존한다.
 */
export async function insertNewsItems(items: NewsInsert[]): Promise<number> {
  if (items.length === 0) return 0;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("news_items")
    .upsert(
      items.map((i) => ({
        source_key: i.sourceKey,
        lang: i.lang,
        sector: i.sector,
        title: i.title,
        url: i.url,
        published_at: i.publishedAt,
        raw_summary: i.rawSummary,
      })),
      { onConflict: "url", ignoreDuplicates: true },
    )
    .select("id");

  if (error) throw new Error(`뉴스 저장 실패: ${error.message}`);
  return data?.length ?? 0;
}

/** UI·브리핑용 조회. 최근 수집분을 섹터별로 가져온다. */
export async function listRecentNews(limit = 60): Promise<NewsItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_items")
    .select("id, source_key, lang, sector, title, url, published_at, raw_summary, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[news] 조회 실패:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    sourceKey: r.source_key,
    lang: r.lang as Lang,
    sector: r.sector as Sector,
    title: r.title,
    url: r.url,
    publishedAt: r.published_at,
    rawSummary: r.raw_summary,
    fetchedAt: r.fetched_at,
  }));
}
