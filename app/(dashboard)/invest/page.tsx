import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { SkeletonLines } from "@/components/ui/skeleton";
import { listTickers } from "@/lib/repos/tickers";
import { latestPrices } from "@/lib/repos/prices";
import { latestFxRate } from "@/lib/repos/fx";
import { listResearchNotes } from "@/lib/repos/research";
import { latestMacroSnapshots, type MacroSnapshot } from "@/lib/repos/macro";
import { monthDayWeekday } from "@/lib/time";

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

      <Suspense
        fallback={
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>리서치 노트</CardTitle>
            </CardHeader>
            <SkeletonLines lines={3} />
          </Card>
        }
      >
        <ResearchNotes />
      </Suspense>

      <Suspense
        fallback={
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>매크로 지표</CardTitle>
            </CardHeader>
            <SkeletonLines lines={3} />
          </Card>
        }
      >
        <MacroIndicators />
      </Suspense>
    </>
  );
}

async function MacroIndicators() {
  let snapshots: MacroSnapshot[];
  try {
    snapshots = await latestMacroSnapshots();
  } catch {
    // 테이블이 아직 없거나 읽기 실패 — 조용히 숨긴다
    return null;
  }

  if (snapshots.length === 0) return null;

  const fred = snapshots.filter((s) => s.source === "fred");
  const ecos = snapshots.filter((s) => s.source === "ecos");

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>매크로 지표</CardTitle>
        <CardHint>FRED · ECOS</CardHint>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="매크로 지표">
          <thead>
            <tr className="border-b border-line text-left text-text-muted">
              <th className="pb-2 pr-4 font-medium">지표</th>
              <th className="pb-2 pr-4 text-right font-medium">값</th>
              <th className="pb-2 pr-4 text-right font-medium">단위</th>
              <th className="pb-2 text-right font-medium">기준일</th>
            </tr>
          </thead>
          <tbody>
            {[...fred, ...ecos].map((s) => (
              <tr key={`${s.source}:${s.seriesId}`} className="border-b border-line/50 last:border-0">
                <td className="py-2 pr-4">
                  <span className="text-text">{s.displayName}</span>
                  <span className="ml-1 rounded bg-accent-soft px-1 py-0.5 text-[10px] text-accent uppercase">
                    {s.source}
                  </span>
                </td>
                <td className="num py-2 pr-4 text-right text-text">{s.value.toFixed(2)}</td>
                <td className="py-2 pr-4 text-right text-text-muted">{s.unit ?? "—"}</td>
                <td className="num py-2 text-right text-text-muted">{s.asOf}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function ResearchNotes() {
  const notes = await listResearchNotes();

  // NOTION_DB_RESEARCH 미설정이면 섹션 자체를 숨긴다
  if (notes.length === 0 && !process.env.NOTION_DB_RESEARCH?.trim()) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>리서치 노트</CardTitle>
        <CardHint>Notion 읽기 전용 · {notes.length}건</CardHint>
      </CardHeader>

      {notes.length === 0 ? (
        <EmptyState message="Notion에서 리서치 노트를 추가하면 여기에 올라옵니다." />
      ) : (
        <ul className="space-y-1">
          {notes.map((note) => (
            <li key={note.id}>
              <a
                href={note.url}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line px-3 py-2 transition-colors hover:border-accent/40"
              >
                <span className="min-w-0 shrink-0 text-sm font-medium text-text transition-colors group-hover:text-accent">
                  {note.title}
                </span>
                {note.ticker && <Badge tone="accent">{note.ticker}</Badge>}
                {note.theme && <Badge>{note.theme}</Badge>}
                {note.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
                {note.thesis && (
                  <span className="basis-full text-xs text-text-muted line-clamp-1">
                    {note.thesis}
                  </span>
                )}
                <span className="num ml-auto shrink-0 text-xs text-text-muted">
                  {monthDayWeekday(note.lastEditedAt)}
                </span>
                <ExternalLink
                  aria-hidden
                  className="size-3.5 shrink-0 text-text-muted transition-colors group-hover:text-accent"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function formatPrice(value: number, currency: string): string {
  if (currency === "KRW") return `₩${value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`;
  if (currency === "JPY") return `¥${value.toLocaleString("ja-JP", { maximumFractionDigits: 0 })}`;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
