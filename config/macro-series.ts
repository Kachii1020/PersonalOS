/**
 * 매크로 지표 시리즈 설정 (SPEC.md 5.3).
 *
 * FRED: https://api.stlouisfed.org/fred/series/observations
 * ECOS: https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/...
 */

export type MacroSeries = {
  source: "fred" | "ecos";
  seriesId: string;
  displayName: string;
  unit: string;
  /** ECOS 전용 — 통계 항목 코드 */
  ecosItemCode?: string;
  /** ECOS 전용 — 주기 (MM=월, QQ=분기, DD=일) */
  ecosCycle?: string;
};

export const MACRO_SERIES: MacroSeries[] = [
  // ---- FRED (미국) ----
  { source: "fred", seriesId: "FEDFUNDS", displayName: "미국 기준금리", unit: "%" },
  { source: "fred", seriesId: "CPIAUCSL", displayName: "미국 CPI", unit: "Index" },
  { source: "fred", seriesId: "UNRATE", displayName: "미국 실업률", unit: "%" },
  { source: "fred", seriesId: "DGS10", displayName: "미국 10년물 국채", unit: "%" },

  // ---- ECOS (한국) ----
  {
    source: "ecos",
    seriesId: "722Y001",
    ecosItemCode: "0101000",
    ecosCycle: "MM",
    displayName: "한국 기준금리",
    unit: "%",
  },
  {
    source: "ecos",
    seriesId: "901Y009",
    ecosItemCode: "0",
    ecosCycle: "MM",
    displayName: "한국 소비자물가지수",
    unit: "Index",
  },
];
