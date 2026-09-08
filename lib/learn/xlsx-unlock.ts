import { CORE_LAB_IDS } from "./core-track";
import type { WorkbookSubmission, XlsxTask } from "./types";

/** nav + basic-fn + logic + lookup 핵심. */
export const PHASE1_CORE_LAB_IDS = CORE_LAB_IDS.filter((id) =>
  /^(nav|basic-fn|logic|lookup)-/.test(id),
);

/** data-clean + fin-fn 핵심. 피벗 핵심은 0개라 여기 없다. */
export const PHASE2_CORE_LAB_IDS = CORE_LAB_IDS.filter((id) => /^(clean|fin)-/.test(id));

export const PACK_TASK_IDS = ["hands", "pivot", "pq", "convention", "contrast"] as const;

type SubmissionRow = Pick<WorkbookSubmission, "taskId" | "status">;

function hasAll(have: ReadonlySet<string>, need: readonly string[]): boolean {
  return need.every((id) => have.has(id));
}

function passedIds(submissions: readonly SubmissionRow[]): Set<string> {
  return new Set(submissions.filter((row) => row.status === "passed").map((row) => row.taskId));
}

export function canSubmitXlsx(
  task: XlsxTask,
  completions: readonly string[],
  submissions: readonly SubmissionRow[],
): boolean {
  const done = new Set(completions);
  const packs = passedIds(submissions);

  switch (task.unlock) {
    case "always":
      return true;
    case "after-phase1-cores":
      return hasAll(done, PHASE1_CORE_LAB_IDS);
    case "after-phase2-cores":
      return hasAll(done, PHASE1_CORE_LAB_IDS) && hasAll(done, PHASE2_CORE_LAB_IDS);
    case "after-packs":
      return hasAll(done, CORE_LAB_IDS) && PACK_TASK_IDS.every((id) => packs.has(id));
  }
}

export function canSubmitTask(
  task: XlsxTask,
  completions: readonly string[],
  submissions: readonly SubmissionRow[],
): boolean {
  return canSubmitXlsx(task, completions, submissions);
}
