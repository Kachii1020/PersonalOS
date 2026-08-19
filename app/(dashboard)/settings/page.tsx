import { Suspense } from "react";
import { History, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Badge } from "@/components/ui/badge";
import { SkeletonLines } from "@/components/ui/skeleton";
import { IcsUpload } from "@/components/widgets/ics-upload";
import { PushSettings } from "@/components/widgets/push-settings";
import { hasPushSubscription } from "@/lib/repos/push";
import { listSyncStates } from "@/lib/repos/sync-state";
import { listRecentJobRuns } from "@/lib/repos/job-runs";
import { budgetStatus } from "@/lib/ai/budget";
import { hhmm, monthDayWeekday } from "@/lib/time";

export const metadata = { title: "설정 · Personal OS" };

const SYNC_LABEL: Record<string, string> = {
  caldav: "iCloud 캘린더",
  waseda: "시간표 ICS",
  rss: "뉴스 수집",
  prices: "시세",
  github: "GitHub",
};

export default function SettingsPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold text-text">설정</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<LoadingCard title="연동 상태" />}>
          <Integrations />
        </Suspense>
        <Suspense fallback={<LoadingCard title="AI 예산" />}>
          <Budget />
        </Suspense>
        <Suspense fallback={<LoadingCard title="푸시 알림" />}>
          <PushCard />
        </Suspense>
        <IcsUpload className="lg:col-span-2" />
        <Suspense fallback={<LoadingCard title="동기화 로그" />}>
          <JobLog className="lg:col-span-2" />
        </Suspense>
      </div>
    </>
  );
}

async function PushCard() {
  let subscribed = false;
  try {
    subscribed = await hasPushSubscription();
  } catch (e) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>푸시 알림</CardTitle>
        </CardHeader>
        <ErrorState
          what="구독 상태를 읽지 못했습니다"
          fix={e instanceof Error ? e.message : "0009 마이그레이션이 호스티드에 적용됐는지 확인하세요."}
        />
      </Card>
    );
  }

  const vapidReady = Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim(),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>푸시 알림</CardTitle>
        <CardHint>G4 1 · 4 · 5</CardHint>
      </CardHeader>
      <PushSettings
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null}
        vapidReady={vapidReady}
        subscribedOnServer={subscribed}
      />
    </Card>
  );
}

function LoadingCard({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <SkeletonLines lines={3} />
    </Card>
  );
}

async function Integrations() {
  let states: Awaited<ReturnType<typeof listSyncStates>>;
  try {
    states = await listSyncStates();
  } catch (e) {
    console.error(e);
    return (
      <Card>
        <CardHeader>
          <CardTitle>연동 상태</CardTitle>
        </CardHeader>
        <ErrorState what="연동 상태를 불러오지 못했습니다" fix="잠시 후 새로고침하세요." />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>연동 상태</CardTitle>
      </CardHeader>
      {states.length === 0 ? (
        <EmptyState icon={RefreshCw} message="아직 실행된 동기화가 없습니다. 크론이 돌거나 잡을 수동 실행하면 여기에 상태가 남습니다." />
      ) : (
        <ul className="space-y-2">
          {states.map((state) => (
            <li key={state.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-text">{SYNC_LABEL[state.key] ?? state.key}</span>
                <span className="flex items-baseline gap-2">
                  <Badge tone={state.lastStatus === "ok" ? "positive" : state.lastStatus === "failed" ? "negative" : "neutral"}>
                    {state.lastStatus === "ok" ? "정상" : state.lastStatus === "failed" ? "실패" : "미실행"}
                  </Badge>
                  <span className="num text-xs text-text-muted">
                    {state.lastRunAt ? `${monthDayWeekday(state.lastRunAt)} ${hhmm(state.lastRunAt)}` : "—"}
                  </span>
                </span>
              </div>
              {state.lastError && <p className="text-xs text-negative">{state.lastError.split("\n")[0]}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function Budget() {
  let status: Awaited<ReturnType<typeof budgetStatus>>;
  try {
    status = await budgetStatus();
  } catch (e) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI 예산</CardTitle>
        </CardHeader>
        <ErrorState
          what="예산을 계산하지 못했습니다"
          fix={e instanceof Error ? e.message : "AI_MONTHLY_BUDGET_USD 설정을 확인하세요."}
        />
      </Card>
    );
  }

  const percent = Math.min(100, Math.round(status.ratio * 100));

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 예산</CardTitle>
        <CardHint>이번 달</CardHint>
      </CardHeader>
      <p className="num mb-2 text-xl text-text">
        ${status.spentUsd.toFixed(2)}
        <span className="text-sm text-text-muted"> / ${status.budgetUsd.toFixed(2)}</span>
      </p>
      <div
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="이번 달 AI 예산 사용률"
        className="h-2 w-full overflow-hidden rounded-full bg-accent-soft"
      >
        <div
          className={status.exceeded ? "h-full bg-negative" : status.warn ? "h-full bg-negative" : "h-full bg-accent"}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-text-muted">
        {status.exceeded
          ? "예산을 소진해 AI 호출이 차단됩니다. 다음 달 1일에 초기화됩니다."
          : status.warn
            ? "예산의 80%를 넘었습니다. 남은 호출을 아껴 쓰세요."
            : `${percent}% 사용 중`}
      </p>
    </Card>
  );
}

async function JobLog({ className }: { className?: string }) {
  let runs: Awaited<ReturnType<typeof listRecentJobRuns>>;
  try {
    runs = await listRecentJobRuns();
  } catch (e) {
    console.error(e);
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>동기화 로그</CardTitle>
        </CardHeader>
        <ErrorState what="잡 실행 이력을 불러오지 못했습니다" fix="잠시 후 새로고침하세요." />
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>동기화 로그</CardTitle>
        {runs.length > 0 && <CardHint>최근 {runs.length}건</CardHint>}
      </CardHeader>
      {runs.length === 0 ? (
        <EmptyState icon={History} message="실행 이력이 없습니다. 크론이 잡을 호출하면 여기에 한 줄씩 쌓입니다." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-text-muted">
                <th scope="col" className="pb-1 font-medium">잡</th>
                <th scope="col" className="pb-1 font-medium">상태</th>
                <th scope="col" className="pb-1 text-right font-medium">시각</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-line transition-colors last:border-b-0 hover:bg-accent-soft/30">
                  <td className="py-1.5 text-text">
                    {run.jobName}
                    {run.error && <span className="block text-xs text-negative">{run.error.split("\n")[0]}</span>}
                  </td>
                  <td className="py-1.5">
                    <Badge tone={run.status === "ok" ? "positive" : "negative"}>
                      {run.status === "ok" ? "성공" : "실패"}
                    </Badge>
                  </td>
                  <td className="num py-1.5 text-right text-xs text-text-muted">
                    {monthDayWeekday(run.startedAt)} {hhmm(run.startedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
