/** Real local UI + real budgeted AI; never use against production. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";
import type { Database } from "../../lib/types/database";
import type { ChatReply } from "../../lib/jarvis/dialogue-types";
import { assertIsolatedGateDatabase } from "./local-fixtures";
config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const app = process.env.G6_APP_URL ?? "http://localhost:3055";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const marker = `G6A-${crypto.randomUUID()}`;
function ok(error: { message: string } | null) { if (error) throw new Error(error.message); }

test("G6A live AI browser: facts → explicit proposal → pending approval → one task", { timeout: 240_000 }, async (t) => {
  assertIsolatedGateDatabase(url, app); assert.ok(["http://127.0.0.1:54621", "http://127.0.0.1:54721"].includes(url)); assert.equal(process.env.ALLOWED_EMAIL, "phase5a@example.test");
  assert.ok(process.env.ANTHROPIC_API_KEY, "This is the live AI gate, not a mocked pass");
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });
  // The live provider receives artificial test messages/records only. Refuse
  // to run if any pre-existing personal task, event or career record is present.
  for (const table of ["tasks", "events", "opportunities", "company_watchlist", "dialogue_action_drafts"] as const) {
    const empty = await db.from(table).select("id", { count: "exact", head: true }); ok(empty.error); assert.equal(empty.count, 0, `${table}: dedicated empty test DB required`);
  }
  const profile = await db.from("career_profile").select("facts").single(); ok(profile.error); assert.deepEqual(profile.data!.facts, {});
  const link = await db.auth.admin.generateLink({ type: "magiclink", email: process.env.ALLOWED_EMAIL! }); ok(link.error); assert.ok(link.data.properties);
  const login = await createClient(url, anon, { auth: { persistSession: false } }).auth.verifyOtp({ type: "email", email: process.env.ALLOWED_EMAIL!, token: link.data.properties.email_otp }); ok(login.error); assert.ok(login.data.session);
  const browser = await chromium.launch({ channel: process.env.GATE_BROWSER_CHANNEL ?? "chrome", headless: true });
  const abort = () => { void browser.close(); }; t.signal.addEventListener("abort", abort);
  const drafts: string[] = []; const seededTasks: string[] = []; const createdApprovals: string[] = []; const knownTaskIds = new Set<string>();
  let page: Page | undefined;
  await mkdir("test-results/g6a-browser", { recursive: true });
  try {
    const seed = await db.from("tasks").insert({ title: `${marker} 읽기`, notes: "PRIVATE_NOTE_NOT_MODEL_CONTEXT" }).select("id").single(); ok(seed.error); seededTasks.push(seed.data!.id);
    knownTaskIds.add(seed.data!.id);
    const denied = await fetch(`${app}/api/jarvis/chat`, { method: "POST", headers: { Origin: app, "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "할 일 목록" }] }) });
    assert.equal(denied.status, 401);
    const cross = await fetch(`${app}/api/jarvis/chat`, { method: "POST", headers: { Origin: "https://example.com" }, body: "{}" }); assert.equal(cross.status, 403);
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    await context.addCookies([{ name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify(login.data.session)).toString("base64"), url: app }]);
    for (const invalid of ["null", "[]", '"not-an-object"']) {
      const malformed = await context.request.post(`${app}/api/jarvis/chat`, { headers: { Origin: app, "Content-Type": "application/json" }, data: invalid });
      assert.equal(malformed.status(), 400, "Malformed authenticated bodies must be rejected before AI calls");
    }
    page = await context.newPage(); const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${app}/jarvis`);
    async function send(content: string): Promise<ChatReply> {
      const rows = await db.from("tasks").select("id"); ok(rows.error); assert.ok(rows.data!.every((row) => knownTaskIds.has(row.id)), "Unexpected task: do not send to external model");
      for (const table of ["events", "opportunities", "company_watchlist"] as const) {
        const empty = await db.from(table).select("id", { count: "exact", head: true }); ok(empty.error); assert.equal(empty.count, 0, "Unexpected external context");
      }
      await page!.locator("textarea").fill(content);
      const reply = page!.waitForResponse((response) => new URL(response.url()).pathname === "/api/jarvis/chat" && response.request().method() === "POST", { timeout: 70_000 });
      await page!.getByRole("button", { name: "보내기", exact: true }).click();
      const response = await reply;
      const body = await response.json(); assert.equal(response.status(), 200, JSON.stringify(body));
      if (body.draft) drafts.push(body.draft.id);
      await page!.getByRole("button", { name: "보내기", exact: true }).waitFor();
      return body;
    }
    const facts = await send("현재 할 일 목록 보여줘");
    assert.equal(facts.mode, "answer"); assert.ok(facts.facts.some((fact) => fact.id === `task:${seededTasks[0]}`));
    assert.ok(!JSON.stringify(facts).includes("PRIVATE_NOTE_NOT_MODEL_CONTEXT"));
    const title = `${marker} 준비`;
    const proposal = await send(`할 일 ${title} 추가해줘`);
    assert.equal(proposal.mode, "propose"); assert.ok(proposal.draft); assert.equal(proposal.draft.type, "CREATE_TASK");
    assert.equal((proposal.draft.payload as { title: string }).title, title); assert.equal(proposal.draft.canRequestApproval, true);
    const beforeTasks = await db.from("tasks").select("id").eq("title", title); ok(beforeTasks.error); assert.equal(beforeTasks.data!.length, 0);
    const request = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/request-approval") && response.request().method() === "POST");
    await page.getByRole("button", { name: "승인함으로 보내기", exact: true }).click();
    const requestResult = await request; assert.equal(requestResult.status(), 200); const { approvalId } = await requestResult.json(); createdApprovals.push(approvalId);
    const pending = await db.from("approval_requests").select("status").eq("id", approvalId).single(); ok(pending.error); assert.equal(pending.data!.status, "pending");
    const noTask = await db.from("tasks").select("id").eq("approval_request_id", approvalId); ok(noTask.error); assert.equal(noTask.data!.length, 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: "test-results/g6a-browser/375-pending.png", fullPage: true, animations: "disabled" });
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: await context.storageState() });
    const mac = await desktop.newPage(); await mac.goto(`${app}/approvals`);
    const card = mac.locator("section").filter({ has: mac.getByRole("heading", { name: proposal.draft.title, exact: true }) });
    await card.getByRole("button", { name: "승인하고 실행", exact: true }).click();
    await card.getByText("실행 완료", { exact: true }).waitFor();
    const tasks = await db.from("tasks").select("id,title").eq("approval_request_id", approvalId); ok(tasks.error); assert.equal(tasks.data!.length, 1); assert.equal(tasks.data![0].title, title);
    knownTaskIds.add(tasks.data![0].id);
    await mac.goto(`${app}/jarvis`); await mac.getByRole("heading", { level: 1 }).waitFor();
    await mac.screenshot({ path: "test-results/g6a-browser/1440-chat.png", fullPage: true, animations: "disabled" });
    const unclear = await send("내일 오후 3시나 오후 4시에 면접 준비 1시간 일정 추가해줘");
    assert.equal(unclear.mode, "clarify"); assert.equal(unclear.draft, null);
    assert.deepEqual(errors, []);
    console.log("Evidence: live AI classification; server facts; ambiguous calendar request clarified; user proposal created pending approval only; desktop approval created exactly one task. Mobile/desktop are Chrome contexts, not physical iPhone.");
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: "test-results/g6a-browser/failure.png", fullPage: true, animations: "disabled" });
    throw error;
  } finally {
    t.signal.removeEventListener("abort", abort); await browser.close();
    for (const draft of drafts) {
      const saved = await db.from("dialogue_action_drafts").select("approval_request_id").eq("id", draft).maybeSingle(); ok(saved.error);
      if (saved.data?.approval_request_id && !createdApprovals.includes(saved.data.approval_request_id)) createdApprovals.push(saved.data.approval_request_id);
      ok((await db.from("dialogue_action_drafts").delete().eq("id", draft)).error);
    }
    for (const approvalId of createdApprovals) {
      const a = await db.from("approval_requests").select("agent_run_id").eq("id", approvalId).single(); ok(a.error);
      const run = await db.from("agent_runs").select("trigger_event_id").eq("id", a.data!.agent_run_id!).single(); ok(run.error);
      ok((await db.from("tasks").delete().eq("approval_request_id", approvalId)).error);
      ok((await db.from("action_audit_logs").delete().eq("approval_request_id", approvalId)).error);
      ok((await db.from("approval_requests").delete().eq("id", approvalId)).error);
      ok((await db.from("agent_runs").delete().eq("id", a.data!.agent_run_id!)).error);
      ok((await db.from("system_events").delete().eq("id", run.data!.trigger_event_id)).error);
    }
    for (const id of seededTasks) ok((await db.from("tasks").delete().eq("id", id)).error);
  }
});
