import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ParsedEvent } from "@/lib/integrations/caldav/parse";
import { expandOccurrences } from "@/lib/integrations/caldav/rrule";

/**
 * 캘린더·이벤트 데이터 접근 레이어.
 *
 * SPEC.md 5.1 절대 규칙 1: UI는 iCloud를 직접 조회하지 않는다. 화면은 항상 이 미러만 읽는다.
 * 잡 경로는 서비스 롤(RLS 우회), UI 경로는 세션 클라이언트(RLS 적용)를 쓴다.
 */

export type CalendarRow = {
  id: string;
  kind: string;
  sourceUrl: string;
  displayName: string;
  isWritable: boolean;
  ctag: string | null;
  contentHash: string | null;
  lastSyncedAt: string | null;
};

const CALENDAR_COLS = "id, kind, source_url, display_name, is_writable, ctag, content_hash, last_synced_at";

export type EventRow = {
  id: string;
  calendarId: string;
  caldavUid: string;
  summary: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  rrule: string | null;
  source: string;
};

/** 잡 전용: 캘린더 목록을 미러에 반영하고 반영된 행을 돌려준다. */
export async function upsertCalendars(
  calendars: Array<{ sourceUrl: string; displayName: string; ctag: string | null; isWritable: boolean }>,
): Promise<CalendarRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("calendars")
    .upsert(
      calendars.map((c) => ({
        kind: "caldav",
        source_url: c.sourceUrl,
        display_name: c.displayName,
        is_writable: c.isWritable,
        // ctag는 여기서 덮어쓰지 않는다. 이벤트를 실제로 가져온 뒤에 기록해야
        // 중간에 실패했을 때 다음 실행이 건너뛰지 않는다.
      })),
      { onConflict: "source_url" },
    )
    .select(CALENDAR_COLS);

  if (error) throw new Error(`캘린더 저장 실패: ${error.message}`);
  return (data ?? []).map(toCalendarRow);
}

/** 잡 전용: 이벤트를 미러에 upsert하고 반영 건수를 돌려준다. */
export async function upsertEvents(
  calendarId: string,
  events: Array<ParsedEvent & { href: string; etag: string | null }>,
  source: "icloud" | "app" = "icloud",
): Promise<number> {
  if (events.length === 0) return 0;

  const supabase = createAdminClient();
  const { error, count } = await supabase.from("events").upsert(
    events.map((e) => ({
      calendar_id: calendarId,
      caldav_uid: e.uid,
      caldav_href: e.href,
      etag: e.etag,
      summary: e.summary,
      description: e.description,
      location: e.location,
      starts_at: e.startsAt,
      ends_at: e.endsAt,
      is_all_day: e.isAllDay,
      rrule: e.rrule,
      exdates: e.exdates ?? [],
      source,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "calendar_id,caldav_uid", count: "exact" },
  );

  if (error) throw new Error(`이벤트 저장 실패: ${error.message}`);
  return count ?? events.length;
}

/** 잡 전용: 이벤트를 실제로 가져온 뒤에만 ctag를 전진시킨다. */
export async function markCalendarSynced(calendarId: string, ctag: string | null): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("calendars")
    .update({ ctag, last_synced_at: new Date().toISOString() })
    .eq("id", calendarId);

  if (error) throw new Error(`ctag 갱신 실패: ${error.message}`);
}

/**
 * 잡 전용: ICS 소스 캘린더를 등록하거나 가져온다 (SPEC.md 5.1b).
 * is_writable은 항상 false다 — DB check 제약도 kind='ics'의 쓰기를 막는다.
 */
export async function upsertIcsCalendar(sourceUrl: string, displayName: string): Promise<CalendarRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("calendars")
    .upsert(
      { kind: "ics", source_url: sourceUrl, display_name: displayName, is_writable: false },
      // content_hash는 여기서 건드리지 않는다. 파싱을 마친 뒤에 전진시켜야
      // 중간 실패 시 다음 실행이 건너뛰지 않는다.
      { onConflict: "source_url" },
    )
    .select(CALENDAR_COLS)
    .single();

  if (error) throw new Error(`ICS 캘린더 등록 실패: ${error.message}`);
  return toCalendarRow(data);
}

