import test from "node:test";
import assert from "node:assert/strict";
import { expandOccurrences } from "@/lib/integrations/caldav/rrule";

const MASTER = {
  startsAt: "2026-01-05T01:00:00.000Z",
  endsAt: "2026-01-05T02:00:00.000Z",
  isAllDay: false,
  rrule: "FREQ=WEEKLY;COUNT=6",
};

test("주간 반복 — 1주일 범위에는 인스턴스가 1~2건만 생긴다", () => {
  const occ = expandOccurrences(
    MASTER,
    new Date("2026-01-12T00:00:00.000Z"),
    new Date("2026-01-19T00:00:00.000Z"),
  );
  assert.deepEqual(
    occ.map((o) => o.startsAt),
    ["2026-01-12T01:00:00.000Z"],
  );
});

test("주간 반복 + EXDATE — 제외 날짜는 결과에 없다", () => {
  const occ = expandOccurrences(
    { ...MASTER, exdates: ["2026-01-19T01:00:00.000Z"] },
    new Date("2026-01-01T00:00:00.000Z"),
    new Date("2026-03-01T00:00:00.000Z"),
  );
  assert.deepEqual(
    occ.map((o) => o.startsAt),
    [
      "2026-01-05T01:00:00.000Z",
      "2026-01-12T01:00:00.000Z",
      "2026-01-26T01:00:00.000Z",
      "2026-02-02T01:00:00.000Z",
      "2026-02-09T01:00:00.000Z",
    ],
  );
  assert.equal(occ.some((o) => o.startsAt.startsWith("2026-01-19")), false);
});

test("UNTIL — 종료일 이후 인스턴스는 없다", () => {
  const occ = expandOccurrences(
    { ...MASTER, rrule: "FREQ=WEEKLY;UNTIL=20260119T010000Z" },
    new Date("2026-01-01T00:00:00.000Z"),
    new Date("2026-03-01T00:00:00.000Z"),
  );
  assert.deepEqual(
    occ.map((o) => o.startsAt),
    ["2026-01-05T01:00:00.000Z", "2026-01-12T01:00:00.000Z", "2026-01-19T01:00:00.000Z"],
  );
});

test("rrule 없는 단건은 겹칠 때만 1건", () => {
  const inside = expandOccurrences(
    { ...MASTER, rrule: null },
    new Date("2026-01-01T00:00:00.000Z"),
    new Date("2026-01-10T00:00:00.000Z"),
  );
  assert.equal(inside.length, 1);
  const outside = expandOccurrences(
    { ...MASTER, rrule: null },
    new Date("2026-02-01T00:00:00.000Z"),
    new Date("2026-02-10T00:00:00.000Z"),
  );
  assert.equal(outside.length, 0);
});

test("잘못된 rrule은 마스터가 범위 안이면 그것만 돌려준다", () => {
  const occ = expandOccurrences(
    { ...MASTER, rrule: "NOT-A-RULE" },
    new Date("2026-01-01T00:00:00.000Z"),
    new Date("2026-01-10T00:00:00.000Z"),
  );
  assert.deepEqual(occ, [{ startsAt: MASTER.startsAt, endsAt: MASTER.endsAt }]);
});
