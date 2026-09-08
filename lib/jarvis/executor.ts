import "server-only";
import { parseCreateTaskPayload } from "./action-payload";
import { policyForAction } from "./policy";
import { executeCalendarForApprovalForJob, isCalendarExecutorEnabled } from "@/lib/repos/jarvis-calendar-actions";
import { assertWorkFeatureForApprovalForJob } from "@/lib/repos/work-execution-guard";
import type { ApprovalRequest } from "./db-types";
import type { JsonValue } from "./types";
import {
  claimApprovedActionByIdForJob,
  claimNextApprovedActionForJob,
  createTaskForApprovalForJob,
  failApprovalForJob,
} from "@/lib/repos/jarvis-approvals";

export type ExecutionResult = {
  kind: "idle" | "executed" | "failed";
  approvalId?: string;
  result?: JsonValue;
  message?: string;
};

async function executeClaimedApproval(approval: ApprovalRequest, workerId: string): Promise<ExecutionResult> {
  try {
    await assertWorkFeatureForApprovalForJob(approval.id);
    if (policyForAction(approval.actionType) !== "approval") {
      throw new Error(`policy가 실행을 허용하지 않습니다: ${approval.actionType}`);
    }

    if (approval.actionType === "CREATE_TASK") {
      parseCreateTaskPayload(approval.payload);
      const task = await createTaskForApprovalForJob(approval.id, workerId);
      const result: JsonValue = { taskId: task.id, title: task.title };
      return { kind: "executed", approvalId: approval.id, result };
    }

    if (approval.actionType === "CREATE_CALENDAR_EVENT" || approval.actionType === "UPDATE_CALENDAR_EVENT") {
      if (!isCalendarExecutorEnabled()) throw new Error("캘린더 실행 연결이 비활성화되어 있습니다.");
      const calendar = await executeCalendarForApprovalForJob(approval, workerId);
      if (calendar.kind === "verified") return { kind: "executed", approvalId: approval.id, result: { eventId: calendar.eventId, uid: calendar.uid, href: calendar.href } };
      return { kind: "failed", approvalId: approval.id, message: calendar.message };
    }

    throw new Error(`구현되지 않은 action입니다: ${approval.actionType}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failApprovalForJob(approval.id, workerId, message);
    return { kind: "failed", approvalId: approval.id, message };
  }
}

export async function executeNextApprovedAction(workerId: string): Promise<ExecutionResult> {
  const approval = await claimNextApprovedActionForJob(workerId);
  if (!approval) return { kind: "idle" };
  return executeClaimedApproval(approval, workerId);
}

export async function executeApprovedActionById(
  approvalId: string,
  workerId: string,
): Promise<ExecutionResult> {
  const approval = await claimApprovedActionByIdForJob(approvalId, workerId);
  if (!approval) return { kind: "idle", approvalId };
  return executeClaimedApproval(approval, workerId);
}
