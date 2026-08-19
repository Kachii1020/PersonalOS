import { NextResponse, type NextRequest } from "next/server";
import { syncCalendars } from "@/lib/integrations/caldav/sync";
import { lastSyncStatus, recordSync } from "@/lib/repos/sync-state";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";
import { sendPush } from "@/lib/integrations/push/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * iCloud 캘린더 동기화 잡.
 *
 * 실패해도 200이 아니라 500을 돌려주되, 그 전에 sync_state에 기록한다
 * (SPEC.md 5.1 절대 규칙 5). UI 배너는 그 행을 읽는다.
 */
export async function POST(request: NextRequest) {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await syncCalendars();

    const failures = result.logs.filter((l) => l.startsWith("failed:"));
    const nextStatus = failures.length > 0 ? "failed" : "ok";
    const previous = await lastSyncStatus("caldav");
    await recordSync("caldav", {
      status: nextStatus,
      error: failures.length > 0 ? failures.join("\n") : null,
      cursor: { calendars: result.calendars, objectQueries: result.objectQueries },
    });
    if (previous !== "failed" && nextStatus === "failed") {
      await sendPush({
        title: "캘린더 동기화 실패",
        body: failures[0] ?? "iCloud 동기화가 실패했습니다.",
        url: "/settings",
      });
    }

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const previous = await lastSyncStatus("caldav");
    await recordSync("caldav", { status: "failed", error: message });
    if (previous !== "failed") {
      await sendPush({
        title: "캘린더 동기화 실패",
        body: message,
        url: "/settings",
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
