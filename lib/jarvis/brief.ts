import { selectTopActions } from "./priority";
import type { BriefApproval, BriefTask, CommandBrief } from "./types";

function ymdJst(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(now);
}

export function buildCommandBrief(input: {
  tasks: BriefTask[];
  approvals: BriefApproval[];
  now: Date;
}): CommandBrief {
  const topActions = selectTopActions(input.tasks, input.now, 3);
  const postponedItems = input.tasks
    .filter((task) => task.deferUntil && new Date(task.deferUntil) > input.now)
    .sort((a, b) => new Date(a.deferUntil!).getTime() - new Date(b.deferUntil!).getTime())
    .slice(0, 5)
    .map((task) => ({ taskId: task.id, title: task.title, until: task.deferUntil! }));

  const preparedItems = input.approvals.slice(0, 5).map((approval) => ({
    approvalId: approval.id,
    title: approval.title,
    actionType: approval.actionType,
  }));

  const warnings: string[] = [];
  if (input.tasks.length > 10) warnings.push("열린 할 일이 10개를 넘었습니다. 새 일을 추가하기 전에 낮은 가치의 일을 정리하세요.");
  if (input.approvals.length > 5) warnings.push("승인 대기가 많습니다. 외부 행동을 늘리기 전에 기존 요청부터 검토하세요.");
  if (topActions.length === 3 && topActions.every((task) => task.score >= 85)) {
    warnings.push("긴급도가 높은 일이 세 개 이상입니다. 오늘 새 프로젝트를 시작하지 않는 편이 좋습니다.");
  }

  const headline = topActions.length
    ? `오늘은 ${topActions[0].title}부터 처리합니다.`
    : input.approvals.length
      ? "실행 전 승인이 필요한 항목이 있습니다."
      : "지금 당장 처리할 핵심 행동이 없습니다.";

  return {
    date: ymdJst(input.now),
    headline,
    topActions,
    preparedItems,
    postponedItems,
    warnings,
    sourceSnapshot: {
      openTaskCount: input.tasks.length,
      pendingApprovalCount: input.approvals.length,
      generatedAt: input.now.toISOString(),
    },
  };
}
