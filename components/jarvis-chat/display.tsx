import type { JsonValue } from "@/lib/jarvis/types";

/** Never turn model text or arbitrary external URLs into clickable fact links. */
export function safeFactHref(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return null;
  try {
    const url = new URL(value, "https://jarvis.invalid");
    if (url.origin !== "https://jarvis.invalid" || !/^\/(tasks|calendar|career|opportunities|today|approvals)(\/|$)/.test(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}

export function observedTime(value: string): string {
  if (!Number.isFinite(Date.parse(value))) return "확인 시각 미상";
  return `${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value))} JST`;
}

const fieldLabels: Record<string, string> = {
  title: "할 일 이름", notes: "메모", dueAt: "마감 시각", category: "분류", priority: "우선순위",
  estimatedMinutes: "예상 소요 시간 (분)", version: "요청 형식 버전", calendarId: "대상 캘린더 ID",
  summary: "일정 이름", startsAt: "시작 시각", endsAt: "종료 시각", timezone: "시간대",
  description: "내용", location: "장소", eventId: "수정할 일정 ID", expectedUid: "현재 일정 식별자",
  expectedEtag: "검토한 일정 버전", beforeSnapshotHash: "변경 전 상태 확인값",
};
const timeFields = new Set(["dueAt", "startsAt", "endsAt"]);

function Value({ value, field }: { value: JsonValue; field: string }) {
  if (value === null) return <span className="text-text-muted">지정하지 않음</span>;
  if (typeof value === "boolean") return <span>{value ? "예" : "아니요"}</span>;
  if (typeof value === "string" && timeFields.has(field)) return <time dateTime={value}>{observedTime(value)}</time>;
  if (typeof value === "string" || typeof value === "number") return <span className="whitespace-pre-wrap break-all">{String(value) || "빈 값"}</span>;
  if (Array.isArray(value)) return value.length ? <ol className="list-inside list-decimal space-y-1">{value.map((item, index) => <li key={index}><Value value={item} field={field} /></li>)}</ol> : <span>빈 목록</span>;
  return <PayloadPreview payload={value} />;
}

/** Iterate every stored field so a newly added execution field cannot be hidden. */
export function PayloadPreview({ payload }: { payload: JsonValue }) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return <Value value={payload} field="payload" />;
  return <dl className="divide-y divide-line text-sm">{Object.entries(payload).map(([key, value]) => <div key={key} className="grid min-w-0 gap-1 py-2 sm:grid-cols-[10rem_minmax(0,1fr)]"><dt className="font-medium text-text-muted">{fieldLabels[key] ?? key}</dt><dd className="min-w-0 break-words text-text"><Value value={value} field={key} /></dd></div>)}</dl>;
}
