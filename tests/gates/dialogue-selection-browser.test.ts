/** Actual local UI; mocked chat responses; no model or external action calls. */
import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

test("cancel clears selected calendar target from UI and subsequent request", { timeout: 60_000 }, async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!; const app = "http://localhost:3055";
  assert.equal(process.env.GATE_ISOLATED_DB, "1"); assert.equal(url, "http://127.0.0.1:54721"); assert.equal(process.env.ALLOWED_EMAIL, "phase5a@example.test");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.ALLOWED_EMAIL! }); assert.ifError(link.error);
  const user = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const login = await user.auth.verifyOtp({ type: "email", email: process.env.ALLOWED_EMAIL!, token: link.data.properties.email_otp }); assert.ifError(login.error);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: "block" });
    await context.addCookies([{ name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify(login.data.session)).toString("base64"), url: app }]);
    const page = await context.newPage(); const requests: { selectedSourceId?: string }[] = [];
    await page.route("**/api/jarvis/chat", async route => {
      requests.push(route.request().postDataJSON());
      const initial = requests.length === 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        mode: initial ? "answer" : "clarify", message: initial ? "합성 일정 조회" : "새 변경 요청이 필요합니다.", observedAt: new Date().toISOString(), warnings: [], draft: null,
        facts: initial ? [{ id: "event:11111111-1111-4111-8111-111111111111", title: "선택 해제 검증", detail: "합성 일정", href: "/calendar", observedAt: new Date().toISOString() }] : [],
      }) });
    });
    await page.goto(`${app}/jarvis`);
    async function send(text: string) {
      await page.locator("textarea").fill(text);
      await Promise.all([page.waitForResponse(r => r.url().endsWith("/api/jarvis/chat")), page.getByRole("button", { name: "보내기", exact: true }).click()]);
      await page.locator("textarea").waitFor({ state: "visible" });
      await page.waitForFunction(() => !(document.querySelector("textarea") as HTMLTextAreaElement).disabled);
    }
    await send("내일 일정 보여줘");
    await page.getByRole("button", { name: /수정 대상으로 선택/ }).click();
    assert.equal(await page.getByRole("region", { name: "선택한 수정 대상" }).count(), 1);
    await send("취소해. 만들지 마.");
    assert.equal(await page.getByRole("region", { name: "선택한 수정 대상" }).count(), 0);
    assert.equal(requests[1].selectedSourceId, undefined);
    await send("내일 15:00, 1시간");
    assert.equal(requests[2].selectedSourceId, undefined);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log("Actual UI selection removed on cancellation; next two request bodies omit target. Chat responses mocked; model/external writes0.");
  } finally { await browser.close(); }
});
