import ICAL from "ical.js";

/** 매일 반복이 10년 넘게 이어져도 조회가 멈추지 않게 하는 상한. */
const MAX_OCCURRENCES = 4_000;

export type RecurringMaster = {
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  rrule: string | null;
  exdates?: string[];
};

export type Occurrence = { startsAt: string; endsAt: string };

/**
 * 표시 범위와 겹치는 인스턴스만 돌려준다.
 *
 * rrule이 없으면 마스터 한 건의 겹침만 본다.
 * 전개에 실패하면 마스터가 범위와 겹칠 때만 그걸 돌려준다 — 달력 전체를 죽이지 않는다.
 */
export function expandOccurrences(
  master: RecurringMaster,
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  if (!master.rrule) {
    return overlaps(master.startsAt, master.endsAt, rangeStart, rangeEnd)
      ? [{ startsAt: master.startsAt, endsAt: master.endsAt }]
      : [];
  }

  try {
    return expandRrule(master, rangeStart, rangeEnd);
  } catch (e) {
    console.error(
      `[rrule] 전개 실패 (${master.rrule}):`,
      e instanceof Error ? e.message : e,
    );
    return overlaps(master.startsAt, master.endsAt, rangeStart, rangeEnd)
      ? [{ startsAt: master.startsAt, endsAt: master.endsAt }]
      : [];
  }
}

function expandRrule(
  master: RecurringMaster,
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  const rule = master.rrule!.replace(/^RRULE:/i, "").trim();
  const start = timeFromIso(master.startsAt, master.isAllDay);
  const end = timeFromIso(master.endsAt, master.isAllDay);

  const vevent = new ICAL.Component("vevent");
  vevent.addPropertyWithValue("dtstart", start);
  vevent.addPropertyWithValue("dtend", end);
  vevent.addPropertyWithValue("rrule", ICAL.Recur.fromString(rule));
  for (const iso of master.exdates ?? []) {
    vevent.addPropertyWithValue("exdate", timeFromIso(iso, master.isAllDay));
  }

  const event = new ICAL.Event(vevent);
  const iter = event.iterator();
  const out: Occurrence[] = [];

  let next: ICAL.Time | null;
  let n = 0;
  while ((next = iter.next())) {
    if (++n > MAX_OCCURRENCES) {
      console.error(`[rrule] 전개 상한 ${MAX_OCCURRENCES} 도달, 이후 인스턴스 생략`);
      break;
    }
    const details = event.getOccurrenceDetails(next);
    const startsAt = details.startDate.toJSDate().toISOString();
    const endsAt = details.endDate.toJSDate().toISOString();
    if (new Date(endsAt) <= rangeStart) continue;
    if (new Date(startsAt) >= rangeEnd) break;
    out.push({ startsAt, endsAt });
  }

  return out;
}

function timeFromIso(iso: string, isAllDay: boolean): ICAL.Time {
  const t = ICAL.Time.fromJSDate(new Date(iso), true);
  if (isAllDay) t.isDate = true;
  return t;
}

function overlaps(startsAt: string, endsAt: string, from: Date, to: Date): boolean {
  return new Date(startsAt) < to && new Date(endsAt) > from;
}
