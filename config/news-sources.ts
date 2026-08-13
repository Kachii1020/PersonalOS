/**
 * 뉴스 소스 정의 (SPEC.md 5.2).
 *
 * 여기 있는 URL은 전부 2026-08-03에 실제로 호출해 200과 유효한 XML을 확인했다.
 * 새 소스를 넣기 전에도 반드시 호출해서 확인할 것 — 기억으로 URL을 짓지 않는다.
 */

export type Lang = "ko" | "en" | "ja";
export type Sector = "finance" | "ai" | "semiconductor" | "it" | "rotating";

export const LANGS: Lang[] = ["ko", "en", "ja"];

/** Google News RSS의 언어·지역 파라미터. */
const LOCALE: Record<Lang, { hl: string; gl: string; ceid: string }> = {
  ko: { hl: "ko", gl: "KR", ceid: "KR:ko" },
  en: { hl: "en-US", gl: "US", ceid: "US:en" },
  ja: { hl: "ja", gl: "JP", ceid: "JP:ja" },
};

/** 고정 섹터 4개의 언어별 검색어. */
const FIXED_QUERIES: Record<Exclude<Sector, "rotating">, Record<Lang, string>> = {
  finance: { ko: "금융시장 금리", en: "monetary policy markets", ja: "金融政策 市場" },
  ai: { ko: "인공지능", en: "artificial intelligence", ja: "生成AI" },
  semiconductor: { ko: "반도체", en: "semiconductor chips", ja: "半導体" },
  it: { ko: "IT 업계", en: "tech industry", ja: "IT業界" },
};

/** 회전 섹터: 요일별로 주제가 바뀐다 (0=일요일). */
const ROTATING: Array<{ topic: string; queries: Record<Lang, string> }> = [
  { topic: "crypto", queries: { ko: "암호화폐 핀테크", en: "cryptocurrency fintech", ja: "暗号資産 フィンテック" } },
  { topic: "energy", queries: { ko: "에너지 산업", en: "energy industry", ja: "エネルギー 産業" } },
  { topic: "bio", queries: { ko: "바이오 헬스케어", en: "biotech healthcare", ja: "バイオ ヘルスケア" } },
  { topic: "defense", queries: { ko: "방위산업", en: "defense industry", ja: "防衛産業" } },
  { topic: "consumer", queries: { ko: "소비재 리테일", en: "consumer retail", ja: "消費財 小売" } },
  { topic: "realestate", queries: { ko: "부동산 인프라", en: "real estate infrastructure", ja: "不動産 インフラ" } },
  { topic: "space", queries: { ko: "우주 항공", en: "space aerospace", ja: "宇宙 航空" } },
];

export type NewsSource = {
  /** news_items.source_key. 소스별 실패를 추적하는 식별자. */
  key: string;
  lang: Lang;
  sector: Sector;
  url: string;
};

function googleNewsUrl(query: string, lang: Lang): string {
  const { hl, gl, ceid } = LOCALE[lang];
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

/**
 * 보조 소스. 언어별 1개씩, 공식 또는 주요 매체의 직접 RSS.
 * Google News가 막히거나 결과가 얕을 때의 보완재다.
 */
const DIRECT_FEEDS: NewsSource[] = [
  { key: "rss:ko:yna-economy", lang: "ko", sector: "finance", url: "https://www.yna.co.kr/rss/economy.xml" },
  { key: "rss:en:fed-press", lang: "en", sector: "finance", url: "https://www.federalreserve.gov/feeds/press_all.xml" },
  { key: "rss:en:nyt-business", lang: "en", sector: "finance", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml" },
  { key: "rss:en:nyt-technology", lang: "en", sector: "it", url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml" },
  { key: "rss:en:nyt-world", lang: "en", sector: "rotating", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml" },
  { key: "rss:ja:itmedia-news", lang: "ja", sector: "it", url: "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 그날 돌 소스 목록. 회전 섹터는 요일에 따라 주제가 달라진다 (기준 시간대 Asia/Tokyo). */
export function newsSourcesFor(date: Date): NewsSource[] {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", weekday: "short" }).format(date);
  const rotating = ROTATING[WEEKDAYS.indexOf(short)] ?? ROTATING[0]!;

  const sources: NewsSource[] = [];

  for (const lang of LANGS) {
    for (const [sector, queries] of Object.entries(FIXED_QUERIES) as Array<
      [Exclude<Sector, "rotating">, Record<Lang, string>]
    >) {
      sources.push({ key: `google:${lang}:${sector}`, lang, sector, url: googleNewsUrl(queries[lang], lang) });
    }
    sources.push({
      key: `google:${lang}:rotating:${rotating.topic}`,
      lang,
      sector: "rotating",
      url: googleNewsUrl(rotating.queries[lang], lang),
    });
  }

  return [...sources, ...DIRECT_FEEDS];
}
