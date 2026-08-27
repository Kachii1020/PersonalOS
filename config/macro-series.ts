/**
 * 매크로 지표 시리즈 설정 (SPEC.md 5.3).
 *
 * FRED: https://api.stlouisfed.org/fred/series/observations
 * ECOS: https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/...
 * BIS:  https://stats.bis.org/api/v2/data/dataflow/BIS/{dataflow}/1.0
 */

import type { BisSeriesConfig } from "@/lib/integrations/finance/bis";

export type MacroSeries = {
  source: "fred" | "ecos" | "bis";
  seriesId: string;
  displayName: string;
  unit: string;
  /** ECOS 전용 — 통계 항목 코드 */
  ecosItemCode?: string;
  /** ECOS 전용 — 주기 (MM=월, QQ=분기, DD=일) */
  ecosCycle?: string;
  /** BIS 전용 — dataflow + 필터 파라미터 */
  bisConfig?: Omit<BisSeriesConfig, "seriesId">;
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
    ecosCycle: "M",
    displayName: "한국 기준금리",
    unit: "%",
  },
  {
    source: "ecos",
    seriesId: "901Y009",
    ecosItemCode: "0",
    ecosCycle: "M",
    displayName: "한국 소비자물가지수",
    unit: "Index",
  },

  // ---- BIS (일본) ----
  {
    source: "bis",
    seriesId: "BIS_CBPOL_JP",
    displayName: "일본 정책금리",
    unit: "%",
    bisConfig: {
      dataflow: "WS_CBPOL",
      params: { FREQ: "M", REF_AREA: "JP" },
    },
  },
  {
    source: "bis",
    seriesId: "BIS_RPP_JP",
    displayName: "일본 주거용 부동산 가격",
    unit: "Index",
    bisConfig: {
      dataflow: "WS_SPP",
      params: { FREQ: "Q", REF_AREA: "JP", VALUE: "R" },
    },
  },
  {
    source: "bis",
    seriesId: "BIS_CREDIT_GDP_JP",
    displayName: "일본 민간 신용/GDP",
    unit: "% GDP",
    bisConfig: {
      dataflow: "WS_CREDIT_GAP",
      params: { FREQ: "Q", BORROWERS_CTY: "JP", CG_DTYPE: "A" },
    },
  },
];
