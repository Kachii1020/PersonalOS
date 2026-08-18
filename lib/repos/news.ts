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

/**
 * 잡 전용 조회. 서비스 롤을 쓴다.
 *
 * 세션 클라이언트로 읽으면 크론에는 세션이 없어서 RLS에 막히고, 조회가
 * "0건"으로 보인다. 잡 경로와 UI 경로는 클라이언트를 분리해야 한다.
 */
export async function listRecentNewsForJob(limit = 60): Promise<NewsItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("news_items")
    .select("id, source_key, lang, sector, title, url, published_at, raw_summary, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`뉴스 조회 실패: ${error.message}`);
  return (data ?? []).map(toNewsItem);
}

/** 잡 전용. fetched_at이 cutoff보다 이른 행을 지우고 삭제 건수를 돌려준다. */
export async function pruneNewsFetchedBefore(cutoff: Date): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("news_items")
    .delete()
    .lt("fetched_at", cutoff.toISOString())
    .select("id");

  if (error) throw new Error(`뉴스 정리 실패: ${error.message}`);
  return data?.length ?? 0;
}

/** UI용 조회. 세션 클라이언트를 쓰므로 RLS가 적용된다. */
export async function listRecentNews(limit = 60): Promise<NewsItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_items")
    .select("id, source_key, lang, sector, title, url, published_at, raw_summary, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`뉴스 조회 실패: ${error.message}`);
  return (data ?? []).map(toNewsItem);
}

type NewsSelect = {
  id: string;
  source_key: string;
  lang: string;
  sector: string;
  title: string;
  url: string;
  published_at: string | null;
  raw_summary: string | null;
  fetched_at: string;
};

function toNewsItem(row: NewsSelect): NewsItem {
  return {
    id: row.id,
    sourceKey: row.source_key,
    lang: row.lang as Lang,
    sector: row.sector as Sector,
    title: row.title,
    url: row.url,
    publishedAt: row.published_at,
    rawSummary: row.raw_summary,
    fetchedAt: row.fetched_at,
  };
}
