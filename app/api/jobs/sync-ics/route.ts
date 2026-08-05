import { NextResponse, type NextRequest } from "next/server";
import { ingestIcs } from "@/lib/integrations/ics/ingest";
import { recordSync } from "@/lib/repos/sync-state";
import { recordJobRun } from "@/lib/repos/job-runs";
import { rejectUnauthorizedCron } from "@/lib/jobs/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UPLOAD_SOURCE = "upload://mywaseda-timetable";

/**
 * MyWaseda 시간표 ICS 취입 잡 (SPEC.md 5.1b).
 *
 * MyWaseda가 구독 URL을 주는지 파일 다운로드만 주는지 확정되지 않아 두 경로를 다 받는다.
 * - 본문에 ICS 텍스트가 실려오면 그것을 쓴다 (설정 화면의 수동 업로드)
 * - 비어 있으면 WASEDA_ICS_URL을 fetch 한다 (크론)
 * 파싱 이후 로직은 ingestIcs 하나로 합쳐진다.
 */
export async function POST(request: NextRequest) {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date();
  try {
    const { content, sourceUrl } = await acquire(request);
    const result = await ingestIcs(content, { sourceUrl, displayName: "MyWaseda 시간표" });

    await recordJobRun({ jobName: "sync-ics", startedAt, status: "ok", meta: { ...result, sourceUrl } });
    await recordSync("waseda", {
      status: "ok",
      error: null,
      cursor: { events: result.events, matched: result.matched, unmatched: result.unmatched },
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordJobRun({ jobName: "sync-ics", startedAt, status: "failed", error: message });
    await recordSync("waseda", { status: "failed", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function acquire(request: NextRequest): Promise<{ content: string; sourceUrl: string }> {
  const uploaded = (await request.text()).trim();
  if (uploaded) return { content: uploaded, sourceUrl: UPLOAD_SOURCE };

  const url = process.env.WASEDA_ICS_URL;
  if (!url) {
    throw new Error("ICS 원본이 없습니다. 본문에 .ics 내용을 실어 보내거나 WASEDA_ICS_URL을 설정하세요.");
  }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`ICS fetch 실패: ${res.status} ${res.statusText}`);
  return { content: await res.text(), sourceUrl: url };
}
