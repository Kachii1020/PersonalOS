import "server-only";

/**
 * 한국은행 ECOS API — 한국 매크로 지표 (SPEC.md 5.3).
 *
 * 엔드포인트: https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/...
 * 2026-08-12 curl로 도달 확인 (키 무효 시 INFO-100).
 */

export type EcosObservation = {
  date: string;     // YYYY-MM-DD (월별이면 말일로 변환)
  value: number;
};

export type EcosResult =
  | { ok: true; seriesId: string; observations: EcosObservation[] }
  | { ok: false; seriesId: string; error: string };

const BASE = "https://ecos.bok.or.kr/api/StatisticSearch";

/**
 * ECOS 통계 시리즈를 가져온다.
 * ECOS_API_KEY가 없으면 에러를 반환한다 (앱을 죽이지 않는다).
 *
 * 경로 패턴:
 * /{key}/json/kr/{startNo}/{endNo}/{statCode}/{cycle}/{startDate}/{endDate}/{itemCode1}
 */
export async function fetchEcosSeries(
  seriesId: string,
  itemCode: string,
  cycle: string,
  limit = 3,
): Promise<EcosResult> {
  const apiKey = process.env.ECOS_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, seriesId, error: "ECOS_API_KEY가 설정되지 않았습니다." };
  }

  // 최근 데이터를 가져오기 위해 날짜 범위를 넉넉하게 잡는다
  const now = new Date();
  const endDate = formatYM(now);
  const startDate = formatYM(new Date(now.getFullYear() - 1, now.getMonth(), 1));

  const url = [
    BASE,
    apiKey,
    "json",
    "kr",
    "1",
    String(limit),
    seriesId,
    cycle,
    startDate,
    endDate,
    itemCode,
  ].join("/");

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, seriesId, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const json = (await res.json()) as {
      StatisticSearch?: { row?: Array<{ TIME: string; DATA_VALUE: string }> };
      RESULT?: { CODE: string; MESSAGE: string };
    };

    // ECOS 에러 응답
    if (json.RESULT?.CODE && json.RESULT.CODE !== "INFO-000") {
      return { ok: false, seriesId, error: `${json.RESULT.CODE}: ${json.RESULT.MESSAGE}` };
    }

    const rows = json.StatisticSearch?.row ?? [];
    const observations: EcosObservation[] = rows
      .filter((r) => r.DATA_VALUE && r.DATA_VALUE !== "-")
      .map((r) => ({
        date: ecosTimeToDate(r.TIME),
        value: Number(r.DATA_VALUE),
      }))
      .sort((a, b) => b.date.localeCompare(a.date)); // 최신 먼저

    return { ok: true, seriesId, observations };
  } catch (e) {
    return { ok: false, seriesId, error: e instanceof Error ? e.message : String(e) };
  }
}

/** YYYYMM → YYYY-MM-01 */
function ecosTimeToDate(time: string): string {
  if (time.length === 6) return `${time.slice(0, 4)}-${time.slice(4, 6)}-01`;
  if (time.length === 8) return `${time.slice(0, 4)}-${time.slice(4, 6)}-${time.slice(6, 8)}`;
  return time; // 그대로
}

function formatYM(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}
