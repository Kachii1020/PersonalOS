import "server-only";
import ical from "ical-generator";
import { appCalendarName, createCalDavClient } from "./client";
import { extractUid, parseEvent } from "./parse";
import {
  assertWritable,
  deleteEventsMissingFrom,
  getWritableCalendar,
  markCalendarSynced,
  upsertCalendars,
  upsertEvents,
} from "@/lib/repos/events";

export type CalendarScan = {
  name: string;
  skipped: boolean;
  events: number;
  deleted: number;
};

export type SyncResult = {
  calendars: number;
  scans: CalendarScan[];
  eventsUpserted: number;
  eventsDeleted: number;
  /** 실제로 이벤트를 가져온 캘린더 수. 증분 동기화가 도는지 확인하는 값이다. */
  objectQueries: number;
  logs: string[];
};

/**
 * iCloud → Supabase 단방향 미러 (SPEC.md 5.1).
 *
 * 절대 규칙 2: ctag가 그대로면 이벤트를 하나도 가져오지 않는다.
 * 캘린더 하나가 실패해도 나머지는 계속 처리한다 — 공유 캘린더 하나 때문에
 * 내 일정 전체가 멈추면 안 된다.
 */
export async function syncCalendars(): Promise<SyncResult> {
  const client = await createCalDavClient();
  const targetName = appCalendarName();

  const davCalendars = (await client.fetchCalendars()).filter(
    (c) => !c.components || c.components.includes("VEVENT"),
  );

  const rows = await upsertCalendars(
    davCalendars.map((c) => ({
      sourceUrl: c.url,
      displayName: String(c.displayName ?? "(이름 없음)"),
      ctag: c.ctag ?? null,
      isWritable: String(c.displayName ?? "") === targetName,
    })),
  );

  const byUrl = new Map(rows.map((r) => [r.sourceUrl, r]));
  const result: SyncResult = {
    calendars: rows.length,
    scans: [],
    eventsUpserted: 0,
    eventsDeleted: 0,
    objectQueries: 0,
    logs: [],
  };

  for (const dav of davCalendars) {
    const row = byUrl.get(dav.url);
    if (!row) continue;

    const name = row.displayName;
    const remoteCtag = dav.ctag ?? null;

    if (remoteCtag && row.ctag === remoteCtag) {
      result.logs.push(`ctag unchanged, skipped: ${name}`);
      result.scans.push({ name, skipped: true, events: 0, deleted: 0 });
      continue;
    }

    try {
      result.objectQueries += 1;
      const objects = await client.fetchCalendarObjects({ calendar: dav });

      const parsed = objects
        .map((o) => {
          const event = typeof o.data === "string" ? parseEvent(o.data) : null;
          return event ? { ...event, href: o.url, etag: o.etag ?? null } : null;
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      const written = await upsertEvents(row.id, parsed);

      // 삭제 판정은 파싱 성공 집합이 아니라 fetch된 객체의 UID 집합이다.
      // 파싱 실패 객체의 UID를 못 읽으면 오삭제 방지를 위해 ctag를 전진시키지 않는다.
      const keepUids: string[] = [];
      let uidGap = false;
      for (const object of objects) {
        if (typeof object.data !== "string") {
          uidGap = true;
          break;
        }
        const uid = extractUid(object.data);
        if (!uid) {
          uidGap = true;
          break;
        }
        keepUids.push(uid);
      }

      let deleted = 0;
      if (uidGap) {
        result.logs.push(`delete skipped, ctag not advanced: ${name} — UID를 못 읽은 객체 있음`);
      } else {
        deleted = await deleteEventsMissingFrom(row.id, keepUids);
        await markCalendarSynced(row.id, remoteCtag);
      }

      const unparsed = objects.length - parsed.length;
      result.eventsUpserted += written;
      result.eventsDeleted += deleted;
      result.scans.push({ name, skipped: false, events: written, deleted });
      result.logs.push(
        `synced: ${name} — 객체 ${objects.length}건 중 ${parsed.length}건 반영` +
          (deleted > 0 ? `, 삭제 ${deleted}건` : "") +
          (unparsed > 0 ? `, 파싱 실패 ${unparsed}건` : ""),
      );
    } catch (e) {
      // 이 캘린더만 실패로 두고 ctag는 전진시키지 않는다. 다음 실행에서 다시 시도된다.
      result.logs.push(`failed: ${name} — ${e instanceof Error ? e.message : String(e)}`);
      result.scans.push({ name, skipped: false, events: 0, deleted: 0 });
    }
  }

  return result;
}

/**
 * 앱에서 만든 이벤트를 iCloud에 PUT하고 미러에도 반영한다.
 * 쓰기 대상은 앱 전용 캘린더 하나뿐이다 (절대 규칙 3).
 */
export async function createAppEvent(input: {
  summary: string;
  startsAt: Date;
  endsAt: Date;
  description?: string;
  location?: string;
}): Promise<{ uid: string; href: string }> {
  const calendar = await getWritableCalendar();
  assertWritable(calendar);

  const uid = `${crypto.randomUUID()}@personal-os`;
  const filename = `${uid}.ics`;

  const cal = ical({ name: calendar.displayName });
  cal.createEvent({
    id: uid,
    start: input.startsAt,
    end: input.endsAt,
    summary: input.summary,
    description: input.description,
    location: input.location,
  });

  const client = await createCalDavClient();
  const response = await client.createCalendarObject({
    calendar: { url: calendar.sourceUrl },
    filename,
    iCalString: cal.toString(),
  });

  if (!response.ok) {
    throw new Error(`iCloud PUT 실패: ${response.status} ${response.statusText}`);
  }

  const href = new URL(filename, calendar.sourceUrl).toString();
  await upsertEvents(
    calendar.id,
    [
      {
        uid,
        summary: input.summary,
        description: input.description ?? null,
        location: input.location ?? null,
        startsAt: input.startsAt.toISOString(),
        endsAt: input.endsAt.toISOString(),
        isAllDay: false,
        rrule: null,
        exdates: [],
        href,
        etag: null,
      },
    ],
    "app",
  );

  return { uid, href };
}

/**
 * iCloud에서 이벤트를 삭제하고 미러에서도 제거한다.
 * 쓰기 가능한 캘린더의 이벤트만 삭제할 수 있다 (SPEC.md 5.1 절대 규칙 3).
 */
export async function deleteAppEvent(calendarSourceUrl: string, caldavHref: string): Promise<void> {
  const client = await createCalDavClient();

  const response = await client.deleteCalendarObject({
    calendarObject: { url: caldavHref },
  });

  if (!response.ok) {
    throw new Error(`iCloud DELETE 실패: ${response.status} ${response.statusText}`);
  }
}
