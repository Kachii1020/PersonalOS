/** Actual SQL/RLS filtering on the dedicated evaluation DB; no model or CalDAV. */
import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { readDialogueTasks, answerDialogue } from "../../lib/repos/jarvis-dialogue";
import type { Database } from "../../lib/types/database";

test("dialogue filters query all matches before limit, honor JST and literal titles, and retain owner boundary", async () => {
  assert.equal(process.env.GATE_ISOLATED_DB, "1");
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54721");
  assert.equal(process.env.ALLOWED_EMAIL, "phase5a@example.test");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const marker = `filters-${crypto.randomUUID()}`; const ids: string[] = [];
  const empty = await admin.from("tasks").select("id", { count: "exact", head: true }); assert.ifError(empty.error); assert.equal(empty.count, 0);
  async function login(email: string) {
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email }); assert.ifError(link.error);
    const user = createClient<Database>(url, anon, { auth: { persistSession: false } });
    const session = await user.auth.verifyOtp({ type: "email", email, token: link.data.properties.email_otp }); assert.ifError(session.error);
    return { user, id: session.data.user!.id };
  }
  const owner = await login(process.env.ALLOWED_EMAIL!);
  const other = await login(`${marker}@example.test`);
  try {
    const inserted = await admin.from("tasks").insert([
      ...Array.from({ length: 25 }, (_, i) => ({ title: `서류 ${i}`, notes: "PRIVATE_FILTER_NOTE_NEVER_MODEL", status: "open", priority: i === 24 ? 99 : 1, due_at: "2026-09-10T12:00:00+09:00" })),
      { title: "완료 시작 경계", status: "done", due_at: "2026-09-10T00:00:00+09:00" },
      { title: "완료 종료 바깥", status: "done", due_at: "2026-09-11T00:00:00+09:00" },
      { title: "100%_특수", status: "open", due_at: null },
      { title: "a*b", status: "open", due_at: null },
      { title: "axxb", status: "open", due_at: null },
      { title: "a%b", status: "open", due_at: null },
      { title: "중단 기록", status: "dropped", due_at: null },
    ]).select("id,title"); assert.ifError(inserted.error); ids.push(...inserted.data!.map(row => row.id));
    const now = new Date("2026-09-07T00:00:00Z");
    const ranked = await readDialogueTasks(owner.user, now, { order: "priority", keyword: "서류" });
    assert.equal(ranked.count, 25); assert.equal(ranked.facts.length, 20); assert.equal(ranked.facts[0].title, "서류 24"); assert.equal(ranked.warnings.length, 1);
    assert.ok(!JSON.stringify(ranked).includes("PRIVATE_FILTER_NOTE_NEVER_MODEL"));
    const done = await readDialogueTasks(owner.user, now, { taskStatus: "done" }, "2026-09-10");
    assert.equal(done.count, 1); assert.equal(done.facts[0].title, "완료 시작 경계"); assert.match(done.facts[0].detail, /완료한/);
    const all = await readDialogueTasks(owner.user, now, { taskStatus: "all" }); assert.equal(all.count, 32);
    const wildcard = await readDialogueTasks(owner.user, now, { keyword: "%_" }); assert.equal(wildcard.count, 1); assert.equal(wildcard.facts[0].title, "100%_특수");
    const star = await readDialogueTasks(owner.user, now, { keyword: "a*b" }); assert.equal(star.count, 1); assert.equal(star.facts[0].title, "a*b");
    const dropped = await readDialogueTasks(owner.user, now, { taskStatus: "all", keyword: "중단 기록" }); assert.equal(dropped.count, 1); assert.match(dropped.facts[0].detail, /중단한/);
    const noAccess = await readDialogueTasks(other.user, now, { taskStatus: "all" }); assert.equal(noAccess.count, 0); assert.equal(noAccess.facts.length, 0);
    const draftBefore = await admin.from("dialogue_action_drafts").select("id", { count: "exact", head: true }); assert.ifError(draftBefore.error);
    const reply = await answerDialogue({ messages: [{ role: "user", content: '미완료 할 일 중 제목에 "서류"가 들어간 것만 우선순위 높은 순으로 보여줘.' }] }, {
      owner: { client: owner.user, ownerId: owner.id }, interpret: async () => ({ kind: "read_tasks", sourceId: null, title: null, date: null, time: null, duration: null }),
    });
    assert.equal(reply.mode, "answer"); assert.equal(reply.draft, null); assert.equal(reply.facts[0].title, "서류 24"); assert.match(reply.message, /25개/); assert.match(reply.message, /우선순위/);
    const draftAfter = await admin.from("dialogue_action_drafts").select("id", { count: "exact", head: true }); assert.ifError(draftAfter.error); assert.equal(draftAfter.count, draftBefore.count);
    console.log("SQL evidence: 25 matches/20 displayed, priority item 24 first; JST boundary count1; literal wildcard count1; other owner0; read creates0drafts.");
  } finally {
    if (ids.length) assert.ifError((await admin.from("tasks").delete().in("id", ids)).error);
    assert.ifError((await admin.auth.admin.deleteUser(other.id)).error);
  }
});
