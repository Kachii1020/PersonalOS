import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/design/cn";

type ErrorStateProps = {
  /** 무엇이 실패했는지. 예: "iCloud 동기화 실패" */
  what: string;
  /** 어떻게 고치는지. 예: "앱 전용 암호를 확인하세요." 사과하지 않는다 (SPEC.md 6.4 규칙 11). */
  fix: string;
  /** 재시도 버튼 등. */
  action?: React.ReactNode;
  className?: string;
};

export function ErrorState({ what, fix, action, className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-start gap-3 py-6", className)} role="alert">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-negative" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-text">{what}</p>
          <p className="max-w-prose text-sm text-text-muted">{fix}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
