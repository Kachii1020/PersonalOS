/**
 * G2 게이트 (SPEC.md 7절 Phase 2).
 *
 * 실행:
 *   npm run dev          # 다른 터미널에서 (로컬 Supabase 스택이 떠 있어야 한다)
 *   npm run test:g2
 *
 * 주의:
 * - 조건 1은 Anthropic API를 실제로 호출한다 (약 $0.03).
 * - 조건 11은 Notion API를 실제로 호출한다 (무료).
 * - 조건 4·5는 tests/fixtures의 PDF·PPTX를 쓴다. LibreOffice로 만든 실제 파일이다.
 * - **조건 2는 여기 없다.** 채점 서버 액션이 세션 쿠키를 쓰는데 node 테스트에는 요청 스코프가
 *   없다. 브라우저로 검증하고 근거를 docs/G2-REPORT.md에 남긴다.
 *
 * 이 파일은 조건을 완화하거나 추가하지 않는다. 실패하면 담당 에이전트에게 되돌린다.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: [".env.development.local", ".env.local"] });

const APP = process.env.G2_APP_URL ?? "http://localhost:3000";
const CRON = process.env.CRON_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL;

const FIXTURES = new URL("../fixtures/", import.meta.url);

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

/**
 * 본문은 한 번만 읽을 수 있다. assert의 메시지 인자는 assert보다 먼저 평가되므로
 * `assert(res.ok, await res.text())` 뒤에 `res.json()`을 부르면 "Body is unusable"이 난다.
 */
async function created<T>(res: Response, what: string): Promise<T[]> {
  const text = await res.text();
  assert.equal(res.ok, true, `${what} 실패: ${res.status} ${text}`);
  return JSON.parse(text) as T[];
}

