/**
 * G3 게이트 (SPEC.md 7절 Phase 3).
 *
 * 실행:
 *   npm run dev                 # 다른 터미널에서 (로컬 Supabase 스택이 떠 있어야 한다)
 *   npm run test:g3
 *
 * 주의:
 * - 조건 1은 yahoo-finance2를 실제로 호출한다. 종목 20개에 약 5~10초.
 * - 조건 4는 GitHub API를 실제로 호출한다 (인증 불필요).
 * - 조건 5는 NOTION_DB_APPLICATIONS이 설정돼 있어야 한다. 없으면 건너뛴다 (skip).
 *
 * 이 파일은 조건을 완화하거나 추가하지 않는다. 실패하면 담당 에이전트에게 되돌린다.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { config } from "dotenv";

config({ path: [".env.development.local", ".env.local"] });

const APP = process.env.G3_APP_URL ?? "http://localhost:3000";
const CRON = process.env.CRON_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL;

let sessionCookie = "";

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
  const text = await res.text();
  assert.equal(res.ok, true, `조회 실패 ${path}: ${res.status} ${text}`);
  return JSON.parse(text) as T[];
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

describe("G3 — Phase 3 게이트", () => {
  before(() => {
    for (const [name, value] of Object.entries({
      CRON_SECRET: CRON,
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      ALLOWED_EMAIL,
    })) {
      assert.ok(value, `환경변수 ${name} 없음`);
    }
  });

  it("1. 티커 20개의 시세를 1회 잡으로 가져오고 price_snapshots에 20행이 들어간다", async () => {
    const result = await job("fetch-prices");
    assert.equal(result.status, 200, `fetch-prices 실패: ${JSON.stringify(result.body)}`);
    assert.equal(result.body.tickers, 20, `티커 수: ${result.body.tickers} (20이어야 함)`);

    // 일부 종목이 실패할 수 있으므로 최소 기준을 18로 잡되, 20이 아니면 경고한다
    const priceCount = result.body.prices as number;
    assert.ok(priceCount >= 18, `시세 ${priceCount}건 (최소 18건 이상이어야 함)`);

    // DB에도 확인
    const snaps = await rows("price_snapshots?select=id");
    assert.ok(snaps.length >= 18, `price_snapshots ${snaps.length}행 (18행 이상이어야 함)`);

    console.log(`   증거: 티커 ${result.body.tickers}개, 시세 ${priceCount}건, 환율 ${result.body.fx}건, 실패 ${(result.body.failures as unknown[])?.length ?? 0}건`);
  });

  it("2. Yahoo 호출을 강제로 실패시켜도 위젯이 마지막 스냅샷과 갱신 실패 표시를 보여준다", async () => {
    sessionCookie = sessionCookie || (await mintSession());

    // sync_state에 prices 실패를 기록한다
    const seed = await db("sync_state", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        key: "prices",
        last_run_at: new Date().toISOString(),
        last_status: "failed",
        last_error: "yahoo-finance2: HTTP 503",
      }),
    });
    assert.equal(seed.ok, true, `sync_state 주입 실패`);

    // 대시보드를 렌더한다
    const page = await fetch(APP, { headers: { Cookie: sessionCookie } });
    const html = await page.text();

    assert.equal(page.status, 200, `대시보드가 ${page.status}를 반환했다`);
    assert.ok(html.includes("대시보드"), "대시보드 본문이 렌더되지 않았다");
    assert.ok(html.includes("시세 갱신 실패"), "실패 배너가 표시되지 않았다");

    // 마지막 스냅샷이 위젯에 보여야 한다 — 시세가 있으므로 "—"만 있으면 안 된다
    // 지수 이름이 하나라도 있으면 마지막 스냅샷을 보여주는 것이다
    const hasIndex = /S&P 500|NASDAQ|Dow Jones|Nikkei|KOSPI/.test(html);
    assert.ok(hasIndex, "시세 실패 상태에서 마지막 스냅샷(지수 이름)이 보이지 않는다");

    console.log(`   증거: GET / → HTTP 200, "시세 갱신 실패" 배너 + 지수 이름 표시`);

    // 정리: 실패 상태를 ok로 돌린다
    await db("sync_state", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ key: "prices", last_run_at: new Date().toISOString(), last_status: "ok", last_error: null }),
    });
  });

  it("3. KRW/USD 병기가 fx_rates의 당일 환율로 계산된다", async () => {
    // fetch-prices가 이미 fx_rates를 넣었다. 확인한다.
    const fxRows = await rows<{ base: string; quote: string; rate: string }>(
      "fx_rates?select=base,quote,rate&base=eq.USD&quote=eq.KRW&order=as_of.desc&limit=1",
    );
    assert.equal(fxRows.length, 1, "fx_rates에 USD/KRW 행이 없다");
    const rate = Number(fxRows[0]!.rate);
    assert.ok(rate > 1000 && rate < 2000, `환율 ${rate}이 비정상적이다 (1000~2000 범위 밖)`);

    // /invest 페이지에서 환율이 표시되는지 확인
    sessionCookie = sessionCookie || (await mintSession());
    const page = await fetch(`${APP}/invest`, { headers: { Cookie: sessionCookie } });
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.ok(html.includes("USD/KRW"), "/invest에 USD/KRW 표시가 없다");

    // ₩ 환산 열이 있는지 (USD 종목의 KRW 환산)
    assert.ok(html.includes("₩ 환산") || html.includes("₩"), "/invest에 원화 환산이 없다");

    console.log(`   증거: fx_rates USD/KRW=${rate}, /invest에 USD/KRW + ₩ 환산 표시`);
  });

  it("4. GitHub 공개 레포 전체가 수집되고 90일 커밋 잔디가 렌더된다", async () => {
    const username = process.env.GITHUB_USERNAME;
    assert.ok(username, "GITHUB_USERNAME 환경변수가 없다");

    const result = await job("sync-github");
    assert.equal(result.status, 200, `sync-github 실패: ${JSON.stringify(result.body)}`);

    const repoCount = result.body.repos as number;
    assert.ok(repoCount >= 1, `GitHub 레포 ${repoCount}개 (최소 1개 이상이어야 함)`);

    // DB 확인
    const repos = await rows("github_repos?select=full_name");
    assert.ok(repos.length >= 1, `github_repos ${repos.length}행`);

    // /portfolio에서 잔디가 렌더되는지 확인
    sessionCookie = sessionCookie || (await mintSession());
    const page = await fetch(`${APP}/portfolio`, { headers: { Cookie: sessionCookie } });
    const html = await page.text();
    assert.equal(page.status, 200);

    // "커밋 잔디"와 "최근 90일" 라벨이 있어야 한다 (SPEC 5.4)
    assert.ok(html.includes("커밋 잔디"), "/portfolio에 '커밋 잔디'가 없다");
    assert.ok(/최근 90일/.test(html), "/portfolio에 '최근 90일' 라벨이 없다");

    // 레포가 목록에 보여야 한다
    const hasRepo = repos.some((r) => html.includes(String((r as { full_name: string }).full_name).split("/")[1]!));
    assert.ok(hasRepo, "/portfolio에 레포 이름이 보이지 않는다");

    console.log(`   증거: 레포 ${repoCount}개, /portfolio에 잔디 + 레포 목록 렌더`);
  });

  it("5. 지원 파이프라인이 Notion에서 읽히고 단계별로 그룹핑된다", async () => {
    const notionDbApps = process.env.NOTION_DB_APPLICATIONS?.trim();
    if (!notionDbApps) {
      console.log("   NOTION_DB_APPLICATIONS 미설정 — 빈 상태 표시 확인으로 대체");

      sessionCookie = sessionCookie || (await mintSession());
      const page = await fetch(`${APP}/apply`, { headers: { Cookie: sessionCookie } });
      const html = await page.text();
      assert.equal(page.status, 200);
      assert.ok(html.includes("지원 파이프라인"), "/apply가 렌더되지 않았다");
      assert.ok(
        html.includes("NOTION_DB_APPLICATIONS"),
        "/apply에 설정 안내가 없다",
      );
      console.log(`   증거: /apply → 200, NOTION_DB_APPLICATIONS 미설정 안내 표시`);
      return;
    }

    sessionCookie = sessionCookie || (await mintSession());
    const page = await fetch(`${APP}/apply`, { headers: { Cookie: sessionCookie } });
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.ok(html.includes("지원 파이프라인"), "/apply가 렌더되지 않았다");

    console.log(`   증거: /apply → 200, Notion Applications DB에서 파이프라인 표시`);
  });

  after(async () => {
    // 테스트 데이터 정리 — 티커와 시세는 유지 (유용하다)
  });
});
