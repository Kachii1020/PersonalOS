import ICAL from "ical.js";
import { fromVEvent, type ParsedEvent } from "@/lib/integrations/caldav/parse";

/**
 * MyWaseda 시간표 ICS 파싱 (SPEC.md 5.1b).
 *
 * CalDAV는 객체 하나에 VCALENDAR 하나지만 ICS 피드는 한 파일에 VEVENT가 전부 들어있다.
 * 파싱 실패한 VEVENT는 건너뛰고 건수만 돌려준다 — 한 건 때문에 학기 전체를 잃으면 안 된다.
 */
export function parseIcsFeed(content: string): { events: ParsedEvent[]; skipped: number } {
  let vevents: ICAL.Component[];
  try {
    vevents = new ICAL.Component(ICAL.parse(content)).getAllSubcomponents("vevent");
  } catch (e) {
    throw new Error(`ICS 파싱 실패: ${e instanceof Error ? e.message : String(e)}`);
  }

  const byUid = new Map<string, ParsedEvent>();
  let skipped = 0;

  for (const vevent of vevents) {
    // RECURRENCE-ID가 붙은 예외 인스턴스는 마스터와 uid가 같다. 마스터를 남긴다.
    const isException = vevent.getFirstPropertyValue("recurrence-id") !== null;
    const parsed = fromVEvent(vevent);
    if (!parsed) {
      skipped++;
      continue;
    }
    if (isException && byUid.has(parsed.uid)) continue;
    byUid.set(parsed.uid, parsed);
  }

  return { events: [...byUid.values()], skipped };
}

/**
 * 과목 코드 후보를 뽑는다.
 *
 * MyWaseda가 SUMMARY에 코드를 어떤 모양으로 넣는지 실물 ICS 없이는 확정할 수 없다.
 * 그래서 정규식을 좁게 맞추는 대신 **후보를 넉넉히 뽑고 courses.code와 교집합만 채택**한다.
 * 등록된 과목 코드와 일치할 때만 연결되므로 과다 추출은 해가 없고, 형식이 달라져도 안 깨진다.
 */
export function extractCourseCodes(text: string): string[] {
  const codes = new Set<string>();
  // 숫자를 하나 이상 포함한 3~16자 영숫자 토큰. 괄호·대괄호·전각 괄호는 구분자로만 쓴다.
  for (const m of text.toUpperCase().matchAll(/[A-Z0-9][A-Z0-9-]{2,15}/g)) {
    const token = m[0];
    if (/\d/.test(token)) codes.add(token);
  }
  return [...codes];
}
