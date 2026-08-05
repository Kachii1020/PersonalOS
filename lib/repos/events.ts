import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ParsedEvent } from "@/lib/integrations/caldav/parse";

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

/** UI용 조회. 기간이 겹치는 이벤트를 시작 시각 순으로 돌려준다. */
export async function listEventsBetween(fromIso: string, toIso: string): Promise<EventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, calendar_id, caldav_uid, summary, description, location, starts_at, ends_at, is_all_day, rrule, source")
    .lt("starts_at", toIso)
    .gt("ends_at", fromIso)
    .order("starts_at", { ascending: true });

  // 실패를 빈 배열로 바꾸면 "일정 없음"과 구분이 안 된다 (CLAUDE.md: 실패는 조용하지 않다).
  if (error) throw new Error(`이벤트 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    calendarId: r.calendar_id,
    caldavUid: r.caldav_uid,
    summary: r.summary,
    description: r.description,
    location: r.location,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    isAllDay: r.is_all_day,
    rrule: r.rrule,
    source: r.source,
  }));
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
