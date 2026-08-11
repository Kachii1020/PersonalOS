import "server-only";

/**
 * FRED API — 미국 매크로 지표 (SPEC.md 5.3).
 *
 * 엔드포인트: https://api.stlouisfed.org/fred/series/observations
 * 2026-08-12 curl로 200 확인 (키 없을 때 400 "api_key is not set").
 */

export type FredObservation = {
  date: string;     // YYYY-MM-DD
  value: number;
};

export type FredResult =
  | { ok: true; seriesId: string; observations: FredObservation[] }
  | { ok: false; seriesId: string; error: string };

const BASE = "https://api.stlouisfed.org/fred/series/observations";

/**
 * 최근 N개 관측치를 가져온다.
 * FRED_API_KEY가 없으면 에러를 반환한다 (앱을 죽이지 않는다).
 */
export async function fetchFredSeries(
  seriesId: string,
  limit = 3,
): Promise<FredResult> {
  const apiKey = process.env.FRED_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, seriesId, error: "FRED_API_KEY가 설정되지 않았습니다." };
  }

  const url = new URL(BASE);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", String(limit));

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, seriesId, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const json = (await res.json()) as {
      observations?: Array<{ date: string; value: string }>;
    };

    const observations = (json.observations ?? [])
      .filter((o) => o.value !== ".")
      .map((o) => ({ date: o.date, value: Number(o.value) }));

    return { ok: true, seriesId, observations };
  } catch (e) {
    return { ok: false, seriesId, error: e instanceof Error ? e.message : String(e) };
  }
}
