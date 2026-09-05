import type { BriefTask, CommandBriefAction } from "./types";

const DAY_MS = 86_400_000;

function dueBonus(dueAt: string | null, now: Date): { points: number; reason: string } {
  if (!dueAt) return { points: 0, reason: "마감 없음" };
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return { points: 0, reason: "마감 형식 확인 필요" };
  const days = (due.getTime() - now.getTime()) / DAY_MS;
  if (days < 0) return { points: 45, reason: "마감 지남" };
  if (days <= 1) return { points: 35, reason: "24시간 이내 마감" };
  if (days <= 3) return { points: 25, reason: "3일 이내 마감" };
  if (days <= 7) return { points: 15, reason: "이번 주 마감" };
  return { points: 3, reason: "향후 마감" };
}

export function scoreTask(task: BriefTask, now: Date): CommandBriefAction | null {
  if (task.deferUntil) {
    const deferred = new Date(task.deferUntil);
    if (!Number.isNaN(deferred.getTime()) && deferred > now) return null;
  }

  const base = task.priority ?? 50;
  const due = dueBonus(task.dueAt, now);
  const effortPenalty = (task.estimatedMinutes ?? 0) > 90 ? 5 : 0;
  const score = Math.max(0, Math.min(100, base + due.points - effortPenalty));
  const reasons = [due.reason];
  if (task.priority !== null) reasons.push(`우선도 ${task.priority}`);
  if (effortPenalty) reasons.push("긴 작업");

  return {
    taskId: task.id,
    title: task.title,
    score,
    reason: reasons.join(" · "),
    dueAt: task.dueAt,
    estimatedMinutes: task.estimatedMinutes,
  };
}

export function selectTopActions(tasks: BriefTask[], now: Date, limit = 3): CommandBriefAction[] {
  return tasks
    .map((task) => scoreTask(task, now))
    .filter((task): task is CommandBriefAction => task !== null)
    .sort((a, b) => b.score - a.score || compareDue(a.dueAt, b.dueAt) || a.title.localeCompare(b.title))
    .slice(0, Math.max(0, Math.min(limit, 3)));
}

function compareDue(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}
