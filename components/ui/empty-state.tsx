import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/design/cn";

type EmptyStateProps = {
  /**
   * 다음 행동을 제시하는 문장을 넣는다 (SPEC.md 6.4 규칙 10).
   * "아직 데이터가 없습니다" 같은 문장은 반려 사유다.
   * 예: "티커를 추가하면 여기에 시세가 표시됩니다"
   */
  message: string;
  /** 그 행동을 실제로 할 수 있는 버튼이나 링크. */
  action?: React.ReactNode;
  /** 의도된 빈 화면임을 시각적으로 드러낸다 (UX 개선 F10). 없으면 텍스트만 표시. */
  icon?: LucideIcon;
  className?: string;
};

export function EmptyState({ message, action, icon: Icon, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-start gap-3 py-6 text-sm text-text-muted", className)}>
      {Icon && <Icon className="size-8 text-text-muted/50" aria-hidden="true" strokeWidth={1.5} />}
      <p className="max-w-prose">{message}</p>
      {action}
    </div>
  );
}
