import { Suspense } from "react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Badge } from "@/components/ui/badge";
import { SkeletonLines } from "@/components/ui/skeleton";
import { DailyBriefing } from "@/components/widgets/daily-briefing";
import { listBriefings } from "@/lib/repos/briefings";

export const metadata = { title: "브리핑 · Personal OS" };

export default function BriefingPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold text-text">브리핑</h1>
      <div className="space-y-4">
        <Suspense
          fallback={
            <Card glass>
              <CardHeader>
                <CardTitle>오늘의 브리핑</CardTitle>
              </CardHeader>
              <SkeletonLines lines={6} />
            </Card>
          }
        >
          <DailyBriefing />
        </Suspense>

        <Suspense
          fallback={
            <Card>
              <CardHeader>
                <CardTitle>아카이브</CardTitle>
              </CardHeader>
              <SkeletonLines lines={4} />
            </Card>
          }
        >
          <Archive />
        </Suspense>
      </div>
    </>
  );
}

async function Archive() {
  let rows: Awaited<ReturnType<typeof listBriefings>>;
  try {
    rows = await listBriefings();
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>아카이브</CardTitle>
        </CardHeader>
        <ErrorState what="아카이브를 불러오지 못했습니다" fix="잠시 후 새로고침하세요." />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>아카이브</CardTitle>
        {rows.length > 0 && <CardHint>{rows.length}일치</CardHint>}
      </CardHeader>
      {rows.length === 0 ? (
        <EmptyState message="지난 브리핑이 없습니다. 브리핑 잡이 하루 한 번 돌면 여기에 쌓입니다." />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="num text-text">{row.briefingDate}</span>
              <span className="flex items-baseline gap-2">
                <Badge tone={row.status === "ready" ? "positive" : row.status === "failed" ? "negative" : "neutral"}>
                  {row.status === "ready" ? "생성됨" : row.status === "failed" ? "실패" : "대기"}
                </Badge>
                <span className="num text-xs text-text-muted">섹션 {row.sectionCount}</span>
                <span className="num w-16 text-xs text-text-muted">
                  {row.costUsd === null ? "—" : `$${row.costUsd.toFixed(3)}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
