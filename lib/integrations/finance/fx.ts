import "server-only";

const BASE_URL = "https://api.frankfurter.app";
const TIMEOUT_MS = 15_000;

type FrankfurterResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

export type FxResult = {
  asOf: string;
  pairs: Array<{ base: string; quote: string; rate: number }>;
};

/**
 * frankfurter.app에서 최신 환율을 가져온다.
 * SPEC.md: KRW/USD 병기를 위한 환율.
 */
export async function fetchFxRates(
  base: string,
  quotes: string[],
): Promise<FxResult> {
  const url = `${BASE_URL}/latest?from=${base}&to=${quotes.join(",")}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`frankfurter.app HTTP ${res.status}`);
  }

  const data = (await res.json()) as FrankfurterResponse;
  return {
    asOf: data.date,
    pairs: Object.entries(data.rates).map(([quote, rate]) => ({
      base: data.base,
      quote,
      rate,
    })),
  };
}
