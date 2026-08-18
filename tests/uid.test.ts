import test from "node:test";
import assert from "node:assert/strict";
import { extractUid, parseEvent } from "@/lib/integrations/caldav/parse";

const VALID = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:weekly-1
DTSTART:20260105T010000Z
DTEND:20260105T020000Z
SUMMARY:Weekly
RRULE:FREQ=WEEKLY;COUNT=2
EXDATE:20260112T010000Z
END:VEVENT
END:VCALENDAR`;

test("extractUid — 정상 ICS에서 UID를 읽는다", () => {
  assert.equal(extractUid(VALID), "weekly-1");
});

test("parseEvent — EXDATE를 ISO로 보관한다", () => {
  const parsed = parseEvent(VALID);
  assert.ok(parsed);
  assert.equal(parsed!.rrule, "FREQ=WEEKLY;COUNT=2");
  assert.deepEqual(parsed!.exdates, ["2026-01-12T01:00:00.000Z"]);
});

test("extractUid — 파싱이 실패해도 UID 줄은 살린다", () => {
  const broken = "BEGIN:VEVENT\nUID:orphan-uid\nDTSTART:not-a-date\nEND:VEVENT";
  assert.equal(extractUid(broken), "orphan-uid");
});

test("extractUid — 접힌 UID 줄을 펼친다", () => {
  const folded = "BEGIN:VEVENT\r\nUID:fold\r\n ed-uid\r\nDTSTART:20260101T000000Z\r\nEND:VEVENT";
  assert.equal(extractUid(folded), "folded-uid");
});

test("extractUid — UID가 없으면 null", () => {
  assert.equal(extractUid("BEGIN:VEVENT\nSUMMARY:no uid\nEND:VEVENT"), null);
});
