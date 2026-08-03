import { NextResponse, type NextRequest } from "next/server";
import { syncCalendars } from "@/lib/integrations/caldav/sync";
import { recordSync } from "@/lib/repos/sync-state";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";

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
    await recordSync("caldav", {
      status: failures.length > 0 ? "failed" : "ok",
      error: failures.length > 0 ? failures.join("\n") : null,
      cursor: { calendars: result.calendars, objectQueries: result.objectQueries },
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordSync("caldav", { status: "failed", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
