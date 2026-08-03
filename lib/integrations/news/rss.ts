import { XMLParser } from "fast-xml-parser";

export type RssItem = {
  title: string;
  url: string;
  publishedAt: string | null;
  summary: string | null;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

/**
 * RSS 2.0과 Atom을 모두 받는다. 소스마다 형식이 달라 한쪽만 지원하면
 * 나중에 소스를 바꿀 때 파서를 또 건드리게 된다.
 *
 * 파싱 실패는 예외로 올린다 — 호출부가 소스별로 격리한다.
 */
export function parseFeed(xml: string): RssItem[] {
  const doc = parser.parse(xml);

  const rssItems = toArray(doc?.rss?.channel?.item);
  if (rssItems.length > 0) {
    return rssItems.map(fromRss).filter(isValid);
  }

  const atomEntries = toArray(doc?.feed?.entry);
  if (atomEntries.length > 0) {
    return atomEntries.map(fromAtom).filter(isValid);
  }

  throw new Error("RSS/Atom 항목을 찾지 못했습니다");
}

function fromRss(item: Record<string, unknown>): RssItem {
  return {
    title: text(item.title),
    url: text(item.link),
    publishedAt: toIso(text(item.pubDate)),
    summary: text(item.description) || null,
  };
}

function fromAtom(entry: Record<string, unknown>): RssItem {
  const link = entry.link as { "@_href"?: string } | Array<{ "@_href"?: string }> | undefined;
  const href = Array.isArray(link) ? link[0]?.["@_href"] : link?.["@_href"];
  return {
    title: text(entry.title),
    url: href ?? "",
    publishedAt: toIso(text(entry.updated) || text(entry.published)),
    summary: text(entry.summary) || null,
  };
}

function isValid(item: RssItem): boolean {
  return item.title.length > 0 && item.url.startsWith("http");
}

function toArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  if (value && typeof value === "object") return [value as Record<string, unknown>];
  return [];
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  // CDATA나 속성이 섞이면 파서가 객체를 준다.
  if (value && typeof value === "object" && "#text" in value) return String((value as { "#text": unknown })["#text"]).trim();
  return "";
}

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
