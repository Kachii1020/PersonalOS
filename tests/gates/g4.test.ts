/**
 * G4 gate: real job calls against an explicitly isolated local stack.
 * Manual/device and separately executed unit conditions are reported as skipped.
 * Run serially with the app using the same database and AI budget configuration.
 */
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { config } from "dotenv";
import type { Database } from "../../lib/types/database";
import { assertIsolatedGateDatabase } from "./local-fixtures";

config({ path: [".env.development.local", ".env.local"] });

const APP = process.env.G4_APP_URL ?? "http://localhost:3000";
const CRON = process.env.CRON_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = Boolean(CRON && SUPABASE_URL && SERVICE_KEY);
type Review = Database["public"]["Tables"]["weekly_reviews"]["Row"];

async function db(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
}

/** Assertion message arguments are evaluated eagerly: consume the body once. */
async function rows<T = { id: number }>(response: Promise<Response>): Promise<T[]> {
  const res = await response;
  const text = await res.text();
  assert.equal(res.ok, true, `DB request failed: ${res.status} ${text}`);
  return text ? JSON.parse(text) as T[] : [];
}

async function job(name: string) {
  const res = await fetch(`${APP}/api/jobs/${name}`, {
    method: "POST",
    headers: { "x-cron-secret": CRON! },
  });
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text) as Record<string, unknown> };
}

function resultWeekStart(): string {
  const jst = new Date(Date.now() + 9 * 3600_000);
  const day = jst.getUTCDay();
  jst.setUTCDate(jst.getUTCDate() - (day === 0 ? 6 : day - 1));
  return jst.toISOString().slice(0, 10);
}

/** Protect pre-existing review contents/IDs on success and on assertion failure. */
async function withReviewFixture(run: (weekStart: string) => Promise<void>) {
  const weekStart = resultWeekStart();
  const path = `weekly_reviews?week_start=eq.${weekStart}`;
  const saved = await rows<Review>(db(`${path}&select=*`));
  try {
    await rows(db(path, { method: "DELETE" }));
    await run(weekStart);
  } finally {
    await rows(db(path, { method: "DELETE" }));
    if (saved.length) await rows(db("weekly_reviews", { method: "POST", body: JSON.stringify(saved) }));
    assert.deepEqual(await rows<Review>(db(`${path}&select=*`)), saved, "Review fixture restoration failed");
  }
}

async function withExhaustedBudget(run: (probeId: number) => Promise<void>) {
  const budget = Number(process.env.AI_MONTHLY_BUDGET_USD);
  assert.ok(Number.isFinite(budget) && budget > 0, "AI_MONTHLY_BUDGET_USD must match the running app and be positive");
  const marker = `g4-budget-probe:${crypto.randomUUID()}`;
  try {
    const [probe] = await rows(db("ai_usage", {
      method: "POST",
      body: JSON.stringify({
        purpose: "weekly_review", model: marker,
        input_token: 0, output_token: 0, cost_usd: Math.max(budget, 1),
      }),
    }));
    assert.ok(probe, "Budget probe was not created");
    await run(probe.id);
  } finally {
    // The unique marker also covers a committed insert whose response was lost.
    await rows(db(`ai_usage?model=eq.${marker}`, { method: "DELETE" }));
    assert.equal((await rows(db(`ai_usage?model=eq.${marker}`))).length, 0);
  }
}

