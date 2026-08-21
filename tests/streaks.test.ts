import test from "node:test";
import assert from "node:assert/strict";
import { streakFrom } from "@/lib/streaks";

// JST 기준 2026-08-20 낮.
const NOW = new Date("2026-08-20T03:00:00Z");

test("오늘 포함 3일 연속", () => {
  const days = new Set(["2026-08-20", "2026-08-19", "2026-08-18"]);
  assert.equal(streakFrom(days, NOW), 3);
});

test("오늘 기록이 없어도 어제까지 이어졌으면 끊기지 않는다", () => {
  const days = new Set(["2026-08-19", "2026-08-18"]);
  assert.equal(streakFrom(days, NOW), 2);
});

test("하루 빠지면 그 앞은 세지 않는다", () => {
  const days = new Set(["2026-08-20", "2026-08-18", "2026-08-17"]);
  assert.equal(streakFrom(days, NOW), 1);
});

test("기록이 없으면 0", () => {
  assert.equal(streakFrom(new Set(), NOW), 0);
});

test("그저께가 마지막이면 0 (어제도 오늘도 비었다)", () => {
  const days = new Set(["2026-08-18", "2026-08-17"]);
  assert.equal(streakFrom(days, NOW), 0);
});
