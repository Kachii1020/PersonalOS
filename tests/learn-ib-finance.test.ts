import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { allModules, allQuizzes, CURRICULUM } from "@/lib/learn/curriculum";
import { isLabTrack, parseTopic } from "@/lib/learn/topic";

const SEED = readFileSync("supabase/seed-ib-finance.sql", "utf8");
const EXCEL_SEED = readFileSync("supabase/seed-excel-finance.sql", "utf8");

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

test("토픽 줄은 type·제목·리소스로 나뉜다", () => {
  const row = parseTopic("[practice] 3-statement 연결 — Net Income → CF | CFI 3-Statement Model Course");
  assert.equal(row.kind, "practice");
  assert.equal(row.title, "3-statement 연결 — Net Income → CF");
  assert.equal(row.resource, "CFI 3-Statement Model Course");
  assert.equal(parseTopic("접두사 없는 줄").kind, "concept");
});

test("시드에 트랙 1·페이즈 3·모듈 6·퀴즈 30", () => {
  assert.match(SEED, /slug = 'ib-finance'/);
  assert.equal((SEED.match(/insert into learn_phases/g) ?? []).length, 1);
  assert.equal((SEED.match(/phase_number/g) ?? []).filter((s) => s).length >= 3, true);
  assert.match(SEED, /'accounting'/);
  assert.match(SEED, /'excel-modeling'/);
  assert.match(SEED, /'valuation'/);
  assert.match(SEED, /'markets'/);
  assert.match(SEED, /'python-fin'/);
  assert.match(SEED, /'vba'/);

  const quizRows = [...SEED.matchAll(/\('ib_finance', '([^']+)', '(\d+)'/g)];
  assert.equal(quizRows.length, 30);
  const byMod = new Map<string, number>();
  for (const row of quizRows) {
    byMod.set(row[1], (byMod.get(row[1]) ?? 0) + 1);
  }
  for (const slug of ["accounting", "excel-modeling", "valuation", "markets", "python-fin", "vba"]) {
    assert.equal(byMod.get(slug), 5, slug);
  }
});

test("퀴즈 answer_index는 0–3", () => {
  const answers = [...SEED.matchAll(/\], (\d),/g)].map((m) => Number(m[1]));
  assert.ok(answers.length >= 30);
  for (const n of answers) {
    assert.ok(n >= 0 && n <= 3, String(n));
  }
});

test("excel_finance 시드와 코드 커리큘럼은 그대로다", () => {
  assert.equal((EXCEL_SEED.match(/'excel_finance'/g) ?? []).length >= 22, true);
  assert.doesNotMatch(SEED, /'excel_finance'/);
  assert.equal(CURRICULUM.length, 3);
  assert.equal(allModules().length, 10);
  assert.equal(allQuizzes().length, 50);
});

test("실습 트랙 판정은 모듈 slug 교집합이다", () => {
  const labs = allModules().map((m) => m.id);
  assert.equal(isLabTrack(["nav", "basic-fn"], labs), true);
  assert.equal(isLabTrack(["accounting", "vba"], labs), false);
});

test("ib_finance 문자열은 repos와 seed에만 있다", () => {
  const banned = /ib[_-]finance/i;
  const roots = ["components", "app", "lib"];
  const hits: string[] = [];
  for (const root of roots) {
    for (const file of walk(root)) {
      if (file.startsWith("lib/repos/")) continue;
      const text = readFileSync(file, "utf8");
      if (banned.test(text)) hits.push(file);
    }
  }
  assert.deepEqual(hits, []);
});
