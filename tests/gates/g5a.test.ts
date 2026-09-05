import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCommandBrief } from "../../lib/jarvis/brief";
import { policyForAction } from "../../lib/jarvis/policy";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const MIGRATION = "supabase/migrations/0015_jarvis_core.sql";

test("G5A-1: Phase 5 spec and constitution exist", () => {
  assert.equal(existsSync(join(ROOT, "docs/JARVIS-SPEC.md")), true);
  assert.equal(existsSync(join(ROOT, "docs/JARVIS-CONSTITUTION.md")), true);
  const spec = read("docs/JARVIS-SPEC.md");
  assert.match(spec, /5A — JARVIS Core/);
  assert.match(spec, /5B — Career Secretary/);
  assert.match(spec, /G5A 통과 조건/);
});

test("G5A-2: migration has queue, run, approval, audit, brief and task extension", () => {
  const sql = read(MIGRATION);
  for (const table of [
    "inbox_items",
    "system_events",
    "agent_runs",
    "approval_requests",
    "action_audit_logs",
    "command_briefs",
  ]) {
    assert.match(sql, new RegExp(`create table ${table}\\b`));
  }
  assert.match(sql, /alter table tasks[\s\S]*approval_request_id/);
  assert.match(sql, /create unique index if not exists tasks_approval_request_unique/);
  assert.match(sql, /create trigger approval_requests_audit_insert/);
});

test("G5A-3: claims are atomic and expired leases can be recovered", () => {
  const sql = read(MIGRATION);
  assert.match(sql, /for update skip locked/g);
  assert.match(sql, /status = 'processing' and locked_until < now\(\)/);
  assert.match(sql, /status = 'executing' and locked_until < now\(\)/);
  assert.match(sql, /idempotency_key\s+text not null unique/);
  assert.match(sql, /complete_approval_execution[\s\S]*locked_by = p_worker_id/);
});

test("G5A-4: policy fails closed", () => {
  assert.equal(policyForAction("SUMMARIZE_INTERNAL"), "auto");
  assert.equal(policyForAction("CREATE_TASK"), "approval");
  assert.equal(policyForAction("MAKE_PAYMENT"), "deny");
  assert.equal(policyForAction("NOT_REGISTERED"), "deny");
});

test("G5A-5: approval payload is immutable to the authenticated client", () => {
  const sql = read(MIGRATION);
  assert.match(sql, /grant select on system_events, agent_runs, approval_requests, action_audit_logs, command_briefs to authenticated/);
  assert.doesNotMatch(sql, /grant\s+(?:all|update)[^;]*approval_requests[^;]*to authenticated/i);
  assert.match(sql, /grant execute on function public\.decide_approval\(uuid, text, text\) to authenticated/);
  assert.match(sql, /revoke all on function public\.decide_approval\(uuid, text, text\) from public, authenticated/);
});

test("G5A-6: approved task execution is idempotent", () => {
  const repo = read("lib/repos/jarvis-approvals.ts");
  assert.match(repo, /rpc\("execute_approved_task"/);
  const guards = read("supabase/migrations/0016_jarvis_execution_guards.sql");
  assert.match(guards, /on conflict \(approval_request_id\) do nothing/);
  assert.match(guards, /perform public.complete_approval_execution/);
  assert.match(guards, /locked_until <= clock_timestamp\(\)/);
  const migration = read(MIGRATION);
  assert.match(migration, /tasks_approval_request_unique/);
});

test("G5A-7: command brief exposes at most three actions without AI", () => {
  const tasks = Array.from({ length: 8 }, (_, index) => ({
    id: String(index),
    title: `Task ${index}`,
    dueAt: null,
    deferUntil: null,
    priority: 90 - index,
    estimatedMinutes: 30,
    category: "career",
  }));
  const brief = buildCommandBrief({ tasks, approvals: [], now: new Date("2026-09-05T00:00:00Z") });
  assert.equal(brief.topActions.length, 3);
  assert.equal(read("lib/jarvis/command-brief.ts").includes("callStructured"), false);
});

test("G5A-8: Today, Inbox and Approvals routes are present", () => {
  for (const path of [
    "app/(dashboard)/today/page.tsx",
    "app/(dashboard)/inbox/page.tsx",
    "app/(dashboard)/approvals/page.tsx",
  ]) {
    assert.equal(existsSync(join(ROOT, path)), true, `${path} missing`);
  }
  const nav = read("components/shell/nav-items.ts");
  assert.match(nav, /href: "\/today"/);
  assert.match(nav, /href: "\/inbox"/);
  assert.match(nav, /href: "\/approvals"/);
});

test("G5A-9: external state change remains behind approval", () => {
  const inboxAction = read("app/(dashboard)/inbox/actions.ts");
  assert.doesNotMatch(inboxAction, /\.from\("tasks"\)\.insert/);
  const approvalAction = read("app/(dashboard)/approvals/actions.ts");
  assert.match(approvalAction, /decideApproval/);
  assert.match(approvalAction, /executeApprovedActionById/);
});

test("G5A-10: job routes use cron auth and keep failures visible", () => {
  for (const path of [
    "app/api/jobs/process-system-events/route.ts",
    "app/api/jobs/process-approved-actions/route.ts",
    "app/api/jobs/generate-command-brief/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /rejectUnauthorizedCron/);
    assert.match(source, /recordJobRun/);
  }
});
