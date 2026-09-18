import test from "node:test";
import assert from "node:assert/strict";
import { allConcepts } from "@/lib/learn/curriculum";
import { HANDS_CONCEPTS, XLSX_TASKS } from "@/lib/learn/xlsx-tasks";

test("슬라이스 1은 hands 한 과제와 연결 개념 8개만 매핑한다", () => {
  assert.equal(XLSX_TASKS.length, 1);
  assert.equal(XLSX_TASKS[0].id, "hands");
  assert.deepEqual([...XLSX_TASKS[0].conceptIds].sort(), [...HANDS_CONCEPTS].sort());

  const byId = new Map(allConcepts().map((concept) => [concept.id, concept]));
  for (const id of HANDS_CONCEPTS) {
    const concept = byId.get(id);
    assert.ok(concept, id);
    assert.equal(concept.kind, "excel-only", id);
    assert.equal(concept.xlsxTaskId, "hands", id);
  }

  const excelOnly = allConcepts().filter((concept) => concept.kind === "excel-only");
  assert.equal(excelOnly.length, 31);

  const mapped = excelOnly.filter((concept) => concept.xlsxTaskId);
  assert.equal(mapped.length, HANDS_CONCEPTS.length);
  assert.ok(mapped.every((concept) => concept.xlsxTaskId === "hands"));

  for (const concept of allConcepts()) {
    if (concept.kind === "grid") {
      assert.equal(concept.xlsxTaskId, undefined, concept.id);
    }
  }
});
