import "server-only";
import { newsSourcesFor, type NewsSource } from "@/config/news-sources";
import { parseFeed } from "./rss";
import { insertNewsItems, type NewsInsert } from "@/lib/repos/news";

/** 소스 하나에서 가져올 최대 기사 수. Google News는 100건까지 주는데 전부 넣을 이유가 없다. */
const PER_SOURCE_LIMIT = 15;
const TIMEOUT_MS = 20_000;

export type SourceResult = {
  key: string;
  ok: boolean;
  items: number;
  error?: string;
};

export type FetchNewsResult = {
  sources: number;
  inserted: number;
  failures: SourceResult[];
  results: SourceResult[];
};

/**
 * 뉴스 수집 (SPEC.md 5.2).
 *
 * 소스별로 실패를 격리한다 — 5개 중 1개가 죽어도 나머지 4개는 저장된다.
 * 이게 이 잡의 핵심 요구사항이라 Promise.all로 묶지 않고 개별 처리한다.
 */
export async function fetchNews(now: Date = new Date()): Promise<FetchNewsResult> {
  const sources = newsSourcesFor(now);

  const settled = await Promise.all(sources.map((source) => fetchOne(source)));

  const items = settled.flatMap((s) => s.items);
  const results = settled.map((s) => s.result);
  const inserted = await insertNewsItems(items);

  return {
    sources: sources.length,
    inserted,
    failures: results.filter((r) => !r.ok),
    results,
  };
}

async function fetchOne(source: NewsSource): Promise<{ result: SourceResult; items: NewsInsert[] }> {
  try {
    const response = await fetch(source.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "personal-os/1.0 (+personal dashboard)" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const parsed = parseFeed(await response.text()).slice(0, PER_SOURCE_LIMIT);
    const items: NewsInsert[] = parsed.map((item) => ({
      sourceKey: source.key,
      lang: source.lang,
      sector: source.sector,
      title: item.title,
      url: item.url,
      publishedAt: item.publishedAt,
      rawSummary: item.summary,
    }));

    return { result: { key: source.key, ok: true, items: items.length }, items };
  } catch (e) {
    return {
      result: { key: source.key, ok: false, items: 0, error: e instanceof Error ? e.message : String(e) },
      items: [],
    };
  }
}
