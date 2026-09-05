import { ExternalLink, Inbox, Link2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import type { InboxStatus } from "@/lib/jarvis/types";
import { listInboxItems } from "@/lib/repos/jarvis-inbox";
import { captureInboxItem } from "./actions";
import { JarvisActionForm } from "@/components/widgets/jarvis-action-form";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

export const metadata = { title: "JARVIS 인박스 · Personal OS" };

const STATUS_LABEL: Record<InboxStatus, string> = {
  unprocessed: "처리 대기",
  act_now: "지금 행동",
  learn: "학습",
  monitor: "감시",
  archive: "보관",
  failed: "실패",
};

function statusTone(status: InboxStatus): "neutral" | "positive" | "negative" | "accent" {
  if (status === "act_now") return "accent";
  if (status === "learn" || status === "monitor") return "positive";
  if (status === "failed") return "negative";
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

export default async function InboxPage() {
  let items;
  try {
    items = await listInboxItems(50);
  } catch (error) {
    console.error(error);
    return (
      <>
        <h1 className="mb-4 text-xl font-semibold text-text">JARVIS 인박스</h1>
        <Card>
          <ErrorState what="인박스를 불러오지 못했습니다." fix="잠시 후 새로고침하세요. 계속되면 설정에서 연결 상태를 확인하세요." />
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-text">JARVIS 인박스</h1>
        <p className="mt-1 text-sm text-text-muted">폰과 컴퓨터에서 같은 입력함을 사용합니다.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>빠른 캡처</CardTitle>
            <CardHint>행동은 승인 전까지 실행되지 않음</CardHint>
          </CardHeader>
          <JarvisActionForm action={captureInboxItem} className="space-y-3">
            <label className="block text-sm text-text">
              종류
              <select
                name="kind"
                defaultValue="command"
                className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="command">명령</option>
                <option value="note">메모</option>
                <option value="text">텍스트</option>
                <option value="url">URL</option>
              </select>
            </label>

            <label className="block text-sm text-text">
              내용
              <textarea
                name="rawText"
                rows={6}
                maxLength={5_000}
                placeholder={'예: 할 일: Finatext 지원동기 완성\n예: 공부: PostgreSQL window function'}
                className="mt-1 w-full resize-y rounded-xl border border-line bg-bg px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus:ring-2 focus:ring-accent"
              />
            </label>

            <label className="block text-sm text-text">
              URL <span className="text-text-muted">(선택)</span>
              <div className="relative mt-1">
                <Link2 className="pointer-events-none absolute left-3 top-2.5 size-4 text-text-muted" aria-hidden="true" />
                <input
                  name="sourceUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://…"
                  className="w-full rounded-xl border border-line bg-bg py-2 pl-9 pr-3 text-sm text-text outline-none placeholder:text-text-muted focus:ring-2 focus:ring-accent"
                />
              </div>
            </label>

            <Button type="submit" variant="primary" className="w-full">
              <Send className="size-4" aria-hidden="true" />
              JARVIS에 전달
            </Button>
          </JarvisActionForm>
        </Card>

        <div className="space-y-3 lg:col-span-2">
          {items.length === 0 ? (
            <Card>
              <EmptyState icon={Inbox} message="빠른 캡처에 할 일이나 메모를 적으면 여기서 처리 상태를 확인할 수 있습니다." />
            </Card>
          ) : (
            items.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge tone={statusTone(item.status)}>{STATUS_LABEL[item.status]}</Badge>
                    <span className="truncate text-xs text-text-muted">{item.kind}</span>
                  </div>
                  <CardHint>{formatDate(item.createdAt)}</CardHint>
                </CardHeader>

                <p className="whitespace-pre-wrap break-words text-sm font-medium text-text">
                  {item.summary || item.rawText || item.sourceUrl || "첨부 항목"}
                </p>
                {item.classificationReason && (
                  <p className="mt-2 text-xs leading-5 text-text-muted">{item.classificationReason}</p>
                )}
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    원문 열기 <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
