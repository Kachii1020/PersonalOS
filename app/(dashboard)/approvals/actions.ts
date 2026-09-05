"use server";

import { revalidatePath } from "next/cache";
import { executeApprovedActionById } from "@/lib/jarvis/executor";
import { decideApproval } from "@/lib/repos/jarvis-approvals";

export async function decideApprovalAction(formData: FormData): Promise<void> {
  const approvalId = String(formData.get("approvalId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!approvalId) throw new Error("승인 요청 ID가 없습니다.");
  if (decision !== "approved" && decision !== "rejected") {
    throw new Error("승인 또는 거절만 선택할 수 있습니다.");
  }

  await decideApproval(approvalId, decision, note || null);

  if (decision === "approved") {
    const result = await executeApprovedActionById(approvalId, `approval-ui-${crypto.randomUUID()}`);
    if (result.kind === "failed") throw new Error(result.message ?? "승인 작업 실행에 실패했습니다.");
  }

  revalidatePath("/approvals");
  revalidatePath("/inbox");
  revalidatePath("/today");
  revalidatePath("/tasks");
  revalidatePath("/");
}
