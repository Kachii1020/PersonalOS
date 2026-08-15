import Link from "next/link";
import { GitFork } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { buttonClass } from "@/components/ui/button";
import { listDailyCommits, type DailyCommits } from "@/lib/repos/github";

/**
 * 대시보드의 'GitHub 잔디' 칸 (SPEC.md 6.1).
 * 최근 90일 커밋 히트맵. SPEC 5.4: "최근 90일" 라벨을 단다.
 */
export async function GithubHeatmapWidget({ className }: { className?: string }) {
  let commits: DailyCommits[];

  try {
    commits = await listDailyCommits(90);
  } catch (e) {
    console.error(e);
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>GitHub 잔디</CardTitle>
        </CardHeader>
        <ErrorState what="GitHub 데이터를 불러오지 못했습니다" fix="GITHUB_USERNAME을 확인하세요." />
      </Card>
    );
  }

  const totalCommits = commits.reduce((s, c) => s + c.commitCount, 0);

  if (commits.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>GitHub 잔디</CardTitle>
          <CardHint>최근 90일</CardHint>
        </CardHeader>
        <EmptyState icon={GitFork} message="GitHub 수집 잡을 실행하면 커밋 히트맵이 표시됩니다." />
      </Card>
    );
  }

  const grid = buildGrid(commits);
  const max = Math.max(...commits.map((c) => c.commitCount), 1);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>GitHub 잔디</CardTitle>
        <CardHint>최근 90일 · {totalCommits} commits</CardHint>
      </CardHeader>

      <div className="overflow-x-auto" role="img" aria-label={`최근 90일 GitHub 커밋 히트맵. 총 ${totalCommits}건`}>
        <div
          className="grid gap-0.5"
          style={{
            gridTemplateRows: "repeat(7, 1fr)",
            gridAutoFlow: "column",
            gridAutoColumns: "minmax(0, 1fr)",
            minWidth: "13rem",
          }}
        >
          {grid.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: ${day.count} commits`}
              className="aspect-square rounded-sm"
              style={{ backgroundColor: cellColor(day.count, max) }}
            />
          ))}
        </div>
      </div>

      <Link href="/portfolio" className={buttonClass({ className: "mt-3 w-full" })}>
        상세 보기
      </Link>
    </Card>
  );
}

type GridDay = { date: string; count: number };

/** 90일치 빈 그리드를 만들고 데이터를 채운다. */
function buildGrid(commits: DailyCommits[]): GridDay[] {
  const map = new Map(commits.map((c) => [c.asOf, c.commitCount]));
  const days: GridDay[] = [];
  const now = new Date();

  // 일요일부터 시작하도록 맞추고 90일 + 패딩
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: map.get(key) ?? 0 });
  }

  // 첫 날이 일요일이 아니면 앞에 빈 칸을 넣는다
  const firstDay = new Date(days[0]!.date).getDay();
  for (let i = 0; i < firstDay; i++) {
    days.unshift({ date: `pad-${i}`, count: -1 }); // -1 = 투명
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
