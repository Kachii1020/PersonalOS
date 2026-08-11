import { TriangleAlert } from "lucide-react";
import { budgetStatus } from "@/lib/ai/budget";

/**
 * AI 예산 80% 이상이면 대시보드 상단에 경고 배너를 띄운다 (SPEC.md 5.5).
 * AI_MONTHLY_BUDGET_USD가 미설정이면 조용히 숨긴다 — 예산 없으면 경고도 없다.
 */
export async function BudgetBanner() {
  let status: Awaited<ReturnType<typeof budgetStatus>>;
  try {
    status = await budgetStatus();
  } catch {
    // AI_MONTHLY_BUDGET_USD 미설정 등 — 배너를 안 띄운다.
    return null;
  }

  if (!status.warn) return null;

  const pct = Math.round(status.ratio * 100);

  return (
    <div role="alert" className="border-b border-line bg-surface px-4 py-2 lg:px-6">
      <div className="flex items-start gap-2 text-sm">
        <TriangleAlert
          className={`mt-0.5 size-4 shrink-0 ${status.exceeded ? "text-negative" : "text-amber-600 dark:text-amber-400"}`}
          aria-hidden="true"
        />
        <p className="text-text">
          <span className="font-medium">
            {status.exceeded ? "월 AI 예산 소진" : `AI 예산 ${pct}% 사용`}
          </span>{" "}
          <span className="text-text-muted">
            ${status.spentUsd.toFixed(2)} / ${status.budgetUsd.toFixed(2)}
            {status.exceeded
              ? " — 브리핑·퀴즈 생성이 다음 달까지 중단됩니다."
              : " — 남은 예산이 적습니다."}
          </span>
        </p>
      </div>
    </div>
  );
}