describe("G4 — Phase 4 게이트", { concurrency: false }, () => {
  before(() => {
    if (live) assertIsolatedGateDatabase(SUPABASE_URL, APP);
  });

  it("1. 푸시 구독 왕복 (수동 — 실기기)", (t) => {
    t.skip("실기기 /settings 구독 → DB 저장 → 테스트 알림 수신은 별도 확인");
  });

  it("2. 브리핑 ready 후 푸시 실패가 잡을 실패시키지 않는다", async (t) => {
    if (!live) return t.skip("로컬 Supabase/앱 없음");
    const result = await job("generate-briefing");
    assert.ok(result.status === 200 || result.status === 402, JSON.stringify(result));
  });

  it("3. HTTP 410 구독 삭제는 tests/push.test.ts", (t) => {
    t.skip("npm run test:unit에서 별도 실행 — 이 항목만으로 통과 판정하지 않음");
  });

  it("4. 오프라인 폴백 렌더 (수동)", (t) => {
    t.skip("실제 오프라인 기기 검증은 별도 확인");
  });

  it("5. 온라인 network-first (수동)", (t) => {
    t.skip("실기기의 새로고침/서버 변경 반영은 별도 확인");
  });

  it("6. 주간 리뷰를 새로 생성하면 ready 1행 + ai_usage weekly_review 1행", async (t) => {
    if (!live) return t.skip("로컬 Supabase/앱 없음");
    await withReviewFixture(async (weekStart) => {
      const beforeRows = await rows(db("ai_usage?purpose=eq.weekly_review&select=id"));
      const result = await job("generate-weekly-review");
      if (result.status === 402) return t.skip("월 AI 예산 소진 — 새 생성 미검증");
      assert.equal(result.status, 200, JSON.stringify(result));
      assert.equal(result.body.skipped, false, "Fresh-generation gate must not accept cached success");
      const reviews = await rows<Review>(db(`weekly_reviews?week_start=eq.${weekStart}&status=eq.ready&select=*`));
      assert.equal(reviews.length, 1);
      const afterRows = await rows(db("ai_usage?purpose=eq.weekly_review&select=id"));
      assert.equal(afterRows.length, beforeRows.length + 1);
      console.log("   증거: 새 주간 리뷰 ready 1행, weekly_review ai_usage 정확히 +1행; 원래 리뷰 복원");
    });
  });

  it("7. 집계 숫자는 tests/weekly-stats.test.ts 수기 대조", (t) => {
    t.skip("npm run test:unit에서 별도 실행 — 이 항목만으로 통과 판정하지 않음");
  });

  it("8. 예산 소진 시 새 생성은 402, ready/AI 사용량을 추가하지 않는다", async (t) => {
    if (!live) return t.skip("로컬 Supabase/앱 없음");
    await withReviewFixture(async (weekStart) => {
      await withExhaustedBudget(async () => {
        const beforeRows = await rows(db("ai_usage?select=id"));
        const result = await job("generate-weekly-review");
        assert.equal(result.status, 402, JSON.stringify(result));
        assert.equal(result.body.kind, "BudgetExceededError");
        assert.equal((await rows(db(`weekly_reviews?week_start=eq.${weekStart}&status=eq.ready&select=id`))).length, 0);
        assert.deepEqual(await rows(db("ai_usage?select=id&order=id")), [...beforeRows].sort((a, b) => a.id - b.id));
        console.log("   증거: cache 없는 새 생성 HTTP 402, ready 0행, AI 사용량 변화 없음; budget probe 제거");
      });
    });
  });

  it("회귀: 이미 준비된 리뷰는 예산 소진 중에도 AI 호출 없이 캐시를 반환한다", async (t) => {
    if (!live) return t.skip("로컬 Supabase/앱 없음");
    await withReviewFixture(async (weekStart) => {
      const cached = await rows<Review>(db("weekly_reviews", {
        method: "POST",
        body: JSON.stringify({ week_start: weekStart, status: "ready", content: { stats: {}, narrative: {}, upcoming: {} } }),
      }));
      await withExhaustedBudget(async () => {
        const beforeRows = await rows(db("ai_usage?select=id&order=id"));
        const result = await job("generate-weekly-review");
        assert.equal(result.status, 200, JSON.stringify(result));
        assert.equal(result.body.skipped, true);
        assert.deepEqual(await rows<Review>(db(`weekly_reviews?week_start=eq.${weekStart}&select=*`)), cached);
        assert.deepEqual(await rows(db("ai_usage?select=id&order=id")), beforeRows);
        console.log("   증거: ready 캐시 HTTP 200/skipped, 리뷰·사용량 변화 없음 (실제 AI 생성과 구분)");
      });
    });
  });
});
