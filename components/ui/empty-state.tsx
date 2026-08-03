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
  className?: string;
};

export function EmptyState({ message, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-start gap-3 py-6 text-sm text-text-muted", className)}>
      <p className="max-w-prose">{message}</p>
      {action}
    </div>
  );
}
