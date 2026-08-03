import "server-only";
import { monthlyCostUsd } from "@/lib/repos/ai-usage";

export class BudgetExceededError extends Error {
  constructor(
    readonly spentUsd: number,
    readonly budgetUsd: number,
  ) {
    super(`월 AI 예산 소진: $${spentUsd.toFixed(4)} / $${budgetUsd.toFixed(2)}`);
    this.name = "BudgetExceededError";
  }
}

export function monthlyBudgetUsd(): number {
  const raw = process.env.AI_MONTHLY_BUDGET_USD;
  const value = raw ? Number(raw) : NaN;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("환경변수 AI_MONTHLY_BUDGET_USD가 없거나 양수가 아닙니다");
  }
  return value;
}

/** 대시보드 배너용. 80%를 넘으면 경고한다 (SPEC.md 5.5). */
export async function budgetStatus(): Promise<{
  spentUsd: number;
  budgetUsd: number;
  ratio: number;
  warn: boolean;
  exceeded: boolean;
}> {
  const budgetUsd = monthlyBudgetUsd();
  const spentUsd = await monthlyCostUsd();
  const ratio = spentUsd / budgetUsd;
  return { spentUsd, budgetUsd, ratio, warn: ratio >= 0.8, exceeded: ratio >= 1 };
}

/** 호출 직전 검사. 초과면 API를 때리지 않고 예외를 던진다. */
export async function assertWithinBudget(): Promise<void> {
  const budgetUsd = monthlyBudgetUsd();
  const spentUsd = await monthlyCostUsd();
  if (spentUsd >= budgetUsd) throw new BudgetExceededError(spentUsd, budgetUsd);
}
