/** One frozen synthetic G7 browser scenario, three actual AI calls.
 * Local 54721 only. No CalDAV execution, no real Push, no 7-day/human-study claim.
 * Uses the repository node:test + Playwright convention and in-memory sessions.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium, type BrowserContext, type Page, type Request } from "playwright";
import type { Database } from "../../lib/types/database";
import type { WorkChatReply, WorkSnapshot } from "../../lib/jarvis/work-types";

config({ path: [".env.eval.local", ".env.local"], quiet: true });
const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const app = process.env.G7_APP_URL ?? "http://localhost:3055";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const marker = `G7-browser-${randomUUID()}`;
const goal = `${marker} 이력서 준비`;
const initialProgress = "프로젝트 설명까지 정리했다";
const initialNext = "성과 수치 정리";
const updatedProgress = "성과 수치 초안까지 정리했다";
const updatedNext = "성과 수치 검토";
const taskTitle = "성과 수치 검토";
const calendarTitle = "이력서 검토 시간";
const checked = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

test("G7 live AI browser: preview → save → second-session restore → update → individual approval", { timeout: 300_000 }, async (t) => {
  assert.equal(process.env.GATE_ISOLATED_DB, "1");
  assert.equal(process.env.G7_ALLOW_LIVE_AI, "1", "This scenario intentionally sends exactly three synthetic requests to the existing AI provider");
  assert.equal(dbUrl, "http://127.0.0.1:54721");
  assert.ok(["http://localhost:3055", "http://127.0.0.1:3055"].includes(app));
  assert.equal(process.env.ALLOWED_EMAIL, "phase5a@example.test");
  assert.ok(service && anon && process.env.ANTHROPIC_API_KEY);
  const db = createClient<Database>(dbUrl, service, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const table of ["work_contexts", "tasks", "events", "calendars", "opportunities", "company_watchlist", "dialogue_action_drafts"] as const) {
    const existing = await db.from(table).select("id", { count: "exact", head: true }); checked(existing.error);
    assert.equal(existing.count, 0, `${table}: dedicated empty synthetic context required before live AI`);
  }
  const profile = await db.from("career_profile").select("facts").single(); checked(profile.error); assert.deepEqual(profile.data!.facts, {});
  const usageBefore = await db.from("ai_usage").select("id,cost_usd").eq("purpose", "dialogue"); checked(usageBefore.error);
  const priorUsageIds = new Set(usageBefore.data!.map(row => row.id));
  let contextId = "", calendarId = "", ownerId = "";
  const requestIds = new Set<string>(), drafts = new Set<string>(), approvals = new Set<string>(), knownTasks = new Set<string>();
  const errors: string[] = [];
  const responses: Record<string, unknown>[] = [], alertObservations: unknown[] = [];
  const evidence: Record<string, unknown> = { marker, scope: "One synthetic scenario; two Chrome contexts, not physical devices or 30 human workflows", startedAt: new Date().toISOString(), expectedModelCalls: 3,
    responses, alertObservations, priorDialogueUsageRows: priorUsageIds.size };
  const browser = await chromium.launch({ channel: process.env.GATE_BROWSER_CHANNEL ?? "chrome", headless: true });
  const abort = () => { void browser.close(); }; t.signal.addEventListener("abort", abort);
  const pages: Page[] = [];
  const directory = `test-results/g7-browser/${marker}`;
  await mkdir(directory, { recursive: true, mode: 0o700 });

  async function session(width: number): Promise<{ context: BrowserContext; page: Page }> {
    const link = await db.auth.admin.generateLink({ type: "magiclink", email: process.env.ALLOWED_EMAIL! }); checked(link.error);
    assert.ok(link.data.properties);
    const login = await createClient(dbUrl, anon, { auth: { persistSession: false } }).auth.verifyOtp({ type: "email", email: process.env.ALLOWED_EMAIL!, token: link.data.properties.email_otp });
    checked(login.error); assert.ok(login.data.session); ownerId = login.data.user!.id;
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addCookies([{ name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify(login.data.session)).toString("base64"), url: app }]);
    const page = await context.newPage(); pages.push(page); page.on("pageerror", error => errors.push(error.message));
    page.on("request", (request: Request) => {
      if (request.method() !== "POST" || !new URL(request.url()).pathname.startsWith("/api/jarvis/work")) return;
      try {
        const body = request.postDataJSON() as { requestId?: unknown };
        if (typeof body.requestId === "string") requestIds.add(body.requestId);
      } catch { /* Requests without a JSON body carry no replay ID to collect. */ }
    });
    return { context, page };
  }
  async function assertSyntheticModelContext() {
    for (const table of ["events", "opportunities", "company_watchlist"] as const) {
      const empty = await db.from(table).select("id", { count: "exact", head: true }); checked(empty.error); assert.equal(empty.count, 0, `${table}: never send unexpected context to AI`);
    }
    const tasks = await db.from("tasks").select("id"); checked(tasks.error); assert.ok(tasks.data!.every(row => knownTasks.has(row.id)));
    const contexts = await db.from("work_contexts").select("id"); checked(contexts.error); assert.ok(contexts.data!.every(row => row.id === contextId), "never supply another work context to this live model scenario");
    const currentProfile = await db.from("career_profile").select("facts").single(); checked(currentProfile.error); assert.deepEqual(currentProfile.data!.facts, {});
  }
  async function send(page: Page, content: string) {
    await assertSyntheticModelContext();
    await page.getByRole("textbox", { name: "업무 요청", exact: true }).fill(content);
    const waiting = page.waitForResponse(response => new URL(response.url()).pathname === "/api/jarvis/work-chat" && response.request().method() === "POST", { timeout: 110_000 });
    await page.getByRole("button", { name: "업무 요청 보내기", exact: true }).click();
    const response = await waiting; const body = await response.json() as WorkChatReply;
    responses.push({ status: response.status(), body, request: response.request().postDataJSON() });
    assert.equal(response.status(), 200, JSON.stringify(body));
    const request = response.request().postDataJSON() as Record<string, unknown>;
    requestIds.add(body.requestId); body.proposals.forEach(draft => drafts.add(draft.id));
    await page.getByRole("button", { name: "업무 요청 보내기", exact: true }).waitFor({ state: "visible" });
    const alerts = await page.getByRole("alert").evaluateAll(elements => elements.map(element => ({ id: element.id, text: element.textContent })));
    alertObservations.push(alerts);
    // Next's screen-reader route announcer intentionally has role=alert. Keep
    // checking every actual application alert instead of treating it as error.
    assert.deepEqual(alerts.filter(alert => alert.id !== "__next-route-announcer__"), []);
    return { body, request };
  }
  async function currentWork(): Promise<WorkSnapshot> {
    const read = await db.from("work_contexts").select("*").eq("id", contextId).single(); checked(read.error);
    // The browser response below, not this privileged read, is the UI contract.
    const response = await pages[0].context().request.get(`${app}/api/jarvis/work-contexts/${contextId}`);
    const data = await response.json() as { work: WorkSnapshot }; assert.equal(response.status(), 200); assert.ok(data.work); return data.work;
  }
  async function replay(context: BrowserContext, request: Record<string, unknown>) {
    const before = await db.from("ai_usage").select("id", { count: "exact", head: true }).eq("purpose", "dialogue"); checked(before.error);
    const response = await context.request.post(`${app}/api/jarvis/work-chat`, { headers: { Origin: app }, data: request });
    const body = await response.json() as WorkChatReply; assert.equal(response.status(), 200, JSON.stringify(body));
    const after = await db.from("ai_usage").select("id", { count: "exact", head: true }).eq("purpose", "dialogue"); checked(after.error);
    assert.equal(after.count, before.count, "replaying the same request must not call AI again");
    return body;
  }

  try {
    const seeded = await db.from("calendars").insert({ kind: "caldav", source_url: `https://calendar.example.test/${marker}/`,
      display_name: process.env.APP_CALENDAR_NAME ?? "Personal OS", is_writable: true }).select("id").single(); checked(seeded.error); calendarId = seeded.data!.id;
    const mobile = await session(375);
    await mobile.page.goto(`${app}/jarvis`);
    await mobile.page.getByRole("heading", { name: "업무 이어하기 · JARVIS", exact: true }).waitFor();
    const tomorrow = new Date(Date.now() + 9 * 3_600_000 + 86_400_000).toISOString().slice(0, 10);
    const initialText = `"${goal}"를 진행 업무로 저장해. 현재 진행은 "${initialProgress}"이고, 다음 행동은 "${initialNext}"야. ${tomorrow} 19:00에 다시 알려줘.`;
    evidence.scenario = { initialText, progressText: `현재 진행은 "${updatedProgress}"야. 다음 행동은 "${updatedNext}"로 바꿔줘.`,
      actionText: `"${taskTitle}" 할 일을 추가해. ${tomorrow} 20:00부터 30분 동안 "${calendarTitle}" 일정을 추가해.` };
    const preview = await send(mobile.page, initialText);
    assert.equal(preview.body.mode, "preview"); assert.ok(preview.body.preview); assert.equal(preview.body.work, null);
    assert.equal(preview.body.preview.goal, goal); assert.equal(preview.body.preview.progress, initialProgress); assert.equal(preview.body.preview.nextStep, initialNext);
    assert.equal(Date.parse(preview.body.preview.reminderAt!), Date.parse(`${tomorrow}T19:00:00+09:00`));
    assert.equal(preview.body.preview.deadlineReminder, false); assert.equal(preview.body.preview.resumeReminder, false);
    const unsaved = await db.from("work_contexts").select("id", { count: "exact", head: true }); checked(unsaved.error); assert.equal(unsaved.count, 0);
    await mobile.page.screenshot({ path: `${directory}/375-preview.png`, fullPage: true, animations: "disabled" });
    const saveWaiting = mobile.page.waitForResponse(response => new URL(response.url()).pathname === "/api/jarvis/work-contexts" && response.request().method() === "POST");
    await mobile.page.getByRole("button", { name: "업무 저장", exact: true }).click();
    const savedResponse = await saveWaiting; const saved = await savedResponse.json() as { work: WorkSnapshot };
    assert.equal(savedResponse.status(), 200, JSON.stringify(saved)); contextId = saved.work.context.id;
    assert.equal(saved.work.context.status, "active"); assert.equal(saved.work.context.revision, 1);
    const saveBody = savedResponse.request().postDataJSON() as Record<string, unknown>;
    const savedAgain = await mobile.context.request.post(`${app}/api/jarvis/work-contexts`, { headers: { Origin: app }, data: saveBody });
    assert.equal(savedAgain.status(), 200); assert.equal((await savedAgain.json()).work.context.id, contextId);
    const count = await db.from("work_contexts").select("id", { count: "exact", head: true }); checked(count.error); assert.equal(count.count, 1);

    const desktop = await session(1440);
    await desktop.page.goto(`${app}/jarvis?work=${contextId}`);
    await desktop.page.getByRole("heading", { name: goal, exact: true }).waitFor();
    await desktop.page.getByText(initialProgress, { exact: true }).waitFor();
    await desktop.page.getByText(initialNext, { exact: true }).waitFor();
    const updated = await send(desktop.page, `현재 진행은 "${updatedProgress}"야. 다음 행동은 "${updatedNext}"로 바꿔줘.`);
    assert.equal(updated.body.mode, "answer"); assert.ok(updated.body.work);
    assert.equal(updated.body.work.context.id, contextId); assert.equal(updated.body.work.context.progress, updatedProgress);
    assert.equal(updated.body.work.context.nextStep, updatedNext); assert.equal(updated.body.work.context.revision, 2);
    const updatedReplay = await replay(desktop.context, updated.request);
    assert.equal(updatedReplay.work?.context.revision, 2); assert.equal(updatedReplay.work?.context.progress, updatedProgress);

    const proposed = await send(desktop.page, `"${taskTitle}" 할 일을 추가해. ${tomorrow} 20:00부터 30분 동안 "${calendarTitle}" 일정을 추가해.`);
    assert.equal(proposed.body.mode, "propose"); assert.ok(proposed.body.work); assert.equal(proposed.body.proposals.length, 2);
    const task = proposed.body.work.actions.find(action => action.draft.type === "CREATE_TASK")!;
    const calendar = proposed.body.work.actions.find(action => action.draft.type === "CREATE_CALENDAR_EVENT")!;
    assert.ok(task && calendar); drafts.add(task.draft.id); drafts.add(calendar.draft.id);
    assert.equal(task.draft.canRequestApproval, true); assert.equal(calendar.draft.canRequestApproval, false, "The local server calendar executor must stay OFF for this gate");
    assert.equal((task.draft.payload as { title: string }).title, taskTitle);
    assert.equal((calendar.draft.payload as { summary: string }).summary, calendarTitle);
    const proposedReplay = await replay(desktop.context, proposed.request);
    assert.deepEqual(proposedReplay.proposals.map(draft => draft.id), proposed.body.proposals.map(draft => draft.id));
    assert.equal(proposedReplay.work?.actions.length, 2);
    const beforeActions = await db.from("tasks").select("id", { count: "exact", head: true }); checked(beforeActions.error); assert.equal(beforeActions.count, 0);
    const actionPath = `/api/jarvis/work-contexts/${contextId}/actions/${task.id}`;
    const approving = desktop.page.waitForResponse(response => new URL(response.url()).pathname === actionPath && response.request().method() === "POST");
    const taskCard = desktop.page.getByRole("heading", { name: task.draft.title, exact: true }).locator("..");
    await taskCard.getByRole("button", { name: "승인하고 실행", exact: true }).click();
    const approvedResponse = await approving; const approved = await approvedResponse.json() as { work: WorkSnapshot };
    assert.equal(approvedResponse.status(), 200, JSON.stringify(approved));
    const completedTask = approved.work.actions.find(action => action.id === task.id)!;
    const unexecutedCalendar = approved.work.actions.find(action => action.id === calendar.id)!;
    assert.equal(completedTask.status, "executed"); assert.ok(completedTask.approvalId); approvals.add(completedTask.approvalId);
    assert.equal(unexecutedCalendar.status, "proposed"); assert.equal(unexecutedCalendar.approvalId, null);
    assert.equal(approved.work.context.status, "active", "creating a task is not completing the résumé preparation work");
    const created = await db.from("tasks").select("id,title,status").eq("approval_request_id", completedTask.approvalId); checked(created.error);
    assert.equal(created.data!.length, 1); assert.equal(created.data![0].title, taskTitle); assert.equal(created.data![0].status, "open"); knownTasks.add(created.data![0].id);
    const approvedAgain = await desktop.context.request.post(app + actionPath, { headers: { Origin: app }, data: { decision: "approved" } }); assert.equal(approvedAgain.status(), 200);
    assert.equal((await db.from("tasks").select("id").eq("approval_request_id", completedTask.approvalId)).data!.length, 1);
    const noEvents = await db.from("events").select("id", { count: "exact", head: true }); checked(noEvents.error); assert.equal(noEvents.count, 0);
    assert.equal(await desktop.page.getByRole("heading", { name: "부분 완료 · 각 결과를 확인하세요", exact: true }).count(), 0, "unapproved disabled draft is not an actual execution failure");
    await mobile.page.reload(); await mobile.page.getByText(updatedProgress, { exact: true }).waitFor();
    await mobile.page.getByText("실행 확인 완료", { exact: true }).waitFor();
    assert.equal((await currentWork()).context.nextStep, updatedNext);
    for (const [page, width] of [[mobile.page, 375], [desktop.page, 1440]] as const) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1); assert.equal(overflow, false, `${width}px overflow`);
      await page.screenshot({ path: `${directory}/${width}-results.png`, fullPage: true, animations: "disabled" });
    }
    assert.deepEqual(errors, []);
    const afterUsage = await db.from("ai_usage").select("id,cost_usd").eq("purpose", "dialogue"); checked(afterUsage.error);
    const calls = afterUsage.data!.filter(row => !priorUsageIds.has(row.id)); assert.equal(calls.length, 3, "exactly three real interpretation calls; replay must use cached results");
    Object.assign(evidence, { passed: true, contextId, approvalId: completedTask.approvalId, taskId: created.data![0].id, taskCount: 1,
      calendarExecuted: false, calendarStatus: unexecutedCalendar.status, workStatus: approved.work.context.status,
      modelCalls: calls.length, recordedCostUsd: calls.reduce((sum, row) => sum + Number(row.cost_usd), 0), pageErrors: errors, finishedAt: new Date().toISOString() });
    console.log(`G7 browser: two contexts, 3 actual AI calls, one approved task, calendar unexecuted; evidence ${directory}`);
  } catch (error) {
    Object.assign(evidence, { passed: false, contextId, failureName: error instanceof Error ? error.name : "UnknownError", pageErrors: errors });
    for (const [index, page] of pages.entries()) if (!page.isClosed()) await page.screenshot({ path: `${directory}/failure-${index}.png`, fullPage: true, animations: "disabled" }).catch(() => undefined);
    throw error;
  } finally {
    t.signal.removeEventListener("abort", abort); await browser.close();
    try {
      const ledger = await db.from("ai_usage").select("id,cost_usd,model,used_at").eq("purpose", "dialogue"); checked(ledger.error);
      const actualCalls = ledger.data!.filter(row => !priorUsageIds.has(row.id));
      Object.assign(evidence, { actualModelCalls: actualCalls.length, actualRecordedCostUsd: actualCalls.reduce((sum, row) => sum + Number(row.cost_usd), 0), actualUsageRows: actualCalls });
    } catch (error) {
      evidence.usageEvidenceReadFailed = error instanceof Error ? error.name : "UnknownError";
    }
    await writeFile(`${directory}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600 });
    if (!contextId) {
      const saved = await db.from("work_contexts").select("id").eq("goal", goal).eq("owner_id", ownerId); checked(saved.error);
      assert.ok(saved.data!.length <= 1); contextId = saved.data![0]?.id ?? "";
    }
    if (contextId) {
      const stamped = await db.from("dialogue_action_drafts").select("id,approval_request_id").eq("source_snapshot->>workContextId", contextId); checked(stamped.error);
      for (const draft of stamped.data!) { drafts.add(draft.id); if (draft.approval_request_id) approvals.add(draft.approval_request_id); }
      const attention = await db.from("attention_items").select("id").eq("context_id", contextId); checked(attention.error);
      if (attention.data!.length) checked((await db.from("notification_deliveries").delete().in("attention_id", attention.data!.map(row => row.id))).error);
      checked((await db.from("attention_items").delete().eq("context_id", contextId)).error);
      checked((await db.from("work_context_actions").delete().eq("context_id", contextId)).error);
      checked((await db.from("work_context_requests").delete().eq("context_id", contextId)).error);
    }
    if (ownerId && requestIds.size) checked((await db.from("work_context_requests").delete().eq("owner_id", ownerId).in("request_id", [...requestIds])).error);
    const systemEvents = drafts.size ? await db.from("system_events").select("id").eq("source_type", "dialogue_draft").in("source_id", [...drafts]) : { data: [], error: null }; checked(systemEvents.error);
    const eventIds = systemEvents.data!.map(row => row.id);
    const runs = eventIds.length ? await db.from("agent_runs").select("id").in("trigger_event_id", eventIds) : { data: [], error: null }; checked(runs.error);
    if (approvals.size) {
      checked((await db.from("calendar_execution_receipts").delete().in("approval_id", [...approvals])).error);
      checked((await db.from("tasks").delete().in("approval_request_id", [...approvals])).error);
      checked((await db.from("action_audit_logs").delete().in("approval_request_id", [...approvals])).error);
    }
    if (drafts.size) checked((await db.from("dialogue_action_drafts").delete().in("id", [...drafts])).error);
    if (approvals.size) checked((await db.from("approval_requests").delete().in("id", [...approvals])).error);
    if (runs.data!.length) checked((await db.from("agent_runs").delete().in("id", runs.data!.map(row => row.id))).error);
    if (eventIds.length) checked((await db.from("system_events").delete().in("id", eventIds)).error);
    if (contextId) checked((await db.from("work_contexts").delete().eq("id", contextId)).error);
    if (calendarId) { checked((await db.from("events").delete().eq("calendar_id", calendarId)).error); checked((await db.from("calendars").delete().eq("id", calendarId)).error); }
  }
});
