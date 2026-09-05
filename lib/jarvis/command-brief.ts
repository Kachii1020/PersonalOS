import "server-only";
import { buildCommandBrief } from "./brief";
import { listPendingApprovalsForJob } from "@/lib/repos/jarvis-approvals";
import { listTasksForBriefForJob, saveCommandBriefForJob } from "@/lib/repos/jarvis-briefs";

export async function generateCommandBriefForJob(now = new Date()) {
  const [tasks, approvals] = await Promise.all([
    listTasksForBriefForJob(),
    listPendingApprovalsForJob(),
  ]);
  const brief = buildCommandBrief({ tasks, approvals, now });
  await saveCommandBriefForJob(brief);
  return brief;
}
