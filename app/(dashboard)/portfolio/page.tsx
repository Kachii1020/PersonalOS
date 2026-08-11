import { ExternalLink } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listRepos, listDailyCommits, type DailyCommits } from "@/lib/repos/github";

export const metadata = { title: "포트폴리오 · Personal OS" };

/**
 * SPEC.md 6.2: /portfolio — GitHub 레포·활동.
 * 90일 커밋 잔디 + 레포 목록.
 */
export default async function PortfolioPage() {
  const [repos, commits] = await Promise.all([
    listRepos(),
    listDailyCommits(90),
  ]);

  const totalCommits = commits.reduce((s, c) => s + c.commitCount, 0);

  return (
    <>
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-text">포트폴리오</h1>
      </header>

      {/* 잔디 히트맵 */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>커밋 잔디</CardTitle>
          <CardHint>최근 90일 · {totalCommits} commits</CardHint>
        </CardHeader>

        {commits.length === 0 ? (
          <EmptyState message="GitHub 수집 잡을 실행하면 커밋 히트맵이 표시됩니다." />
        ) : (
          <Heatmap commits={commits} />
        )}
      </Card>

      {/* 레포 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>공개 레포</CardTitle>
          <CardHint>{repos.length}개</CardHint>
        </CardHeader>

        {repos.length === 0 ? (
          <EmptyState message="GitHub 수집 잡을 실행하면 공개 레포가 표시됩니다." />
        ) : (
          <ul className="divide-y divide-line" aria-label="GitHub 레포 목록">
            {repos.map((r) => (
              <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <a
                      href={r.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                    >
                      {r.fullName.split("/")[1]}
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                    {r.description && (
                      <p className="mt-0.5 truncate text-sm text-text-muted">{r.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-text-muted">
                    {r.language && <span>{r.language}</span>}
                    {r.stars > 0 && <span>★ {r.stars}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Heatmap({ commits }: { commits: DailyCommits[] }) {
  const grid = buildGrid(commits);
  const max = Math.max(...commits.map((c) => c.commitCount), 1);

  return (
    <div className="overflow-x-auto" role="img" aria-label={`최근 90일 GitHub 커밋 히트맵`}>
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateRows: "repeat(7, 1fr)",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(0, 1fr)",
          minWidth: "32rem",
        }}
      >
        {grid.map((day) => (
          <div
            key={day.date}
            title={day.count >= 0 ? `${day.date}: ${day.count} commits` : undefined}
            className="aspect-square rounded-sm"
            style={{ backgroundColor: cellColor(day.count, max) }}
          />
        ))}
      </div>
    </div>
  );
}

type GridDay = { date: string; count: number };

function buildGrid(commits: DailyCommits[]): GridDay[] {
  const map = new Map(commits.map((c) => [c.asOf, c.commitCount]));
  const days: GridDay[] = [];
  const now = new Date();

  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: map.get(key) ?? 0 });
  }

  const firstDay = new Date(days[0]!.date).getDay();
  for (let i = 0; i < firstDay; i++) {
    days.unshift({ date: `pad-${i}`, count: -1 });
  }

  return days;
}

function cellColor(count: number, max: number): string {
  if (count < 0) return "transparent";
  if (count === 0) return "var(--color-accent-soft)";
  const ratio = count / max;
  if (ratio <= 0.25) return "var(--color-accent-muted, oklch(0.7 0.1 160))";
  if (ratio <= 0.5) return "var(--color-accent, oklch(0.6 0.15 160))";
  if (ratio <= 0.75) return "oklch(0.5 0.15 160)";
  return "oklch(0.4 0.15 160)";
}
