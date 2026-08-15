import Link from "next/link";
import { LineChart } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { buttonClass } from "@/components/ui/button";
import { ChangeBadge } from "@/components/ui/change-badge";
import { listTickers, type Ticker } from "@/lib/repos/tickers";
import { latestPrices, type PriceSnapshot } from "@/lib/repos/prices";
import { latestFxRate, type FxRate } from "@/lib/repos/fx";

/**
 * 대시보드의 '지수·환율' 칸 (SPEC.md 6.1).
 * 지수 티커만 표시하고, 나머지는 /invest에서 본다.
 * 시세 갱신이 실패해도 마지막 스냅샷을 보여준다 (G3 조건 2).
 */
export async function MarketSnapshotWidget({ className }: { className?: string }) {
  let tickers: Ticker[];
  let prices: PriceSnapshot[];
  let fxUsdKrw: FxRate | null;

  try {
    [tickers, prices, fxUsdKrw] = await Promise.all([
      listTickers(),
      latestPrices(),
      latestFxRate("USD", "KRW"),
    ]);
  } catch (e) {
    console.error(e);
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>지수·환율</CardTitle>
        </CardHeader>
        <ErrorState what="시세를 불러오지 못했습니다" fix="설정에서 잡 로그를 확인하세요." />
      </Card>
    );
  }

  if (tickers.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>지수·환율</CardTitle>
        </CardHeader>
        <EmptyState icon={LineChart} message="시세 잡을 한 번 실행하면 티커가 등록됩니다." />
      </Card>
    );
  }

  const priceMap = new Map(prices.map((p) => [p.tickerId, p]));
  const indices = tickers.filter((t) => t.isIndex);
  const display = indices.length > 0 ? indices : tickers.slice(0, 5);
  const latestDate = prices[0]?.asOf;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>지수·환율</CardTitle>
        {latestDate && <CardHint>{latestDate} 기준</CardHint>}
      </CardHeader>

      <ul className="space-y-2 text-sm" aria-label="시세 목록">
        {display.map((t) => {
          const snap = priceMap.get(t.id);
          return (
            <li key={t.id} className="flex items-baseline justify-between gap-2">
              <span className="truncate text-text-muted">{t.displayName}</span>
              {snap ? (
                <span className="flex shrink-0 items-baseline gap-1.5">
                  <span className="num text-text">{formatPrice(snap.close, t.currency)}</span>
                  {snap.changePct != null && <ChangeBadge pct={snap.changePct} />}
                </span>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </li>
          );
        })}
      </ul>

      {fxUsdKrw && (
        <p className="num mt-3 border-t border-line pt-2 text-xs text-text-muted">
          USD/KRW <CountUp value={fxUsdKrw.rate} decimals={2} />
        </p>
      )}

      <Link href="/invest" className={buttonClass({ className: "mt-3 w-full" })}>
        전체 시세 보기
      </Link>
    </Card>
  );
}

function formatPrice(value: number, currency: string): string {
  if (currency === "KRW") return value.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  if (currency === "JPY") return value.toLocaleString("ja-JP", { maximumFractionDigits: 0 });
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
