/**
 * 기본 티커 20개. settings UI에서 편집 가능하지만 초기 시드로 사용한다.
 * symbol은 yahoo-finance2가 이해하는 형식.
 */
export interface TickerSeed {
  symbol: string;
  displayName: string;
  currency: "USD" | "KRW" | "JPY";
  isIndex: boolean;
}

export const DEFAULT_TICKERS: TickerSeed[] = [
  // ── 미국 지수 ──
  { symbol: "^GSPC", displayName: "S&P 500", currency: "USD", isIndex: true },
  { symbol: "^IXIC", displayName: "NASDAQ", currency: "USD", isIndex: true },
  { symbol: "^DJI", displayName: "Dow Jones", currency: "USD", isIndex: true },

  // ── 아시아 지수 ──
  { symbol: "^N225", displayName: "Nikkei 225", currency: "JPY", isIndex: true },
  { symbol: "^KS11", displayName: "KOSPI", currency: "KRW", isIndex: true },

  // ── 미국 빅테크 ──
  { symbol: "AAPL", displayName: "Apple", currency: "USD", isIndex: false },
  { symbol: "MSFT", displayName: "Microsoft", currency: "USD", isIndex: false },
  { symbol: "GOOGL", displayName: "Alphabet", currency: "USD", isIndex: false },
  { symbol: "AMZN", displayName: "Amazon", currency: "USD", isIndex: false },
  { symbol: "NVDA", displayName: "NVIDIA", currency: "USD", isIndex: false },
  { symbol: "META", displayName: "Meta", currency: "USD", isIndex: false },
  { symbol: "TSLA", displayName: "Tesla", currency: "USD", isIndex: false },

  // ── 반도체 ──
  { symbol: "TSM", displayName: "TSMC", currency: "USD", isIndex: false },
  { symbol: "005930.KS", displayName: "삼성전자", currency: "KRW", isIndex: false },

  // ── 일본 ──
  { symbol: "7203.T", displayName: "Toyota", currency: "JPY", isIndex: false },
  { symbol: "6758.T", displayName: "Sony", currency: "JPY", isIndex: false },
  { symbol: "9984.T", displayName: "SoftBank", currency: "JPY", isIndex: false },

  // ── 금융 ──
  { symbol: "JPM", displayName: "JPMorgan", currency: "USD", isIndex: false },
  { symbol: "GS", displayName: "Goldman Sachs", currency: "USD", isIndex: false },

  // ── 크립토 ──
  { symbol: "BTC-USD", displayName: "Bitcoin", currency: "USD", isIndex: false },
];
