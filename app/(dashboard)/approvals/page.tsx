import { Check, Clock3, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import type { ApprovalRequest } from "@/lib/jarvis/db-types";
import { parseCreateTaskPayload } from "@/lib/jarvis/action-payload";
import { listApprovalRequests } from "@/lib/repos/jarvis-approvals";
import { decideApprovalAction } from "./actions";
import { JarvisActionForm } from "@/components/widgets/jarvis-action-form";
import { ErrorState } from "@/components/ui/error-state";

export const metadata = { title: "JARVIS 승인 · Personal OS" };

const STATUS_LABEL: Record<ApprovalRequest["status"], string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "거절됨",
  expired: "만료됨",
  executing: "실행 중",
  executed: "실행 완료",
  failed: "실패",
};

function tone(status: ApprovalRequest["status"]): "neutral" | "positive" | "negative" | "accent" {
  if (status === "pending" || status === "executing") return "accent";
  if (status === "approved" || status === "executed") return "positive";
  if (status === "rejected" || status === "failed" || status === "expired") return "negative";
  return "neutral";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function payloadLines(request: ApprovalRequest): string[] {
  if (request.actionType === "CREATE_TASK") {
    try {
      const task = parseCreateTaskPayload(request.payload);
      return [
        `제목: ${task.title}`,
        task.dueAt ? `마감: ${formatDate(task.dueAt)}` : "마감: 없음",
        task.estimatedMinutes ? `예상 시간: ${task.estimatedMinutes}분` : "예상 시간: 미지정",
      ];
    } catch {
      return ["payload 형식을 확인할 수 없습니다."];
    }
  }
  return [`행동 유형: ${request.actionType}`];
}

export default async function ApprovalsPage() {
  let requests;
  try {
    requests = await listApprovalRequests(50);
  } catch (error) {
    console.error(error);
    return (
      <>
        <h1 className="mb-4 text-xl font-semibold text-text">JARVIS 승인</h1>
        <Card>
          <ErrorState what="승인 요청을 불러오지 못했습니다." fix="잠시 후 새로고침하세요. 계속되면 설정에서 연결 상태를 확인하세요." />
        </Card>
      </>
    );
  }

  const ordered = [...requests].sort((a, b) => {
    const pending = Number(b.status === "pending") - Number(a.status === "pending");
    return pending || new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
  });

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-text">JARVIS 승인</h1>
        <p className="mt-1 text-sm text-text-muted">외부 상태를 바꾸는 작업은 여기서 검토한 뒤 실행됩니다.</p>
      </div>

      <div className="space-y-3">
        {ordered.length === 0 ? (
          <Card>
            <div className="flex items-center gap-2 py-3 text-sm text-text-muted">
              <ShieldCheck className="size-5" aria-hidden="true" />
              검토할 승인 요청이 없습니다.
            </div>
          </Card>
        ) : (
          ordered.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex min-w-0 items-center gap-2">
                  <Badge tone={tone(request.status)}>{STATUS_LABEL[request.status]}</Badge>
                  <Badge>{request.riskLevel} risk</Badge>
                </div>
                <CardHint>{formatDate(request.requestedAt)}</CardHint>
              </CardHeader>

              <CardTitle>{request.title}</CardTitle>
              <p className="mt-2 text-sm leading-6 text-text-muted">{request.explanation}</p>
              <ul className="mt-3 space-y-1 rounded-xl bg-bg p-3 text-xs text-text-muted">
                {payloadLines(request).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>

              {request.status === "pending" ? (
                <JarvisActionForm action={decideApprovalAction} className="mt-4 space-y-3">
                  <input type="hidden" name="approvalId" value={request.id} />
                  <label className="block text-xs text-text-muted">
                    결정 메모 <span>(선택)</span>
                    <input
                      name="note"
                      maxLength={500}
                      className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" name="decision" value="approved" variant="primary">
                      <Check className="size-4" aria-hidden="true" /> 승인하고 실행
                    </Button>
                    <Button type="submit" name="decision" value="rejected" variant="secondary">
                      <X className="size-4" aria-hidden="true" /> 거절
                    </Button>
                  </div>
                </JarvisActionForm>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-xs text-text-muted">
                  <Clock3 className="size-4" aria-hidden="true" />
                  {request.executedAt
                    ? `실행 ${formatDate(request.executedAt)}`
                    : request.decidedAt
                      ? `결정 ${formatDate(request.decidedAt)}`
                      : STATUS_LABEL[request.status]}
                </div>
              )}

              {request.decisionNote && <p className="mt-2 text-xs text-text-muted">메모: {request.decisionNote}</p>}
              {request.error && <p className="mt-2 text-xs text-negative">{request.error}</p>}
            </Card>
          ))
        )}
      </div>
    </>
  );
}
