import test from "node:test";
import assert from "node:assert/strict";
import {
  CORE_LAB_IDS,
  allConcepts,
  coreLabsForModule,
  extraLabsForModule,
  isCoreLab,
  practiceLabId,
  practiceOpensExtra,
} from "@/lib/learn/curriculum";
import { ALL_LAB_EXERCISES } from "@/lib/spreadsheet/exercises";

const CORE_COUNTS: Record<string, number> = {
  nav: 1,
  "basic-fn": 2,
  logic: 3,
  lookup: 3,
  pivot: 0,
  "data-clean": 2,
  "fin-fn": 3,
  "model-structure": 2,
  "three-stmt": 2,
  "dcf-intro": 2,
};

const LAB_IDS = new Set(ALL_LAB_EXERCISES.map((ex) => ex.id));

test("핵심 20개는 유일하고 레지스트리에 있다", () => {
  assert.equal(CORE_LAB_IDS.length, 20);
  assert.equal(new Set(CORE_LAB_IDS).size, 20);
  for (const id of CORE_LAB_IDS) {
    assert.ok(LAB_IDS.has(id), id);
    assert.equal(isCoreLab(id), true, id);
  }
  assert.equal(ALL_LAB_EXERCISES.length, 72);
  assert.equal(
    ALL_LAB_EXERCISES.filter((ex) => !isCoreLab(ex.id)).length,
    52,
  );
});

test("모듈 핵심 수는 LEARN-CORE 표와 같고 순서는 CORE_LAB_IDS 부분열", () => {
  const seen: string[] = [];
  for (const [slug, count] of Object.entries(CORE_COUNTS)) {
    const core = coreLabsForModule(slug);
    const extra = extraLabsForModule(slug);
    assert.equal(core.length, count, slug);
    assert.equal(extra.length + core.length, ALL_LAB_EXERCISES.filter((ex) => ex.moduleSlug === slug).length, slug);
    seen.push(...core.map((ex) => ex.id));
  }
  assert.deepEqual(seen, [...CORE_LAB_IDS]);
  assert.equal(coreLabsForModule("pivot").length, 0);
  assert.equal(extraLabsForModule("pivot").length, 1);
});

test("개념 「실습으로」는 핵심을 우선한다", () => {
  const byId = new Map(allConcepts().map((c) => [c.id, c]));

  const sumif = byId.get("logic-sumif");
  assert.ok(sumif);
  assert.equal(practiceLabId(sumif), "logic-sumifs");
  assert.equal(practiceOpensExtra(sumif), false);

  const aggregate = byId.get("basic-fn-aggregate");
  assert.ok(aggregate);
  assert.equal(practiceLabId(aggregate), "basic-fn-sum");

  const andOr = byId.get("logic-and-or");
  assert.ok(andOr);
  assert.equal(practiceLabId(andOr), "logic-and");
  assert.equal(practiceOpensExtra(andOr), true);

  const nav = byId.get("nav-ctrl-arrow");
  assert.ok(nav);
  assert.equal(practiceLabId(nav), undefined);
  assert.equal(practiceOpensExtra(nav), false);
});

test("핵심이 있는 grid 개념의 practiceLabId는 핵심이다", () => {
  for (const concept of allConcepts()) {
    if (concept.kind !== "grid") continue;
    const target = practiceLabId(concept);
    assert.ok(target, concept.id);
    assert.ok(LAB_IDS.has(target), `${concept.id} → ${target}`);
    if (concept.labIds.some((id) => isCoreLab(id))) {
      assert.equal(isCoreLab(target), true, concept.id);
      assert.equal(practiceOpensExtra(concept), false, concept.id);
    } else {
      assert.equal(isCoreLab(target), false, concept.id);
      assert.equal(practiceOpensExtra(concept), true, concept.id);
    }
  }
});
