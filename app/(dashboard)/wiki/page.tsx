import { Suspense } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonLines } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listWikiEntries, type WikiEntry } from "@/lib/repos/wiki";
import { listAlgoPatterns } from "@/lib/repos/algo-patterns";
import { refreshWiki } from "@/app/(dashboard)/wiki/actions";
import { monthDayWeekday } from "@/lib/time";

export const metadata = { title: "위키 · Personal OS" };

export default function WikiPage() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text">위키</h1>
        <form action={refreshWiki}>
          <Button type="submit" size="sm">
            <RefreshCw aria-hidden className="size-3.5" />
            새로고침
          </Button>
        </form>
      </div>

      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <CardTitle>실무 지식</CardTitle>
            </CardHeader>
            <SkeletonLines lines={5} />
          </Card>
        }
      >
        <Entries />
      </Suspense>

      <Suspense
        fallback={
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>알고리즘 패턴</CardTitle>
            </CardHeader>
            <SkeletonLines lines={3} />
          </Card>
        }
      >
        <AlgoPatterns />
      </Suspense>
    </>
  );
}

async function AlgoPatterns() {
  const patterns = await listAlgoPatterns();

  // NOTION_DB_ALGO 미설정이면 섹션 자체를 숨긴다
  if (patterns.length === 0 && !process.env.NOTION_DB_ALGO?.trim()) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>알고리즘 패턴</CardTitle>
        <CardHint>Notion 읽기 전용 · {patterns.length}건</CardHint>
      </CardHeader>

      {patterns.length === 0 ? (
        <EmptyState message="Notion에서 알고리즘 패턴을 추가하면 여기에 올라옵니다." />
      ) : (
        <ul className="space-y-1">
          {patterns.map((p) => (
            <li key={p.id}>
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line px-3 py-2 transition-colors hover:border-accent/40"
              >
                <span className="min-w-0 flex-1 basis-full truncate text-sm font-medium text-text transition-colors group-hover:text-accent sm:basis-auto">
                  {p.title}
                </span>
                {p.coreIdea && (
                  <span className="basis-full text-xs text-text-muted line-clamp-1 sm:basis-auto sm:flex-1">
                    {p.coreIdea}
                  </span>
                )}
                {p.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
                <span className="num ml-auto shrink-0 text-xs text-text-muted">
                  {monthDayWeekday(p.lastEditedAt)}
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

async function Entries() {
  let entries: WikiEntry[];
  try {
    entries = await listWikiEntries();
  } catch (e) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>실무 지식</CardTitle>
        </CardHeader>
        <ErrorState
          what="Notion에서 위키를 불러오지 못했습니다"
          fix={e instanceof Error ? e.message : "docs/NOTION-SETUP.md의 절차를 확인하세요."}
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>실무 지식</CardTitle>
        {/* 앱은 Notion을 고치지 않는다 (CLAUDE.md 데이터 소유권). 편집은 Notion에서 한다. */}
        <CardHint>Notion 읽기 전용 · {entries.length}건</CardHint>
      </CardHeader>

      {entries.length === 0 ? (
        <EmptyState message="Notion 위키가 비어 있습니다. Notion에서 항목을 추가하면 여기에 올라옵니다." />
      ) : (
        <ul className="space-y-1">
          {entries.map((entry) => (
            <li key={entry.id}>
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line px-3 py-2 transition-colors hover:border-accent/40"
              >
                <span className="min-w-0 flex-1 basis-full truncate text-sm text-text transition-colors group-hover:text-accent sm:basis-auto">
                  {entry.title}
                </span>
                {entry.status && <Badge tone="accent">{entry.status}</Badge>}
                {entry.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
                <span className="num ml-auto shrink-0 text-xs text-text-muted">
                  {monthDayWeekday(entry.lastEditedAt)}
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
