import "server-only";

/**
 * SEC EDGAR XBRL API — 미국 종목 분기 재무제표.
 *
 * 엔드포인트: https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json
 * 2026-08-24 curl로 9종목 전부 200 확인.
 *
 * SEC 정책: User-Agent에 연락처를 넣어야 한다.
 * Rate limit: 초당 10건. 우리는 9종목 순차 호출이라 문제 없음.
 */

const BASE = "https://data.sec.gov/api/xbrl/companyfacts";
const USER_AGENT = "personalOS woojin6354@akane.waseda.jp";
const TIMEOUT_MS = 15_000;

/** CIK → symbol 매핑. tickers.ts의 미국 개별 종목 + 금융. */
export const CIK_MAP: Record<string, string> = {
  "0000320193": "AAPL",
  "0000789019": "MSFT",
  "0001652044": "GOOGL",
  "0001018724": "AMZN",
  "0001045810": "NVDA",
  "0001326801": "META",
  "0001318605": "TSLA",
  "0000019617": "JPM",
  "0000886982": "GS",
};

export type FilingFact = {
  cik: string;
  fiscalEnd: string;   // YYYY-MM-DD
  formType: string;    // '10-K' | '10-Q'
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
  totalAssets: number | null;
  equity: number | null;
  filedAt: string | null; // YYYY-MM-DD
};

export type EdgarResult =
  | { ok: true; cik: string; filings: FilingFact[] }
  | { ok: false; cik: string; error: string };

/**
 * 매출 키 후보. 기업마다 쓰는 키가 다르다 (2026-08-24 9종목 검증).
 * - 빅테크: RevenueFromContractWithCustomerExcludingAssessedTax
 * - 은행 (JPM): Revenues
 * - 투자은행 (GS): InterestAndDividendIncomeOperating (차선)
 */
const REVENUE_KEYS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
  "SalesRevenueNet",
  "InterestAndDividendIncomeOperating",
];

type XbrlEntry = {
  end: string;
  val: number;
  form: string;
  filed: string;
  fp?: string;
};

type CompanyFacts = {
  cik: number;
  entityName: string;
  facts: {
    "us-gaap"?: Record<string, { units: Record<string, XbrlEntry[]> }>;
  };
};

/**
 * CIK 하나의 companyfacts를 가져와서 최근 quarterCount개 분기 실적을 추출한다.
 */
export async function fetchEdgarFilings(
  cik: string,
  quarterCount = 4,
): Promise<EdgarResult> {
  const url = `${BASE}/CIK${cik}.json`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, cik, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = (await res.json()) as CompanyFacts;
    const usgaap = data.facts["us-gaap"];
    if (!usgaap) {
      return { ok: false, cik, error: "us-gaap namespace 없음" };
    }

    // 각 지표에서 10-Q/10-K 항목을 뽑아 fiscalEnd 기준으로 합친다
    const revenueEntries = findEntries(usgaap, REVENUE_KEYS, "USD");
    const netIncomeEntries = findEntries(usgaap, ["NetIncomeLoss"], "USD");
    const epsEntries = findEntries(usgaap, ["EarningsPerShareDiluted", "EarningsPerShareBasic"], "USD/shares");
    const assetEntries = findEntries(usgaap, ["Assets"], "USD");
    const equityEntries = findEntries(usgaap, ["StockholdersEquity"], "USD");

    // 모든 fiscal end 날짜를 모은다
    const allEnds = new Set<string>();
    for (const entries of [revenueEntries, netIncomeEntries, epsEntries, assetEntries, equityEntries]) {
      for (const e of entries) allEnds.add(e.end);
    }

    // 최신 quarterCount개만
    const sortedEnds = [...allEnds].sort().reverse().slice(0, quarterCount);

    const byEnd = (entries: XbrlEntry[]) => {
      const map = new Map<string, XbrlEntry>();
      // 같은 end에 여러 항목이면 나중에 filed된 것이 정정이므로 그걸 쓴다
      for (const e of entries) {
        const prev = map.get(e.end);
        if (!prev || e.filed > prev.filed) map.set(e.end, e);
      }
      return map;
    };

    const revMap = byEnd(revenueEntries);
    const niMap = byEnd(netIncomeEntries);
    const epsMap = byEnd(epsEntries);
    const assetMap = byEnd(assetEntries);
    const eqMap = byEnd(equityEntries);

    const filings: FilingFact[] = sortedEnds.map((end) => {
      const rev = revMap.get(end);
      const ni = niMap.get(end);
      const eps = epsMap.get(end);
      const asset = assetMap.get(end);
      const eq = eqMap.get(end);
      // formType: 아무 항목에서나 가져온다
      const formType = rev?.form ?? ni?.form ?? eps?.form ?? "10-Q";
      const filedAt = rev?.filed ?? ni?.filed ?? eps?.filed ?? null;

      return {
        cik,
        fiscalEnd: end,
        formType,
        revenue: rev?.val ?? null,
        netIncome: ni?.val ?? null,
        eps: eps?.val ?? null,
        totalAssets: asset?.val ?? null,
        equity: eq?.val ?? null,
        filedAt,
      };
    });

    return { ok: true, cik, filings };
  } catch (e) {
    return { ok: false, cik, error: e instanceof Error ? e.message : String(e) };
  }
}

/** us-gaap에서 keyList 중 첫 히트를 찾고, 해당 unit의 10-Q/10-K 항목을 반환한다. */
function findEntries(
  usgaap: NonNullable<CompanyFacts["facts"]["us-gaap"]>,
  keyList: string[],
  unitKey: string,
): XbrlEntry[] {
  for (const key of keyList) {
    const fact = usgaap[key];
    if (!fact) continue;
    const units = fact.units[unitKey];
    if (!units || units.length === 0) continue;
    return units.filter((e) => e.form === "10-Q" || e.form === "10-K");
  }
  return [];
}