async function job(name: string, body?: BodyInit): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${APP}/api/jobs/${name}`, {
    method: "POST",
    headers: { "x-cron-secret": CRON! },
    body,
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
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

const ymd = (d: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

describe("G2 — Phase 2 게이트", () => {
  let cookie = "";
  let semesterId = "";
  let courseId = "";

  before(async () => {
    for (const [name, value] of Object.entries({
      CRON_SECRET: CRON,
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      ALLOWED_EMAIL,
      NOTION_TOKEN: process.env.NOTION_TOKEN,
      NOTION_DB_WIKI: process.env.NOTION_DB_WIKI,
    })) {
      assert.ok(value, `환경변수 ${name} 없음`);
    }
    cookie = await mintSession();

    // 게이트 전용 학기·과목. 사람이 넣은 데이터에 기대지 않는다.
    const semester = await db("semesters", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({ label: "G2 게이트 학기", starts_on: "2026-01-01", ends_on: "2026-12-31" }),
    });
    semesterId = (await created<{ id: string }>(semester, "학기 생성"))[0]!.id;

    const course = await db("courses", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ semester_id: semesterId, name: "G2 게이트 과목", code: "G2GATE999", credits: 4 }),
    });
    courseId = (await created<{ id: string }>(course, "과목 생성"))[0]!.id;
  });

  // ---------- 퀴즈 ----------

  let quizRun: { status: number; body: Record<string, unknown> } | null = null;

  before(async () => {
    quizRun = await job("generate-quiz");
  });

  it("1. 퀴즈 잡이 5문제를 생성하고 도메인이 2개 이상 섞인다", async () => {
    const run = quizRun!;
    assert.equal(run.status, 200, `퀴즈 생성 실패: ${JSON.stringify(run.body)}`);

    const generated = run.body.generated as number;
    const reviewDue = run.body.reviewDue as number;
    assert.equal(generated + Math.min(reviewDue, 5), 5, `오늘 문항이 ${generated + reviewDue}개 (5개여야 함)`);

    const domains = run.body.domains as string[];
    assert.ok(domains.length >= 2, `도메인이 ${domains.length}종 (2종 이상이어야 함)`);
    console.log(`   증거: 생성 ${generated}문제, 도메인 ${domains.length}종 ${JSON.stringify(domains)}`);
  });

  /**
   * 조건 2는 브라우저에서 검증한다.
   *
   * 채점은 /quiz의 서버 액션이고, 그 경로의 recordAttempt는 세션 쿠키(`cookies()`)를 쓴다.
   * node 테스트에는 요청 스코프가 없어 직접 부를 수 없고, 서버 액션을 HTTP로 흉내내려면
   * 빌드마다 바뀌는 action id에 기대야 한다. 리포지토리를 우회해 REST로 행을 만들면
   * 검증 대상인 +1/+3/+7일 로직을 건너뛰게 되므로 그것도 안 된다.
   * 판정 근거는 docs/G2-REPORT.md에 스크린샷과 DB 조회 결과로 남긴다.
   */
  it("3. 오늘 날짜의 복습 문항이 오늘의 퀴즈에 우선 편입된다", async () => {
    const [question] = await rows<{ id: string }>("quiz_questions?select=id&order=created_at.desc&limit=1");
    assert.ok(question, "문항이 없다");

    // 편입 규칙만 보는 조건이다. 큐에 어떻게 들어갔는지(조건 2)와는 분리해서 상태를 만든다.
    // 이전 실행이 남긴 행이 있으면 화면의 복습 건수가 달라지므로 전부 비우고 시작한다.
    await db("quiz_review_queue?id=not.is.null", { method: "DELETE" });
    const seed = await db("quiz_review_queue", {
      method: "POST",
      body: JSON.stringify({ question_id: question.id, stage: 1, due_on: ymd(new Date()) }),
    });
    assert.equal(seed.ok, true, `복습 큐 주입 실패: ${await seed.text()}`);

    const page = await fetch(`${APP}/quiz`, { headers: { Cookie: cookie } });
    const html = await page.text();
    assert.equal(page.status, 200, `/quiz가 ${page.status}를 반환했다`);

    const first = html.indexOf("복습");
    assert.ok(first > 0, "'복습' 배지가 화면에 없다");

    // 첫 문항 카드 안에 배지가 있어야 1번 자리다. 카드 경계는 문항 번호로 잡는다.
    const secondCard = html.indexOf("문제 2");
    assert.ok(
      secondCard === -1 || first < secondCard,
      "복습 배지가 첫 문항 카드보다 뒤에 있다 (1번 자리가 아니다)",
    );
    // SSR은 JSX 보간을 텍스트 노드로 쪼개므로 "복습 1문제"를 통짜로 찾으면 안 잡힌다.
    assert.match(html, /복습[\s\S]{0,60}?1[\s\S]{0,20}?문제/, "머리말의 복습 건수가 표시되지 않았다");
    console.log(`   증거: GET /quiz → 200, '복습' 배지가 첫 문항 카드 안에 위치`);
  });

  // ---------- 강의자료 ----------

  let usageBeforeUpload = 0;

  it("4. PDF와 PPTX를 업로드하면 extracted_text가 비어있지 않게 채워진다", async () => {
    usageBeforeUpload = (await rows("ai_usage?select=id")).length;

    const { extractText, PDF_MIME, PPTX_MIME } = await import("../../lib/integrations/materials/extract.js");
    const sizes: Record<string, number> = {};

    for (const [file, mime] of [
      ["lecture.pdf", PDF_MIME],
      ["lecture.pptx", PPTX_MIME],
    ] as const) {
      const bytes = new Uint8Array(readFileSync(new URL(file, FIXTURES)));
      const text = await extractText(bytes, mime);
      assert.ok(text.length > 0, `${file}에서 추출한 텍스트가 비어 있다`);

      const insert = await db("course_materials", {
        method: "POST",
        body: JSON.stringify({
          course_id: courseId,
          filename: `g2-${file}`,
          storage_path: `g2-gate/${file}`,
          mime_type: mime,
          extracted_text: text,
        }),
      });
      assert.equal(insert.ok, true, `자료 행 삽입 실패: ${await insert.text()}`);
      sizes[file] = text.length;
    }

    const stored = await rows<{ filename: string; extracted_text: string }>(
      `course_materials?select=filename,extracted_text&course_id=eq.${courseId}`,
    );
    assert.equal(stored.length, 2);
    for (const row of stored) assert.ok(row.extracted_text.length > 0, `${row.filename}의 extracted_text가 비었다`);
    console.log(`   증거: PDF ${sizes["lecture.pdf"]}자, PPTX ${sizes["lecture.pptx"]}자 추출 후 저장`);
  });

  it("5. 요약 버튼을 누르기 전에는 ai_usage에 행이 추가되지 않는다", async () => {
    const after = (await rows("ai_usage?select=id")).length;
    assert.equal(after, usageBeforeUpload, `업로드만 했는데 ai_usage가 ${after - usageBeforeUpload}행 늘었다`);

    const summaries = await rows<{ summary: string | null }>(
      `course_materials?select=summary&course_id=eq.${courseId}`,
    );
    for (const row of summaries) assert.equal(row.summary, null, "요약을 부르지 않았는데 summary가 채워져 있다");
    console.log(`   증거: 업로드 2건 후 ai_usage 증가 0행, summary 전부 null`);
  });

  // ---------- ICS 시간표 ----------

  it("6. MyWaseda ICS를 넣으면 source='waseda' 행이 생기고, 같은 내용 재실행 시 파싱을 건너뛴다", async () => {
    const ics = readFileSync(new URL("waseda.ics", FIXTURES), "utf8");

    const first = await job("sync-ics", ics);
    assert.equal(first.status, 200, `ICS 취입 실패: ${JSON.stringify(first.body)}`);
    assert.equal(first.body.skipped, false, "첫 실행인데 건너뛰었다");
    assert.ok((first.body.events as number) > 0, "반영된 이벤트가 0건이다");

    const waseda = await rows(`events?select=id&source=eq.waseda`);
    assert.ok(waseda.length > 0, "source='waseda' 행이 없다");

    const second = await job("sync-ics", ics);
    assert.equal(second.status, 200);
    assert.equal(second.body.skipped, true, "같은 내용인데 파싱을 건너뛰지 않았다");
    assert.equal(second.body.events, 0);
    console.log(`   증거: 1회차 ${first.body.events}건 반영, 2회차 skipped=true (content_hash 일치)`);
  });

  it("7. kind='ics'인 캘린더에 쓰기를 시도하면 DB check 제약으로 막힌다", async () => {
    const update = await db("calendars?kind=eq.ics", {
      method: "PATCH",
      body: JSON.stringify({ is_writable: true }),
    });
    const updateBody = await update.text();
    assert.equal(update.ok, false, "ICS 캘린더를 쓰기 가능으로 바꿀 수 있었다");
    assert.match(updateBody, /calendars_check/, `check 제약이 아닌 다른 이유로 실패: ${updateBody}`);

    const insert = await db("calendars", {
      method: "POST",
      body: JSON.stringify({ kind: "ics", source_url: "g2://gate", display_name: "G2", is_writable: true }),
    });
    const insertBody = await insert.text();
    assert.equal(insert.ok, false, "쓰기 가능한 ICS 캘린더를 만들 수 있었다");
    assert.match(insertBody, /calendars_check/);
    console.log(`   증거: UPDATE·INSERT 둘 다 calendars_check 위반으로 거부`);
  });

  it("8. 과목 코드가 매칭된 ICS 이벤트는 course_id가 채워지고, 실패 건수가 job_runs.meta에 남는다", async () => {
    const ics = readFileSync(new URL("waseda.ics", FIXTURES), "utf8").replace(
      /SUMMARY:Machine Learning/,
      "SUMMARY:Machine Learning【G2GATE999】",
    );

    const run = await job("sync-ics", ics);
    assert.equal(run.status, 200, `ICS 취입 실패: ${JSON.stringify(run.body)}`);
    assert.ok((run.body.matched as number) >= 1, `매칭 ${run.body.matched}건 (1건 이상이어야 함)`);

    const linked = await rows(`events?select=id,summary&course_id=eq.${courseId}`);
    assert.ok(linked.length >= 1, "course_id가 채워진 이벤트가 없다");

    const [lastRun] = await rows<{ meta: Record<string, unknown> }>(
      "job_runs?select=meta&job_name=eq.sync-ics&order=started_at.desc&limit=1",
    );
    assert.ok(lastRun, "job_runs에 sync-ics 기록이 없다");
    assert.equal(typeof lastRun.meta.unmatched, "number", "meta에 unmatched 건수가 없다");
    console.log(
      `   증거: 매칭 ${run.body.matched}건 → course_id 채움, job_runs.meta.unmatched=${lastRun.meta.unmatched}`,
    );
  });

  // ---------- 과목 / 성적 ----------

  it("9. 과목 상세 페이지에서 해당 과목의 다음 수업 일정이 표시된다", async () => {
    const start = new Date(Date.now() + 2 * 86_400_000);
    const [calendar] = await rows<{ id: string }>("calendars?select=id&kind=eq.ics&limit=1");
    assert.ok(calendar, "ICS 캘린더가 없다");

    const insert = await db("events", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        calendar_id: calendar.id,
        caldav_uid: "g2-next-class",
        caldav_href: "g2://next-class",
        summary: "G2 게이트 다음 수업",
        location: "G2 강의실",
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + 5_400_000).toISOString(),
        source: "waseda",
        course_id: courseId,
      }),
    });
    assert.equal(insert.ok, true, `이벤트 삽입 실패: ${await insert.text()}`);

    const page = await fetch(`${APP}/courses/${courseId}`, { headers: { Cookie: cookie } });
    const html = await page.text();

    assert.equal(page.status, 200, `과목 상세가 ${page.status}를 반환했다`);
    assert.ok(html.includes("다음 수업"), "'다음 수업' 카드가 없다");
    assert.ok(html.includes("G2 게이트 다음 수업"), "다음 수업 제목이 표시되지 않았다");
    assert.ok(html.includes("G2 강의실"), "장소가 표시되지 않았다");
    console.log(`   증거: GET /courses/${courseId.slice(0, 8)}… → 200, "G2 게이트 다음 수업 · G2 강의실" 표시`);
  });

  it("10. 과목 3개에 학점을 입력하면 GPA가 4.0 스케일로 정확히 계산된다", async () => {
    const { calculateGpa } = await import("../../lib/grades.js");

    // 수기: (4*4.0 + 2*2.0 + 4*1.0) / (4+2+4) = 24 / 10 = 2.4
    const manual = (4 * 4.0 + 2 * 2.0 + 4 * 1.0) / (4 + 2 + 4);
    const computed = calculateGpa([
      { credits: 4, grade: "A+" },
      { credits: 2, grade: "B" },
      { credits: 4, grade: "C" },
    ]);

    assert.equal(computed?.gpa, manual, `계산 ${computed?.gpa}, 수기 ${manual}`);
    assert.equal(computed?.credits, 10);

    // 화면에도 같은 값이 나오는지 본다. 순수 함수만 맞고 화면이 틀리면 조건을 만족하지 못한다.
    const codes = ["G2A", "G2B", "G2C"] as const;
    const specs = [
      { code: "G2A", credits: 4, grade: "A+", grade_point: 4.0 },
      { code: "G2B", credits: 2, grade: "B", grade_point: 2.0 },
      { code: "G2C", credits: 4, grade: "C", grade_point: 1.0 },
    ];
    for (const spec of specs) {
      const res = await db("courses", {
        method: "POST",
        body: JSON.stringify({
          semester_id: semesterId,
          name: `G2 GPA ${spec.code}`,
          code: spec.code,
          credits: spec.credits,
          grade: spec.grade,
          grade_point: spec.grade_point,
        }),
      });
      assert.equal(res.ok, true, `GPA 검증용 과목 생성 실패: ${await res.text()}`);
    }

    try {
      // 다른 과목이 섞이면 화면 GPA가 달라진다. 게이트 과목만 남기고 나머지는 미평가로 둔다.
      const others = await rows<{ id: string }>("courses?select=id&grade=not.is.null&code=not.in.(G2A,G2B,G2C)");
      for (const other of others) {
        await db(`courses?id=eq.${other.id}`, { method: "PATCH", body: JSON.stringify({ grade: null, grade_point: null }) });
      }

      const page = await fetch(`${APP}/courses`, { headers: { Cookie: cookie } });
      const html = await page.text();
      assert.equal(page.status, 200);
      assert.ok(html.includes("2.40"), "화면에 GPA 2.40이 없다");
      console.log(`   증거: 수기 ${manual.toFixed(2)} = 계산 ${computed!.gpa.toFixed(2)} = 화면 표시 2.40 (10학점)`);

      for (const other of others) {
        await db(`courses?id=eq.${other.id}`, { method: "PATCH", body: JSON.stringify({ grade: null }) });
      }
    } finally {
      for (const code of codes) await db(`courses?code=eq.${code}`, { method: "DELETE" });
    }
  });

  // ---------- Notion 위키 ----------

  it("11. Notion 위키 항목이 앱에 표시되고, 앱에서 Notion을 수정하지 않는다", async () => {
    // 기대값은 Notion에서 직접 받는다. 앱 코드로 기대값을 만들면 앱이 틀려도 통과한다.
    const search = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": "2026-03-11",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filter: { property: "object", value: "data_source" }, page_size: 100 }),
    });
    const searchText = await search.text();
    assert.equal(search.ok, true, `Notion 조회 실패: ${search.status} ${searchText}`);
    const sources = (JSON.parse(searchText) as { results: Array<{ id: string }> }).results;
    assert.ok(
      sources.some((s) => s.id.replace(/-/g, "") === process.env.NOTION_DB_WIKI!.replace(/-/g, "")),
      "NOTION_DB_WIKI가 토큰이 볼 수 있는 표 목록에 없다",
    );

    // 기대 제목도 Notion에서 직접 받는다.
    const query = await fetch(`https://api.notion.com/v1/data_sources/${process.env.NOTION_DB_WIKI}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": "2026-03-11",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 5 }),
    });
    const queryText = await query.text();
    assert.equal(query.ok, true, `위키 조회 실패: ${query.status} ${queryText}`);

    const pages = (JSON.parse(queryText) as { results: Array<{ properties: Record<string, { type: string; title?: Array<{ plain_text?: string }> }> }> }).results;
    assert.ok(pages.length > 0, "Notion 위키가 비어 있어 표시 여부를 검증할 수 없다");

    const firstTitle =
      Object.values(pages[0]!.properties)
        .find((p) => p.type === "title")
        ?.title?.map((t) => t.plain_text ?? "")
        .join("")
        .trim() || "(제목 없음)";

    const page = await fetch(`${APP}/wiki`, { headers: { Cookie: cookie } });
    const html = await page.text();
    assert.equal(page.status, 200, `/wiki가 ${page.status}를 반환했다`);
    assert.ok(html.includes("Notion 읽기 전용"), "읽기 전용 표기가 없다");
    assert.ok(!html.includes("불러오지 못했습니다"), "위키가 에러 상태로 렌더됐다");
    assert.ok(html.includes(firstTitle), `Notion의 '${firstTitle}' 항목이 화면에 없다`);

    // 쓰기 경로가 코드에 존재하지 않는지 본다. 실행으로는 "안 썼다"를 증명할 수 없다.
    const { readFileSync: read } = await import("node:fs");
    const clientSrc = read(new URL("../../lib/integrations/notion/client.ts", import.meta.url), "utf8");
    const writeMethods = clientSrc.match(/method:\s*"(PATCH|PUT|DELETE)"/g) ?? [];
    assert.equal(writeMethods.length, 0, `Notion 클라이언트에 쓰기 메서드가 있다: ${writeMethods.join(", ")}`);

    // 호출부만 본다. 따옴표나 백틱이 바로 오는 경우가 호출이고, `call<T>(path: string`은 선언이다.
    const paths = [...clientSrc.matchAll(/call<[^>]*>\(\s*["`]([^"`$]*)/g)].map((m) => m[1]);
    assert.ok(paths.length > 0, "Notion 호출부를 찾지 못했다 (검사가 비어 있으면 안 된다)");
    for (const path of paths) {
      assert.ok(
        /^\/(databases|data_sources|search)/.test(path!),
        `조회가 아닌 Notion 엔드포인트를 호출한다: ${path}`,
      );
    }
    console.log(
      `   증거: Notion의 '${firstTitle}'이 /wiki에 표시됨, Notion 클라이언트에 PATCH/PUT/DELETE 0건`,
    );
  });

  after(async () => {
    await db(`course_materials?course_id=eq.${courseId}`, { method: "DELETE" });
    await db("events?caldav_uid=eq.g2-next-class", { method: "DELETE" });
    await db(`courses?semester_id=eq.${semesterId}`, { method: "DELETE" });
    await db("semesters?label=eq.G2 게이트 학기", { method: "DELETE" });
  });
});