/** 잡 전용: ICS 이벤트를 미러에 반영한다. course_id는 매칭된 건만 채워진다. */
export async function upsertIcsEvents(
  calendarId: string,
  sourceUrl: string,
  events: Array<ParsedEvent & { courseId: string | null }>,
): Promise<number> {
  if (events.length === 0) return 0;

  const supabase = createAdminClient();
  const { error, count } = await supabase.from("events").upsert(
    events.map((e) => ({
      calendar_id: calendarId,
      caldav_uid: e.uid,
      // ICS에는 객체별 href가 없다. uid로 합성해 not null 제약을 만족시킨다.
      caldav_href: `${sourceUrl}#${e.uid}`,
      etag: null,
      summary: e.summary,
      description: e.description,
      location: e.location,
      starts_at: e.startsAt,
      ends_at: e.endsAt,
      is_all_day: e.isAllDay,
      rrule: e.rrule,
      exdates: e.exdates ?? [],
      course_id: e.courseId,
      source: "waseda",
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "calendar_id,caldav_uid", count: "exact" },
  );

  if (error) throw new Error(`ICS 이벤트 저장 실패: ${error.message}`);
  return count ?? events.length;
}

/** 잡 전용: 파싱까지 끝난 뒤에만 content_hash를 전진시킨다. */
export async function markIcsSynced(calendarId: string, contentHash: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("calendars")
    .update({ content_hash: contentHash, last_synced_at: new Date().toISOString() })
    .eq("id", calendarId);

  if (error) throw new Error(`content_hash 갱신 실패: ${error.message}`);
}

/** 잡 전용. 쓰기 대상 캘린더는 정확히 하나여야 한다 (SPEC.md 5.1 절대 규칙 3). */
export async function getWritableCalendar(): Promise<CalendarRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("calendars")
    .select(CALENDAR_COLS)
    .eq("is_writable", true);

  if (error) throw new Error(`쓰기 캘린더 조회 실패: ${error.message}`);

  const rows = data ?? [];
  if (rows.length === 0) {
    throw new Error(
      `쓰기 가능한 캘린더가 없습니다. iCloud에 '${process.env.APP_CALENDAR_NAME ?? "Personal OS"}' 캘린더를 만들고 동기화를 한 번 실행하세요.`,
    );
  }
  if (rows.length > 1) {
    throw new Error(`쓰기 가능한 캘린더가 ${rows.length}개입니다. 정확히 1개여야 합니다.`);
  }
  return toCalendarRow(rows[0]!);
}

/**
 * 쓰기 대상 검증. is_writable이 아니거나 kind가 'caldav'가 아니면 예외를 던진다.
 * PUT을 시도하기 전에 호출한다 (SPEC.md 5.1 절대 규칙 3).
 */
export function assertWritable(calendar: Pick<CalendarRow, "displayName" | "isWritable" | "kind">): void {
  if (calendar.kind !== "caldav") {
    throw new Error(`'${calendar.displayName}'는 kind='${calendar.kind}'라 쓰기 대상이 아닙니다.`);
  }
  if (!calendar.isWritable) {
    throw new Error(`'${calendar.displayName}'는 읽기 전용 캘린더입니다. 앱 전용 캘린더에만 씁니다.`);
  }
}

const EVENT_COLS =
  "id, calendar_id, caldav_uid, summary, description, location, starts_at, ends_at, is_all_day, rrule, exdates, source";

/** UI용 조회. 기간이 겹치는 이벤트(반복은 범위 안 인스턴스)를 시작 시각 순으로 돌려준다. */
export async function listEventsBetween(fromIso: string, toIso: string): Promise<EventRow[]> {
  const rows = await loadEventCandidates(fromIso, toIso, EVENT_COLS);
  return expandEventRows(rows, fromIso, toIso);
}

/** UI용: 이벤트에 쓰기 가능 여부를 붙여서 반환. */
export async function listEventsWithWritableFlag(
  fromIso: string,
  toIso: string,
): Promise<(EventRow & { isDeletable: boolean })[]> {
  const select = `${EVENT_COLS}, calendars!inner(is_writable, kind)`;
  const rows = await loadEventCandidates(fromIso, toIso, select);
  const expanded = expandEventRows(rows, fromIso, toIso);
  const flags = new Map<string, boolean>();
  for (const r of rows) {
    const cal = r.calendars as unknown as { is_writable: boolean; kind: string } | undefined;
    flags.set(r.id, Boolean(cal?.is_writable && cal.kind === "caldav"));
  }
  return expanded.map((e) => ({ ...e, isDeletable: flags.get(e.id) ?? false }));
}

/**
 * 범위와 겹치는 일반 일정 + 시작이 범위 끝 이전인 반복 일정.
 * 과거 마스터를 가진 반복 일정이 `.gt(ends_at, from)`에 걸리지 않게 두 번째로 가져온다.
 */
async function loadEventCandidates(
  fromIso: string,
  toIso: string,
  select: string,
): Promise<EventSelect[]> {
  const supabase = await createClient();
  const overlapping = supabase.from("events").select(select).lt("starts_at", toIso).gt("ends_at", fromIso);
  const recurring = supabase.from("events").select(select).not("rrule", "is", null).lt("starts_at", toIso);
  const [a, b] = await Promise.all([overlapping, recurring]);

  if (a.error) throw new Error(`이벤트 조회 실패: ${a.error.message}`);
  if (b.error) throw new Error(`이벤트 조회 실패: ${b.error.message}`);

  const byId = new Map<string, EventSelect>();
  for (const row of [...(a.data ?? []), ...(b.data ?? [])]) {
    const typed = row as unknown as EventSelect;
    byId.set(typed.id, typed);
  }
  return [...byId.values()];
}

function expandEventRows(rows: EventSelect[], fromIso: string, toIso: string): EventRow[] {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const out: EventRow[] = [];
  for (const r of rows) {
    const base = toEventRow(r);
    const occurrences = expandOccurrences(
      {
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        isAllDay: r.is_all_day,
        rrule: r.rrule,
        exdates: r.exdates ?? [],
      },
      from,
      to,
    );
    for (const occ of occurrences) {
      out.push({ ...base, startsAt: occ.startsAt, endsAt: occ.endsAt });
    }
  }
  out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return out;
}

/** 삭제 전 이벤트 조회. caldav_href와 calendar 정보가 필요하므로 별도 쿼리. */
export async function getEventForDelete(eventId: string): Promise<{
  id: string;
  calendarId: string;
  caldavHref: string;
  summary: string;
  source: string;
  calendar: { sourceUrl: string; isWritable: boolean; kind: string };
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, calendar_id, caldav_href, summary, source, calendars!inner(source_url, is_writable, kind)")
    .eq("id", eventId)
    .single();

  if (error) throw new Error(`이벤트 조회 실패: ${error.message}`);
  const cal = data.calendars as unknown as { source_url: string; is_writable: boolean; kind: string };
  return {
    id: data.id,
    calendarId: data.calendar_id,
    caldavHref: data.caldav_href,
    summary: data.summary,
    source: data.source,
    calendar: { sourceUrl: cal.source_url, isWritable: cal.is_writable, kind: cal.kind },
  };
}

/** 미러에서 이벤트 삭제. CalDAV DELETE 이후에 호출한다. */
export async function deleteEventFromMirror(eventId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw new Error(`이벤트 삭제 실패: ${error.message}`);
}

/**
 * 잡 전용: 이 캘린더에서 keepUids에 없는 행을 지운다.
 * keepUids가 비면 캘린더가 비었다는 뜻이라 전부 지운다.
 */
export async function deleteEventsMissingFrom(calendarId: string, keepUids: string[]): Promise<number> {
  const supabase = createAdminClient();
  const { data: existing, error: readError } = await supabase
    .from("events")
    .select("id, caldav_uid")
    .eq("calendar_id", calendarId);

  if (readError) throw new Error(`이벤트 삭제 대상 조회 실패: ${readError.message}`);

  const keep = new Set(keepUids);
  const toDelete = (existing ?? []).filter((r) => !keep.has(r.caldav_uid)).map((r) => r.id);
  if (toDelete.length === 0) return 0;

  const { error } = await supabase.from("events").delete().in("id", toDelete);
  if (error) throw new Error(`원격 삭제 반영 실패: ${error.message}`);
  return toDelete.length;
}

type EventSelect = {
  id: string;
  calendar_id: string;
  caldav_uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  is_all_day: boolean;
  rrule: string | null;
  exdates: string[] | null;
  source: string;
  calendars?: unknown;
};

function toEventRow(row: EventSelect): EventRow {
  return {
    id: row.id,
    calendarId: row.calendar_id,
    caldavUid: row.caldav_uid,
    summary: row.summary,
    description: row.description,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isAllDay: row.is_all_day,
    rrule: row.rrule,
    source: row.source,
  };
}

type CalendarSelect = {
  id: string;
  kind: string;
  source_url: string;
  display_name: string;
  is_writable: boolean;
  ctag: string | null;
  content_hash: string | null;
  last_synced_at: string | null;
};

function toCalendarRow(row: CalendarSelect): CalendarRow {
  return {
    id: row.id,
    kind: row.kind,
    sourceUrl: row.source_url,
    displayName: row.display_name,
    isWritable: row.is_writable,
    ctag: row.ctag,
    contentHash: row.content_hash,
    lastSyncedAt: row.last_synced_at,
  };
}
