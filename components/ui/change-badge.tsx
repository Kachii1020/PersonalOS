import { cn } from "@/lib/design/cn";

/**
 * 등락률 표시 (UX 개선 F12). 방향 아이콘 + 색상 + 배경 pill로 한눈에 읽히게 한다.
 * 시세·환율 등 changePct가 있는 모든 곳에서 재사용한다.
 */
export function ChangeBadge({ pct, className }: { pct: number; className?: string }) {
  const positive = pct >= 0;
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
        positive ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative",
        className,
      )}
    >
      <span aria-hidden="true">{positive ? "▲" : "▼"}</span>
      {positive ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}
