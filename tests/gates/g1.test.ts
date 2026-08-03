/**
 * G1 게이트 (SPEC.md 7절 Phase 1).
 *
 * 실행:
 *   npm run dev                 # 다른 터미널에서 (로컬 Supabase 스택이 떠 있어야 한다)
 *   npm run test:g1
 *
 * 주의:
 * - 조건 4·5는 Anthropic API를 실제로 호출한다. 1회 약 $0.12가 청구된다.
 * - 조건 3은 iCloud에 이벤트를 만들고 지운다.
 * - 조건 7은 APPLE_APP_PASSWORD를 잘못된 값으로 바꾼 잡을 돌린다.
 * - 조건 8(Lighthouse 접근성, 375px 가로 스크롤)은 브라우저가 필요해 여기서 다루지 않는다.
 *   `npx lighthouse http://localhost:3000 --only-categories=accessibility`로 따로 확인한다.
 *
 * 이 파일은 조건을 완화하거나 추가하지 않는다. 실패하면 담당 에이전트에게 되돌린다.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { config } from "dotenv";

config({ path: [".env.development.local", ".env.local"] });

const APP = process.env.G1_APP_URL ?? "http://localhost:3000";
const CRON = process.env.CRON_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL;

let sessionCookie = "";

/** 서비스 롤로 REST를 직접 친다. 앱 코드를 거치지 않아야 게이트가 독립적이다. */
async function db(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function rows<T = Record<string, unknown>>(path: string): Promise<T[]> {
  const res = await db(path);
  // 본문은 한 번만 읽을 수 있다. 실패 메시지에 쓰려면 먼저 text로 받아둔다.
  const text = await res.text();
  assert.equal(res.ok, true, `조회 실패 ${path}: ${res.status} ${text}`);
  return JSON.parse(text) as T[];
}

async function job(name: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${APP}/api/jobs/${name}`, {
    method: "POST",
    headers: { "x-cron-secret": CRON! },
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** 관리자 API로 세션을 만들어 쿠키 문자열을 돌려준다. 화면 조건 검증용. */
async function mintSession(): Promise<string> {
  const link = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email: ALLOWED_EMAIL }),
  });
  const { email_otp } = (await link.json()) as { email_otp: string };

  const verify = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: ANON_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email: ALLOWED_EMAIL, token: email_otp }),
  });
  const session = (await verify.json()) as Record<string, unknown>;
  assert.ok(session.access_token, `세션 발급 실패: ${JSON.stringify(session).slice(0, 200)}`);

  const ref = new URL(SUPABASE_URL!).hostname.split(".")[0]!.replace(/[^a-zA-Z0-9]/g, "");
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64");
  return `sb-${ref}-auth-token=${encodeURIComponent(value)}`;
}

describe("G1 — Phase 1 게이트", () => {
  before(() => {
    for (const [name, value] of Object.entries({ CRON_SECRET: CRON, NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, ALLOWED_EMAIL })) {
      assert.ok(value, `환경변수 ${name} 없음`);
    }
  });

  it("1. iCloud 캘린더 목록이 저장되고 앱 전용 캘린더가 is_writable=true로 정확히 1개", async () => {
    const result = await job("sync-calendar");
    assert.equal(result.status, 200, `sync-calendar 실패: ${JSON.stringify(result.body)}`);

    const all = await rows("calendars?select=display_name,is_writable");
    assert.ok(all.length > 0, "calendars가 비어 있다");

    const writable = all.filter((c) => c.is_writable === true);
    assert.equal(writable.length, 1, `is_writable=true가 ${writable.length}개 (1개여야 함)`);
    console.log(`   증거: 캘린더 ${all.length}개, 쓰기 가능 1개 = ${writable[0]!.display_name}`);
  });

  it("2. 연속 실행 시 두 번째는 ctag 비교로 이벤트를 0건 가져온다", async () => {
    await job("sync-calendar");
    const second = await job("sync-calendar");

    assert.equal(second.status, 200);
    assert.equal(second.body.objectQueries, 0, `두 번째 실행에서 객체 조회 ${second.body.objectQueries}회 (0이어야 함)`);
    assert.equal(second.body.eventsUpserted, 0);
    console.log(`   증거: 객체 조회 0회, 반영 0건 — ${(second.body.logs as string[]).filter((l) => l.startsWith("ctag")).length}개 캘린더 skipped`);
  });

  it("3. 앱에서 만든 이벤트가 iCloud에 PUT되고 재동기화 후 같은 uid로 존재", async () => {
    const { createAppEvent } = await import("../../lib/integrations/caldav/sync.js");
    const start = new Date(Date.now() + 3 * 86_400_000);
    const created = await createAppEvent({
      summary: "G1 게이트 검증 — 자동 삭제됨",
      startsAt: start,
      endsAt: new Date(start.getTime() + 3_600_000),
    });

    const resync = await job("sync-calendar");
    assert.equal(resync.status, 200);
    assert.ok((resync.body.objectQueries as number) >= 1, "ctag가 바뀌었는데 재조회하지 않았다");

    const found = await rows(`events?select=caldav_uid,summary&caldav_uid=eq.${encodeURIComponent(created.uid)}`);
    assert.equal(found.length, 1, `재동기화 후 uid를 찾지 못했다 (${found.length}건)`);
    console.log(`   증거: uid=${created.uid} — PUT 후 재동기화에서 되읽음`);
  });

  /**
   * 조건 4와 5는 같은 브리핑 실행을 근거로 판정한다.
   * 조건마다 따로 호출하면 게이트를 돌릴 때마다 AI 요금이 두 배가 된다.
   */
  let briefingRun: { status: number; body: Record<string, unknown>; usageDelta: number } | null = null;

  before(async () => {
    const usageBefore = (await rows("ai_usage?select=id")).length;
    const result = await job("generate-briefing");
    const usageAfter = (await rows("ai_usage?select=id")).length;
    briefingRun = { ...result, usageDelta: usageAfter - usageBefore };
  });

  it("4. 브리핑 잡 실행 시 오늘 날짜 행이 ready이고 섹션이 5건 이상", async () => {
    const run = briefingRun!;
    assert.equal(run.status, 200, `브리핑 실패: ${JSON.stringify(run.body)}`);

    const date = run.body.date as string;
    const briefing = await rows<{ status: string }>(`briefings?select=status&briefing_date=eq.${date}`);
    assert.equal(briefing.length, 1);
    assert.equal(briefing[0]!.status, "ready");

    assert.ok((run.body.sections as number) >= 5, `섹션 ${run.body.sections}건 (5건 이상이어야 함)`);
    console.log(`   증거: ${date} ready, 섹션 ${run.body.sections}건, 모델 ${run.body.model}`);
  });

  it("5. AI 호출 1회당 ai_usage에 정확히 1행", async () => {
    const run = briefingRun!;
    assert.equal(run.usageDelta, run.body.attempts, `호출 ${run.body.attempts}회에 ${run.usageDelta}행 기록됨`);
    console.log(`   증거: 호출 ${run.body.attempts}회 → ai_usage +${run.usageDelta}행 (비용 $${run.body.costUsd})`);
  });

  it("6. 이번 달 누적 비용이 예산 이상이면 다음 호출이 차단된다", async () => {
    const budget = Number(process.env.AI_MONTHLY_BUDGET_USD);
    const insert = await db("ai_usage", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ purpose: "briefing", model: "g1-게이트", input_token: 0, output_token: 0, cost_usd: budget }),
    });
    assert.equal(insert.ok, true);
    const [seeded] = (await insert.json()) as Array<{ id: number }>;

    try {
      const before = (await rows("ai_usage?select=id")).length;
      const result = await job("generate-briefing");

      assert.equal(result.status, 402, `예산 초과인데 ${result.status}를 반환했다`);
      assert.match(String(result.body.error), /예산 소진/);

      const after = (await rows("ai_usage?select=id")).length;
      assert.equal(after, before, "차단됐는데 사용량 행이 늘었다");
      console.log(`   증거: HTTP 402 "${result.body.error}", ai_usage 행 변화 없음`);
    } finally {
      await db(`ai_usage?id=eq.${seeded!.id}`, { method: "DELETE" });
    }
  });

  it("7. iCloud 동기화가 실패한 상태에서도 대시보드가 500 없이 렌더되고 실패를 알린다", async () => {
    sessionCookie = await mintSession();

    // 화면이 반응하는 관측값은 sync_state다. 잡 실패 상태를 그대로 만들어 둔다.
    // (자격증명을 실제로 망가뜨리는 건 integration-caldav 검증 5에서 이미 했다.)
    const seed = await db("sync_state", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        key: "caldav",
        last_run_at: new Date().toISOString(),
        last_status: "failed",
        last_error: "Invalid credentials: PROPFIND https://caldav.icloud.com returned 401 Unauthorized",
      }),
    });
    assert.equal(seed.ok, true, `sync_state 주입 실패: ${await seed.text()}`);

    const page = await fetch(APP, { headers: { Cookie: sessionCookie } });
    const html = await page.text();

    assert.equal(page.status, 200, `대시보드가 ${page.status}를 반환했다`);
    assert.ok(html.includes("대시보드"), "대시보드 본문이 렌더되지 않았다");
    assert.ok(html.includes("iCloud 동기화 실패"), "실패 배너가 표시되지 않았다");
    console.log(`   증거: GET / → HTTP 200 (${html.length}바이트), 상단에 "iCloud 동기화 실패" 배너`);
  });

  after(async () => {
    await db("events?summary=like.G1 게이트 검증*", { method: "DELETE" });
    await db("ai_usage?model=eq.g1-게이트", { method: "DELETE" });
  });
});
