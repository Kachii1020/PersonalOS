/** Real local UI/DB flow; public website and AI responses are synthetic fixtures. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { config } from "dotenv";
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/types/database";
import { normalizeCareerHtml } from "../../lib/integrations/career/fetch";
import { validateCareerExtraction } from "../../lib/career/extraction";
import { processCareerRun } from "../../lib/career/orchestrator";
import { createAgentRunForEventForJob } from "../../lib/repos/jarvis-queue";
import { processJarvisStep } from "../../lib/jarvis/orchestrator";
import { assertIsolatedGateDatabase } from "./local-fixtures";

config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const app = process.env.G5B_APP_URL ?? "http://localhost:3055";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const marker = `G5B Browser ${crypto.randomUUID()}`;
const sourceUrl = `https://example.com/g5b-browser/${crypto.randomUUID()}`;
const quote = "Year 2 or above.";
const fixture = normalizeCareerHtml(`<main><h1>${marker}</h1><p>${quote}</p><p>Applications are open.</p></main>`, sourceUrl);

function ok(error: { message: string } | null) { if (error) throw new Error(error.message); }
async function until(check: () => Promise<boolean>, message: string) {
  const end = Date.now() + 15_000;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}
async function screenshot(page: Page, name: string) {
  await page.locator("main h1").waitFor({ state: "visible" });
  const width = await page.evaluate(() => ({ body: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(width.body <= width.viewport, `${name}: horizontal overflow ${JSON.stringify(width)}`);
  await page.screenshot({ path: `test-results/g5b-browser/${name}.png`, fullPage: true, animations: "disabled" });
}
async function submitForm(page: Page, label: string) {
  // Wait for the actual server action response, not merely the earlier DB
  // insert. Navigating while its RSC response is pending is not a user save flow.
  const path = new URL(page.url()).pathname;
  const response = page.waitForResponse((result) => result.request().method() === "POST" && new URL(result.url()).origin === new URL(app).origin && new URL(result.url()).pathname === path, { timeout: 15_000 });
  await page.getByRole("button", { name: label, exact: true }).click();
  const completed = await response;
  assert.equal(completed.status(), 200, `${label}: server action HTTP status`);
  // Next's RSC response can outlive the resolved action. The form's pending
  // state is the user-visible completion boundary, not transport EOF.
  await page.waitForFunction(() => !document.querySelector("form fieldset[disabled]"), undefined, { timeout: 15_000 });
  console.log(`Form complete: ${label}`);
}

test("G5B browser: phone profile/capture → desktop review/case/approval → one task", { timeout: 180_000 }, async () => {
  assertIsolatedGateDatabase(url, app);
  assert.equal(url, "http://127.0.0.1:54621");
  assert.equal(process.env.ALLOWED_EMAIL, "phase5a@example.test");
  const db = createClient<Database>(url, service, { auth: { persistSession: false } });
  const before = await db.from("career_profile").select("*").single(); ok(before.error);
  assert.ok(before.data);
  const link = await db.auth.admin.generateLink({ type: "magiclink", email: process.env.ALLOWED_EMAIL! }); ok(link.error);
  assert.ok(link.data.properties);
  const auth = await createClient(url, anon, { auth: { persistSession: false } }).auth.verifyOtp({ type: "email", email: process.env.ALLOWED_EMAIL!, token: link.data.properties.email_otp }); ok(auth.error);
  assert.ok(auth.data.session);
  const cookie = { name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify(auth.data.session)).toString("base64"), url: app };
  const browser = await chromium.launch({ channel: process.env.GATE_BROWSER_CHANNEL ?? "chrome", headless: true });
  let companyId: string | undefined;
  let opportunityId: string | undefined;
  const pageErrors: string[] = [];
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await Promise.all([phone.addCookies([cookie]), desktop.addCookies([cookie])]);
  const mobile = await phone.newPage();
  const mac = await desktop.newPage();
  for (const page of [mobile, mac]) page.on("pageerror", (error) => pageErrors.push(error.message));
  for (const page of [mobile, mac]) page.on("requestfailed", (request) => {
    if (request.isNavigationRequest()) console.log(`Navigation failure: ${new URL(request.url()).pathname} ${request.failure()?.errorText}`);
  });
  await mkdir("test-results/g5b-browser", { recursive: true });
  try {
    // Do not use inherited personal facts: this isolated test saves a labeled fact.
    ok((await db.from("career_profile").update({ facts: {} }).eq("singleton", true)).error);
    await mobile.goto(`${app}/career/profile`);
    await mobile.locator("#academic_year-value").fill("3");
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const nextMonth = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    await mobile.locator("#academic_year-verified").fill(yesterday);
    await mobile.locator("#academic_year-review").fill(nextMonth);
    await mobile.locator("#academic_year-source").fill("Synthetic browser test fact; not the user's profile");
    await mobile.locator('input[name="confirmed"]').check();
    await submitForm(mobile, "확인한 프로필 저장");
    await until(async () => {
      const row = await db.from("career_profile").select("revision").single(); ok(row.error);
      return row.data!.revision > before.data!.revision;
    }, "profile form did not persist");
    await screenshot(mobile, "375-profile");
    await mobile.goto(`${app}/career`);
    await mobile.locator("#company-name").fill(marker);
    await mobile.locator("#company-reason").fill("Synthetic end-to-end verification only");
    await mobile.locator("#company-prefixes").fill("https://example.com/g5b-browser/");
    await mobile.locator('input[name="officialConfirmed"]').check();
    await submitForm(mobile, "관심 기관 추가");
    await until(async () => {
      const result = await db.from("company_watchlist").select("id").eq("name", marker).maybeSingle(); ok(result.error);
      companyId = result.data?.id; return !!companyId;
    }, "company form did not persist");
    await mobile.goto(`${app}/opportunities`);
    await mobile.locator("#capture-company").selectOption(companyId!);
    await mobile.locator("#capture-url").fill(`${sourceUrl}?utm_source=browser#details`);
    await mobile.locator("#capture-title").fill(marker);
    await submitForm(mobile, "공고 저장");
    await until(async () => {
      const result = await db.from("opportunities").select("id").eq("canonical_url", sourceUrl).maybeSingle(); ok(result.error);
      opportunityId = result.data?.id; return !!opportunityId;
    }, "capture form did not persist canonical URL");

    // Select only this test's event/run; never consume unrelated queued work.
    async function careerStep(eventType: string) {
      const result = await db.from("system_events").select("*").eq("source_id", opportunityId!).eq("event_type", eventType).single(); ok(result.error);
      const event = result.data!;
      const workerId = `browser-${crypto.randomUUID()}`;
      const run = await createAgentRunForEventForJob({ id: event.id, eventType: event.event_type, sourceType: event.source_type,
        sourceId: event.source_id, payload: {}, dedupeKey: event.dedupe_key, status: "pending", attempts: 0, lockedBy: null, lockedUntil: null, error: null });
      ok((await db.from("agent_runs").update({ locked_by: workerId, locked_until: new Date(Date.now() + 60_000).toISOString() }).eq("id", run.id)).error);
      const step = await processCareerRun(run, workerId, {
        fetch: async () => ({ kind: "ok", url: sourceUrl, httpStatus: 200, checkedAt: new Date().toISOString(), etag: null, lastModified: null, ...fixture }),
        extract: async (text, sourceId) => validateCareerExtraction({ title: marker, deadline: null, requirements: [
          { field: "academic_year", operator: "gte", expected: 2, hard: true, quote, sourceId },
        ] }, text, sourceId),
      });
      assert.equal(step.kind, "career_step");
      ok((await db.from("system_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", event.id)).error);
    }
    await careerStep("career.refresh");
    await careerStep("opportunity.source_changed");
    await mac.goto(`${app}/opportunities/${opportunityId}`);
    await mac.locator("#review-lifecycle").selectOption("open");
    await mac.locator('input[name="rule.0.reviewed"]').check();
    await mac.locator('input[name="sourceReviewed"]').check();
    await mac.locator('input[name="complete"]').check();
    await submitForm(mac, "원문·조건 검토 저장");
    await until(async () => {
      const row = await db.from("opportunities").select("source_reviewed").eq("id", opportunityId!).single(); ok(row.error);
      return row.data!.source_reviewed;
    }, "review form did not persist");
    await mac.reload();
    await mac.getByText("지원 조건 충족", { exact: true }).waitFor();
    await screenshot(mac, "1440-reviewed-opportunity");
    const crossDevice = await mobile.goto(`${app}/opportunities/${opportunityId}`);
    console.log(`Cross-context navigation: status=${crossDevice?.status()} path=${new URL(mobile.url()).pathname} serviceWorker=${crossDevice?.fromServiceWorker()}`);
    assert.equal(new URL(mobile.url()).pathname, `/opportunities/${opportunityId}`);
    await mobile.getByText("지원 조건 충족", { exact: true }).waitFor();
    await screenshot(mobile, "375-reviewed-opportunity");
    const taskTitle = `${marker} 준비`;
    await mac.locator("#application-next").fill(taskTitle);
    await submitForm(mac, "지원 준비 시작");
    let caseId = "";
    await until(async () => {
      const result = await db.from("application_cases").select("id").eq("opportunity_id", opportunityId!).maybeSingle(); ok(result.error);
      caseId = result.data?.id ?? ""; return !!caseId;
    }, "case form did not persist");
    const event = await db.from("system_events").select("*").eq("source_id", caseId).eq("event_type", "career.application_started").single(); ok(event.error);
    const worker = `browser-case-${crypto.randomUUID()}`;
    const run = await createAgentRunForEventForJob({ id: event.data!.id, eventType: event.data!.event_type, sourceType: "application_case", sourceId: caseId,
      payload: {}, dedupeKey: event.data!.dedupe_key, status: "pending", attempts: 0, lockedBy: null, lockedUntil: null, error: null });
    ok((await db.from("agent_runs").update({ locked_by: worker, locked_until: new Date(Date.now() + 60_000).toISOString() }).eq("id", run.id)).error);
    assert.equal((await processCareerRun(run, worker)).kind, "classified");
    ok((await db.from("system_events").update({ status: "processed" }).eq("id", event.data!.id)).error);
    const prepared = await processJarvisStep(worker);
    assert.equal(prepared.kind, "approval_prepared");
    assert.equal(prepared.runId, run.id, "only this test's approval may be consumed");
    await mac.goto(`${app}/approvals`);
    const approvalCard = mac.locator("section").filter({ has: mac.getByRole("heading", { name: taskTitle, exact: true }) });
    await approvalCard.getByRole("button", { name: "승인하고 실행", exact: true }).click();
    await until(async () => {
      const tasks = await db.from("tasks").select("id").eq("approval_request_id", prepared.approvalId!); ok(tasks.error);
      return tasks.data!.length === 1;
    }, "approval UI did not create task");
    await mobile.goto(`${app}/today`);
    await mobile.getByText(taskTitle, { exact: true }).waitFor();
    await screenshot(mobile, "375-today-task");
    await mac.goto(`${app}/career`);
    await screenshot(mac, "1440-application-case");
    assert.deepEqual(pageErrors, []);
    console.log("Evidence: two authenticated Chrome contexts 375/1440; profile/capture/review/case/approval forms executed; one task visible on phone Today. Source/AI were synthetic, not physical iPhone.");
  } catch (error) {
    await mac.screenshot({ path: "test-results/g5b-browser/failure-desktop.png", fullPage: true });
    await mobile.screenshot({ path: "test-results/g5b-browser/failure-mobile.png", fullPage: true });
    throw error;
  } finally {
    await browser.close();
    // FK-aware cleanup is restricted to this test's company/opportunity/events.
    if (!companyId) {
      const company = await db.from("company_watchlist").select("id").eq("name", marker).maybeSingle(); ok(company.error); companyId = company.data?.id;
    }
    if (opportunityId) {
      const cases = await db.from("application_cases").select("id").eq("opportunity_id", opportunityId); ok(cases.error);
      const sources = [opportunityId, ...cases.data!.map((row) => row.id)];
      const events = await db.from("system_events").select("id").in("source_id", sources); ok(events.error);
      const eventIds = events.data!.map((row) => row.id);
      if (eventIds.length) {
        const runs = await db.from("agent_runs").select("id").in("trigger_event_id", eventIds); ok(runs.error);
        const runIds = runs.data!.map((row) => row.id);
        if (runIds.length) {
          const approvals = await db.from("approval_requests").select("id").in("agent_run_id", runIds); ok(approvals.error);
          const approvalIds = approvals.data!.map((row) => row.id);
          if (approvalIds.length) {
            ok((await db.from("tasks").delete().in("approval_request_id", approvalIds)).error);
            ok((await db.from("action_audit_logs").delete().in("approval_request_id", approvalIds)).error);
            ok((await db.from("approval_requests").delete().in("id", approvalIds)).error);
          }
          ok((await db.from("agent_runs").delete().in("id", runIds)).error);
        }
        ok((await db.from("system_events").delete().in("id", eventIds)).error);
      }
      ok((await db.from("application_cases").delete().eq("opportunity_id", opportunityId)).error);
      ok((await db.from("opportunity_requirements").delete().eq("opportunity_id", opportunityId)).error);
      ok((await db.from("opportunities").update({ current_source_id: null }).eq("id", opportunityId)).error);
      ok((await db.from("opportunity_sources").delete().eq("opportunity_id", opportunityId)).error);
      ok((await db.from("opportunities").delete().eq("id", opportunityId)).error);
    }
    if (companyId) ok((await db.from("company_watchlist").delete().eq("id", companyId)).error);
    ok((await db.from("career_profile").update(before.data).eq("singleton", true)).error);
  }
});
