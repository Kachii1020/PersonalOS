import "server-only";

/**
 * BIS SDMX REST API — 국제 매크로 지표.
 *
 * 엔드포인트: https://stats.bis.org/api/v2/data/dataflow/BIS/{dataflow}/1.0
 * 2026-08-24 curl로 CBPOL·RPP·CREDIT_GAP 확인:
 *   - CBPOL (정책금리): ?c[FREQ]=M&c[REF_AREA]=JP
 *   - WS_SPP (부동산가격): ?c[FREQ]=Q&c[REF_AREA]=JP&c[VALUE]=R
 *   - WS_CREDIT_GAP (신용/GDP): ?c[FREQ]=Q&c[BORROWERS_CTY]=JP&c[CG_DTYPE]=A
 *
 * API 키 불필요 (공개 API).
 */

const BASE = "https://stats.bis.org/api/v2/data/dataflow/BIS";
const TIMEOUT_MS = 15_000;

export type BisObservation = {
  date: string;    // YYYY-MM 또는 YYYY-QN
  value: number;
};

export type BisResult =
  | { ok: true; seriesId: string; observations: BisObservation[] }
  | { ok: false; seriesId: string; error: string };

export type BisSeriesConfig = {
  seriesId: string;
  dataflow: string;
  params: Record<string, string>;
};

/** BIS 시리즈를 가져온다. */
export async function fetchBisSeries(
  config: BisSeriesConfig,
  limit = 3,
): Promise<BisResult> {
  const url = new URL(`${BASE}/${config.dataflow}/1.0`);
  for (const [k, v] of Object.entries(config.params)) {
    url.searchParams.set(`c[${k}]`, v);
  }
  url.searchParams.set("lastNObservations", String(limit));

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.sdmx.data+json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, seriesId: config.seriesId, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const json = (await res.json()) as SdmxResponse;

    const timeDim = json.data?.structure?.dimensions?.observation?.[0];
    const timeValues = timeDim?.values ?? [];

    const seriesMap = json.data?.dataSets?.[0]?.series;
    if (!seriesMap || Object.keys(seriesMap).length === 0) {
      return { ok: false, seriesId: config.seriesId, error: "응답에 시리즈 없음" };
    }

    // 첫 번째 시리즈의 observations를 사용
    const firstSeries = Object.values(seriesMap)[0]!;
    const obs = firstSeries.observations ?? {};

    const observations: BisObservation[] = Object.entries(obs)
      .map(([idx, values]) => {
        const timeIdx = Number(idx);
        const timeId = timeIdx < timeValues.length ? timeValues[timeIdx]!.id : `?${idx}`;
        return {
          date: bisTimeToDate(timeId),
          value: Number(values[0]),
        };
      })
      .filter((o) => !isNaN(o.value))
      .sort((a, b) => b.date.localeCompare(a.date)); // 최신 먼저

    return { ok: true, seriesId: config.seriesId, observations };
  } catch (e) {
    return { ok: false, seriesId: config.seriesId, error: e instanceof Error ? e.message : String(e) };
  }
}

/** BIS 시간 형식을 YYYY-MM-DD로 변환. YYYY-QN → 분기 말일, YYYY-MM → 월 1일. */
function bisTimeToDate(time: string): string {
  // 분기: 2025-Q4 → 2025-12-31
  const qMatch = time.match(/^(\d{4})-Q(\d)$/);
  if (qMatch) {
    const year = qMatch[1]!;
    const q = Number(qMatch[2]);
    const month = q * 3;
    const lastDay = new Date(Number(year), month, 0).getDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }
  // 월: 2026-07 → 2026-07-01
  if (/^\d{4}-\d{2}$/.test(time)) return `${time}-01`;
  return time;
}

// SDMX-JSON 응답 타입 (필요한 부분만)
type SdmxResponse = {
  data?: {
    dataSets?: Array<{
      series?: Record<string, {
        observations?: Record<string, [string, ...unknown[]]>;
      }>;
    }>;
    structure?: {
      dimensions?: {
        observation?: Array<{
          id: string;
          values: Array<{ id: string; name: string }>;
        }>;
      };
    };
  };
};
