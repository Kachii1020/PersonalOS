import test from "node:test";
import assert from "node:assert/strict";
import { NEWS_RETENTION_DAYS, newsPruneCutoff } from "@/lib/integrations/news/retention";

test("뉴스 정리 cutoff — 30일 전", () => {
  const now = new Date("2026-08-18T00:00:00.000Z");
  const cutoff = newsPruneCutoff(now);
  assert.equal(NEWS_RETENTION_DAYS, 30);
  assert.equal(cutoff.toISOString(), "2026-07-19T00:00:00.000Z");

  const age31 = new Date("2026-07-18T00:00:00.000Z");
  const age29 = new Date("2026-07-20T00:00:00.000Z");
  assert.ok(age31 < cutoff, "31일 전 행은 삭제 대상");
  assert.ok(age29 > cutoff, "29일 전 행은 유지");
});
