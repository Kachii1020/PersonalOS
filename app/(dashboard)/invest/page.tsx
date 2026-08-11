import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listTickers } from "@/lib/repos/tickers";
import { latestPrices } from "@/lib/repos/prices";
import { latestFxRate } from "@/lib/repos/fx";

export const metadata = { title: "투자 · Personal OS" };

/**
 * SPEC.md 6.2: /invest — 티커 목록, 리서치 노트, 시세.
 * 전 티커의 최신 시세를 테이블로 보여준다.
 * KRW/USD 병기는 fx_rates의 당일 환율 사용 (G3 조건 3).
 */
export default async function InvestPage() {
  const [tickers, prices, fxUsdKrw] = await Promise.all([
    listTickers(),
    latestPrices(),
    latestFxRate("USD", "KRW"),
  ]);

  const priceMap = new Map(prices.map((p) => [p.tickerId, p]));
  const latestDate = prices[0]?.asOf;
  const krwRate = fxUsdKrw?.rate ?? null;

  return (
    <>
      <header className="mb-4 flex items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold text-text">투자</h1>
        {latestDate && <p className="text-xs text-text-muted">{latestDate} 기준</p>}
      </header>

      {fxUsdKrw && (
        <p className="num mb-4 text-sm text-text-muted">
          USD/KRW {fxUsdKrw.rate.toFixed(2)} ({fxUsdKrw.asOf})
        </p>
      )}

      {tickers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>티커</CardTitle>
          </CardHeader>
          <EmptyState message="시세 잡을 한 번 실행하면 기본 20개 티커가 등록됩니다." />
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>티커</CardTitle>
            <CardHint>{tickers.length}종목</CardHint>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="티커 시세 목록">
              <thead>
                <tr className="border-b border-line text-left text-text-muted">
                  <th className="pb-2 pr-4 font-medium">종목</th>
                  <th className="pb-2 pr-4 text-right font-medium">종가</th>
                  {krwRate && <th className="pb-2 pr-4 text-right font-medium">₩ 환산</th>}
                  <th className="pb-2 text-right font-medium">등락</th>
                </tr>
              </thead>
              <tbody>
                {tickers.map((t) => {
                  const snap = priceMap.get(t.id);
                  const krwPrice =
                    snap && krwRate && t.currency === "USD"
                      ? snap.close * krwRate
                      : null;

                  return (
                    <tr key={t.id} className="border-b border-line/50 last:border-0">
                      <td className="py-2 pr-4">
                        <span className="font-medium text-text">{t.displayName}</span>
                        <span className="ml-1 text-text-muted">{t.symbol}</span>
                        {t.isIndex && (
                          <span className="ml-1 rounded bg-accent-soft px-1 py-0.5 text-[10px] text-accent">지수</span>
                        )}
                      </td>
                      <td className="num py-2 pr-4 text-right text-text">
                        {snap ? formatPrice(snap.close, t.currency) : "—"}
                      </td>
                      {krwRate && (
                        <td className="num py-2 pr-4 text-right text-text-muted">
                          {krwPrice != null ? `₩${Math.round(krwPrice).toLocaleString("ko-KR")}` : "—"}
                        </td>
                      )}
                      <td className="num py-2 text-right">
                        {snap?.changePct != null ? (
                          <span className={snap.changePct >= 0 ? "text-positive" : "text-negative"}>
                            {snap.changePct >= 0 ? "+" : ""}
                            {snap.changePct.toFixed(2)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function formatPrice(value: number, currency: string): string {
  if (currency === "KRW") return `₩${value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`;
  if (currency === "JPY") return `¥${value.toLocaleString("ja-JP", { maximumFractionDigits: 0 })}`;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
