import "server-only";
import YahooFinance from "yahoo-finance2";

export type QuoteResult = {
  symbol: string;
  close: number;
  changePct: number | null;
  ok: true;
} | {
  symbol: string;
  error: string;
  ok: false;
};

// yahoo-finance2 v4: 클래스를 new로 인스턴스화해야 한다.
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/**
 * yahoo-finance2로 시세 조회. 종목별로 실패를 격리한다.
 * SPEC.md 5.3: "yahoo-finance2는 예고 없이 깨질 수 있다".
 */
export async function fetchQuotes(symbols: string[]): Promise<QuoteResult[]> {
  return Promise.all(symbols.map(fetchOne));
}

async function fetchOne(symbol: string): Promise<QuoteResult> {
  try {
    const result = await yf.quote(symbol);
    const close =
      result.regularMarketPrice ??
      result.regularMarketPreviousClose;

    if (close == null) {
      return { symbol, error: "가격 데이터 없음", ok: false };
    }

    const prev = result.regularMarketPreviousClose;
    const changePct =
      prev != null && prev > 0
        ? ((close - prev) / prev) * 100
        : null;

    return { symbol, close, changePct, ok: true };
  } catch (e) {
    return {
      symbol,
      error: e instanceof Error ? e.message : String(e),
      ok: false,
    };
  }
}
