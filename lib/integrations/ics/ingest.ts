import "server-only";
import { createHash } from "node:crypto";
import { parseIcsFeed, extractCourseCodes } from "@/lib/integrations/ics/parse";
import { upsertIcsCalendar, upsertIcsEvents, markIcsSynced } from "@/lib/repos/events";
import { courseCodeMapForJob } from "@/lib/repos/courses";

export type IcsIngestResult = {
  skipped: boolean;
  events: number;
  matched: number;
  unmatched: number;
  unparsed: number;
  /** 코드가 안 잡힌 일정 제목 표본. 정규식을 나중에 고치려고 남긴다 (SPEC.md 5.1b). */
  unmatchedSamples: string[];
};

/**
 * MyWaseda ICS 취입 (SPEC.md 5.1b).
 *
 * 입력 획득 방법(라이브 URL fetch / 수동 업로드)만 호출부에서 갈리고,
 * 파싱 이후는 전부 이 함수 하나를 지난다.
 */
export async function ingestIcs(
  content: string,
  opts: { sourceUrl: string; displayName: string },
): Promise<IcsIngestResult> {
  const hash = createHash("sha256").update(content).digest("hex");
  const calendar = await upsertIcsCalendar(opts.sourceUrl, opts.displayName);

  // 내용이 그대로면 파싱 자체를 하지 않는다. 학기 시간표는 거의 안 바뀐다.
  if (calendar.contentHash === hash) {
    return { skipped: true, events: 0, matched: 0, unmatched: 0, unparsed: 0, unmatchedSamples: [] };
  }

  const { events, skipped: unparsed } = parseIcsFeed(content);
  const codeToCourse = await courseCodeMapForJob();

  const unmatchedSamples: string[] = [];
  let matched = 0;

  const linked = events.map((e) => {
    const haystack = `${e.summary} ${e.description ?? ""} ${e.location ?? ""}`;
    const courseId = extractCourseCodes(haystack)
      .map((code) => codeToCourse.get(code))
      .find((id): id is string => id !== undefined) ?? null;

    if (courseId) matched++;
    else if (unmatchedSamples.length < 5) unmatchedSamples.push(e.summary);

    return { ...e, courseId };
  });

  const written = await upsertIcsEvents(calendar.id, opts.sourceUrl, linked);
  await markIcsSynced(calendar.id, hash);

  return {
    skipped: false,
    events: written,
    matched,
    unmatched: events.length - matched,
    unparsed,
    unmatchedSamples,
  };
}
