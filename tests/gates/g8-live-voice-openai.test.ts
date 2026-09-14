import test from "node:test";
import assert from "node:assert/strict";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

config({ path: [".env.eval.local", ".env.local"], quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const app = "http://localhost:3055";
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

test("G8.5 opens and gracefully closes one real GPT-Live WebRTC session", { timeout: 120_000 }, async () => {
  assert.equal(process.env.G8_ALLOW_LIVE_OPENAI, "1");
  assert.equal(process.env.GATE_ISOLATED_DB, "1");
  assert.match(url, /^http:\/\/127\.0\.0\.1:\d+$/);
  await admin.from("voice_sessions" as never).delete().neq("id" as never, "00000000-0000-0000-0000-000000000000" as never);
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.ALLOWED_EMAIL! });
  assert.ifError(link.error);
  const auth = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const login = await auth.auth.verifyOtp({ type: "email", email: process.env.ALLOWED_EMAIL!, token: link.data.properties.email_otp });
  assert.ifError(login.error);
  const owner = login.data.user!.id;
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.context().addCookies([{ name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify(login.data.session)).toString("base64url"), url: app }]);
  try {
    await page.goto(`${app}/voice-test-gate`);
    await page.getByRole("button", { name: "no context" }).click();
    const sessionResponse = page.waitForResponse(response => response.url().endsWith("/api/jarvis/live/sessions"));
    await page.getByRole("button", { name: "자연 음성 시작" }).click();
    const started = await sessionResponse;
    assert.equal(started.status(), 200, await started.text());
    await page.getByText("자연 대화 연결됨").waitFor({ timeout: 30_000 });
    const row = await admin.from("voice_sessions" as never).select("id,status,transcription_model,stt_reserved_usd" as never).eq("owner_id" as never, owner as never).single();
    assert.ifError(row.error);
    assert.equal((row.data as unknown as Record<string, unknown>).transcription_model, "gpt-live-1");
    assert.equal((row.data as unknown as Record<string, unknown>).stt_reserved_usd, 0.25);
    await page.getByRole("button", { name: "자연 음성 종료" }).click();
    await page.getByText("자연 음성 종료됨").waitFor({ timeout: 10_000 });
    const ended = await admin.from("voice_sessions" as never).select("status,end_reason" as never).eq("id" as never, (row.data as unknown as Record<string, unknown>).id as never).single();
    assert.ifError(ended.error);
    assert.equal((ended.data as unknown as Record<string, unknown>).status, "ended");
  } finally {
    await browser.close();
    await admin.from("voice_sessions" as never).delete().eq("owner_id" as never, owner as never);
  }
});
