import ICAL from "ical.js";

export type ParsedEvent = {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  rrule: string | null;
};

/**
 * CalDAV 객체 하나(VCALENDAR)에서 마스터 VEVENT를 뽑는다.
 *
 * 반복 일정은 여기서 전개하지 않는다. RRULE 문자열을 그대로 보관하고,
 * 화면에 필요한 범위만 조회 시점에 전개하는 편이 미러 테이블을 작게 유지한다.
 * RECURRENCE-ID가 붙은 예외 인스턴스는 마스터와 uid가 같아 무시한다.
 *
 * 파싱할 수 없으면 null. 이벤트 하나 때문에 동기화 전체가 멈추면 안 된다.
 */
export function parseEvent(icsText: string): ParsedEvent | null {
  let vevent: ICAL.Component | null = null;
  try {
    const root = new ICAL.Component(ICAL.parse(icsText));
    const candidates = root.getAllSubcomponents("vevent");
    vevent = candidates.find((c) => !c.getFirstPropertyValue("recurrence-id")) ?? candidates[0] ?? null;
  } catch {
    return null;
  }
  if (!vevent) return null;

  const event = new ICAL.Event(vevent);
  const uid = event.uid;
  if (!uid) return null;

  const start = event.startDate;
  if (!start) return null;

  const isAllDay = start.isDate;
  const end = event.endDate ?? addOneDay(start);

  return {
    uid,
    // summary는 not null 컬럼이다. iCloud에는 제목 없는 이벤트가 실제로 존재한다.
    summary: event.summary?.trim() || "(제목 없음)",
    description: event.description?.trim() || null,
    location: event.location?.trim() || null,
    startsAt: start.toJSDate().toISOString(),
    endsAt: end.toJSDate().toISOString(),
    isAllDay,
    rrule: vevent.getFirstPropertyValue("rrule")?.toString() ?? null,
  };
}

function addOneDay(time: ICAL.Time): ICAL.Time {
  const next = time.clone();
  next.addDuration(ICAL.Duration.fromSeconds(86_400));
  return next;
}
