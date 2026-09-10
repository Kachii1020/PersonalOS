import test from "node:test";
import assert from "node:assert/strict";
import { QUIZ_DOMAINS } from "@/lib/ai/prompts/quiz";
import { IB_ENG_DOMAINS, IB_ENG_LESSONS, IB_ENG_PER_DOMAIN, IB_ENG_QUESTIONS, ibEngModuleSlug } from "@/lib/quiz/ib-eng";
import { pickDailySet } from "@/lib/quiz/pick-daily";

test("IB eng 은행은 6도메인 × 15문항이다", () => {
  assert.deepEqual(
    QUIZ_DOMAINS,
    [
      "ib_eng_markets",
      "ib_eng_latency",
      "ib_eng_concurrency",
      "ib_eng_data",
      "ib_eng_systems",
      "ib_eng_ds",
    ],
  );
  assert.equal(IB_ENG_DOMAINS.length, 6);
  assert.equal(IB_ENG_LESSONS.length, 6);
  assert.equal(IB_ENG_QUESTIONS.length, 6 * IB_ENG_PER_DOMAIN);

  for (const domain of QUIZ_DOMAINS) {
    assert.equal(
      IB_ENG_QUESTIONS.filter((q) => q.domain === domain).length,
      IB_ENG_PER_DOMAIN,
      domain,
    );
    assert.ok(IB_ENG_LESSONS.some((lesson) => lesson.domain === domain), domain);
  }
});

test("문항 id는 유일하고 보기·정답 인덱스가 맞다", () => {
  const ids = IB_ENG_QUESTIONS.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
  const slugs = ids.map(ibEngModuleSlug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.ok(slugs.every((slug) => slug.startsWith("ib_eng/")));

  for (const q of IB_ENG_QUESTIONS) {
    assert.equal(q.choices.length, 4, q.id);
    assert.ok(q.answer >= 0 && q.answer < 4, q.id);
    assert.ok(q.question.length > 8, q.id);
    assert.ok(q.explanation.length > 8, q.id);
    assert.ok(q.hint.length > 4, q.id);
    assert.equal(new Set(q.choices).size, 4, q.id);
  }
});

test("은행은 엑셀 모델링·DCF를 문제로 내지 않는다", () => {
  for (const q of IB_ENG_QUESTIONS) {
    const blob = `${q.question} ${q.explanation}`.toLowerCase();
    assert.equal(/dcf|wacc|ebitda|sumifs/.test(blob), false, q.id);
  }
});

test("pickDailySet는 복습을 앞에 두고 도메인을 섞는다", () => {
  const questions = QUIZ_DOMAINS.flatMap((domain) =>
    [0, 1].map((i) => ({
      id: `${domain}-${i}`,
      domain,
      curated: true,
    })),
  );
  const due = ["ib_eng_ds-0", "ib_eng_markets-0"];
  const picked = pickDailySet({
    size: 5,
    dueIds: due,
    questions,
    attemptedIds: new Set(),
  });
  assert.equal(picked[0], "ib_eng_ds-0");
  assert.equal(picked[1], "ib_eng_markets-0");
  assert.equal(picked.length, 5);
  const domains = new Set(picked.map((id) => questions.find((q) => q.id === id)?.domain));
  assert.ok(domains.size >= 2);
});

test("pickDailySet는 지정 도메인만 고른다", () => {
  const questions = IB_ENG_QUESTIONS.map((q, i) => ({
    id: `${q.domain}-${i}`,
    domain: q.domain,
    curated: true,
  }));
  const picked = pickDailySet({
    size: 5,
    dueIds: [],
    questions,
    attemptedIds: new Set(),
    domain: "ib_eng_markets",
  });
  assert.equal(picked.length, 5);
  assert.ok(picked.every((id) => id.startsWith("ib_eng_markets")));
});

test("엑셀 도메인은 오늘 세트에서 빠진다", () => {
  const picked = pickDailySet({
    size: 5,
    dueIds: ["xlsx"],
    questions: [
      { id: "xlsx", domain: "excel_finance", curated: false },
      { id: "a", domain: "ib_eng_markets", curated: true },
      { id: "b", domain: "ib_eng_latency", curated: true },
    ],
    attemptedIds: new Set(),
  });
  assert.equal(picked.includes("xlsx"), false);
  assert.deepEqual(new Set(picked), new Set(["a", "b"]));
});
