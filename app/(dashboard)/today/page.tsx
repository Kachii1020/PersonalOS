import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, PauseCircle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { buildLiveCommandBrief } from "@/lib/repos/jarvis-briefs";
import { ErrorState } from "@/components/ui/error-state";
import { TodayCareerSummary } from "@/components/career/summary";

export const metadata = { title: "Today · JARVIS · Personal OS" };

function formatDue(value: string | null): string {
  if (!value) return "마감 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function TodayPage() {
  let brief;
  try {
    brief = await buildLiveCommandBrief(new Date());
  } catch (error) {
    console.error(error);
    return (
      <>
        <h1 className="mb-4 text-xl font-semibold text-text">Today</h1>
        <Card>
          <ErrorState what="오늘의 JARVIS 브리프를 만들지 못했습니다." fix="잠시 후 새로고침하세요. 계속되면 설정에서 연결 상태를 확인하세요." />
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">JARVIS</p>
          <h1 className="mt-1 text-xl font-semibold text-text">Today</h1>
        </div>
        <CardHint>JST · {brief.date}</CardHint>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{brief.headline}</CardTitle>
          <Badge tone="accent">핵심 {brief.topActions.length}개</Badge>
        </CardHeader>
        <p className="text-sm text-text-muted">
          열린 할 일 {brief.sourceSnapshot.openTaskCount}개 · 승인 대기 {brief.sourceSnapshot.pendingApprovalCount}개
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>지금 할 일</CardTitle>
              <CardHint>최대 3개만 노출</CardHint>
            </CardHeader>
            {brief.topActions.length === 0 ? (
              <div className="flex items-center gap-2 py-3 text-sm text-text-muted">
                <CheckCircle2 className="size-5 text-positive" aria-hidden="true" />
                급하게 처리할 열린 할 일이 없습니다.
              </div>
            ) : (
              <ol className="space-y-3">
                {brief.topActions.map((action, index) => (
                  <li key={action.taskId} className="rounded-xl bg-bg p-3">
                    <div className="flex items-start gap-3">
                      <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-text">{action.title}</p>
                          <Badge>{action.score}점</Badge>
                        </div>
                        <p className="mt-1 text-xs text-text-muted">{action.reason}</p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-muted">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="size-3.5" aria-hidden="true" /> {formatDue(action.dueAt)}
                          </span>
                          {action.estimatedMinutes && <span>예상 {action.estimatedMinutes}분</span>}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <Link href="/tasks" className={buttonClass({ variant: "ghost", className: "mt-3" })}>
              전체 할 일 보기 <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Card>

          <TodayCareerSummary />

          {brief.warnings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>주의</CardTitle>
                <AlertTriangle className="size-5 text-negative" aria-hidden="true" />
              </CardHeader>
              <ul className="space-y-2 text-sm leading-6 text-text-muted">
                {brief.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>승인 대기</CardTitle>
              <ShieldCheck className="size-5 text-accent" aria-hidden="true" />
            </CardHeader>
            {brief.preparedItems.length === 0 ? (
              <p className="text-sm text-text-muted">검토할 외부 행동이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {brief.preparedItems.map((item) => (
                  <li key={item.approvalId} className="rounded-xl bg-bg p-3 text-sm text-text">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-text-muted">{item.actionType}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/approvals" className={buttonClass({ variant: "secondary", className: "mt-3 w-full" })}>
              승인함 열기
            </Link>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>미룬 일</CardTitle>
              <PauseCircle className="size-5 text-text-muted" aria-hidden="true" />
            </CardHeader>
            {brief.postponedItems.length === 0 ? (
              <p className="text-sm text-text-muted">현재 보류 중인 일이 없습니다.</p>
            ) : (
              <ul className="space-y-2 text-sm text-text-muted">
                {brief.postponedItems.map((item) => (
                  <li key={item.taskId}>
                    <span className="block font-medium text-text">{item.title}</span>
                    <span>{formatDue(item.until)} 이후 다시 검토</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
