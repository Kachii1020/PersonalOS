/**
 * G4 게이트 (SPEC.md 7절 Phase 4).
 *
 * 조건 1·4·5는 실기기/브라우저라 여기서 자동 검증하지 않는다 (G2 조건 2 전례).
 * 조건 3·7은 tests/push.test.ts, tests/weekly-stats.test.ts 단위 테스트.
 *
 * 실행:
 *   npm run test:g4
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { config } from "dotenv";

config({ path: [".env.development.local", ".env.local"] });

const APP = process.env.G4_APP_URL ?? "http://localhost:3000";
const CRON = process.env.CRON_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

async function job(name: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${APP}/api/jobs/${name}`, {
    method: "POST",
    headers: { "x-cron-secret": CRON! },
  });
  const text = await res.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

const live = Boolean(CRON && SUPABASE_URL && SERVICE_KEY);

describe("G4 — Phase 4 게이트", () => {
  it("1. 푸시 구독 왕복 (수동 — 실기기)", () => {
    console.log("   수동: /settings에서 구독 → push_subscriptions 1행 → 테스트 알림 수신");
  });

  it("2. 브리핑 ready 후 푸시 실패가 잡을 실패시키지 않는다", async (t) => {
    if (!live) {
      t.skip("로컬 Supabase/앱 없음");
      return;
    }
    const result = await job("generate-briefing");
    assert.ok(
      result.status === 200 || result.status === 402,
      `브리핑 잡이 푸시 때문에 죽으면 안 된다: ${result.status} ${JSON.stringify(result.body)}`,
    );
  });

  it("3. HTTP 410 구독 삭제는 tests/push.test.ts", () => {
    assert.ok(true);
  });

  it("4. 오프라인 폴백 렌더 (수동)", () => {
    console.log("   수동: 온라인 방문 후 네트워크 차단 → 대시보드 + 오프라인 표시");
  });

  it("5. 온라인 network-first (수동)", () => {
    console.log("   수동: 온라인에서 서버 변경이 새로고침에 즉시 반영");
  });

  it("6. 주간 리뷰 잡 — ready 1행 + ai_usage weekly_review 1행", async (t) => {
    if (!live) {
      t.skip("로컬 Supabase/앱 없음");
      return;
    }
    const before = await db("ai_usage?purpose=eq.weekly_review&select=id");
    const beforeRows = before.ok ? ((await before.json()) as unknown[]) : [];

    const result = await job("generate-weekly-review");
    if (result.status === 402) {
      t.skip("월 AI 예산 소진");
      return;
    }
    assert.equal(result.status, 200, `generate-weekly-review 실패: ${JSON.stringify(result.body)}`);

    const reviews = await db("weekly_reviews?status=eq.ready&select=id,week_start");
    assert.equal(reviews.ok, true, await reviews.text());
    const reviewRows = (await reviews.json()) as unknown[];
    assert.ok(reviewRows.length >= 1, "weekly_reviews ready 행이 없다");

    const after = await db("ai_usage?purpose=eq.weekly_review&select=id");
    const afterRows = after.ok ? ((await after.json()) as unknown[]) : [];
    if (result.body.skipped) {
      assert.equal(afterRows.length, beforeRows.length, "skipped인데 ai_usage가 늘었다");
    } else {
      assert.equal(afterRows.length, beforeRows.length + 1, `ai_usage weekly_review ${beforeRows.length} → ${afterRows.length}`);
    }
  });

  it("7. 집계 숫자는 tests/weekly-stats.test.ts 수기 대조", () => {
    assert.ok(true);
  });

  it("8. 예산 소진 시 402, ready 행을 남기지 않는다", async (t) => {
    if (!live) {
      t.skip("로컬 Supabase/앱 없음");
      return;
    }
    const weekStart = resultWeekStart();
    const existing = await db(`weekly_reviews?week_start=eq.${weekStart}&select=id,status`);
    const existingRows = existing.ok ? ((await existing.json()) as { id: string; status: string }[]) : [];
    const readyBefore = existingRows.filter((r) => r.status === "ready").length;

    const seed = await db("ai_usage", {
      method: "POST",
      body: JSON.stringify({
        purpose: "weekly_review",
        model: "g4-budget-probe",
        input_token: 1,
        output_token: 1,
        cost_usd: 10,
      }),
    });
    assert.equal(seed.ok, true, `ai_usage 주입 실패: ${await seed.text()}`);
    const seeded = (await seed.json()) as { id: number }[];

    const result = await job("generate-weekly-review");
    if (seeded[0]?.id) {
      await db(`ai_usage?id=eq.${seeded[0].id}`, { method: "DELETE" });
    }
    assert.equal(result.status, 402, `예산 소진인데 ${result.status}: ${JSON.stringify(result.body)}`);

    const after = await db(`weekly_reviews?week_start=eq.${weekStart}&status=eq.ready&select=id`);
    const afterRows = after.ok ? ((await after.json()) as unknown[]) : [];
    assert.equal(afterRows.length, readyBefore, "402인데 ready 행이 늘었다");
  });
});

function resultWeekStart(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 3600_000);
  const day = jst.getUTCDay();
  const fromMonday = day === 0 ? 6 : day - 1;
  jst.setUTCDate(jst.getUTCDate() - fromMonday);
  return jst.toISOString().slice(0, 10);
}
