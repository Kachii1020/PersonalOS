import test from "node:test";
import assert from "node:assert/strict";
import { allConcepts } from "@/lib/learn/curriculum";
import { HANDS_CONCEPTS, PIVOT_CONCEPTS, PQ_CONCEPTS, XLSX_TASKS } from "@/lib/learn/xlsx-tasks";

const SLICE2_CONCEPTS = [...HANDS_CONCEPTS, ...PIVOT_CONCEPTS, ...PQ_CONCEPTS] as const;

test("슬라이스 2는 hands·pivot·pq와 연결 개념 20개만 매핑한다", () => {
  assert.deepEqual(
    XLSX_TASKS.map((task) => task.id),
    ["hands", "pivot", "pq"],
  );
  assert.deepEqual([...XLSX_TASKS[0].conceptIds].sort(), [...HANDS_CONCEPTS].sort());
  assert.deepEqual([...XLSX_TASKS[1].conceptIds].sort(), [...PIVOT_CONCEPTS].sort());
  assert.deepEqual([...XLSX_TASKS[2].conceptIds].sort(), [...PQ_CONCEPTS].sort());

  const expectedTask: Record<string, string> = {};
  for (const id of HANDS_CONCEPTS) expectedTask[id] = "hands";
  for (const id of PIVOT_CONCEPTS) expectedTask[id] = "pivot";
  for (const id of PQ_CONCEPTS) expectedTask[id] = "pq";

  const byId = new Map(allConcepts().map((concept) => [concept.id, concept]));
  for (const id of SLICE2_CONCEPTS) {
    const concept = byId.get(id);
    assert.ok(concept, id);
    assert.equal(concept.kind, "excel-only", id);
    assert.equal(concept.xlsxTaskId, expectedTask[id], id);
  }

  const excelOnly = allConcepts().filter((concept) => concept.kind === "excel-only");
  assert.equal(excelOnly.length, 31);

  const mapped = excelOnly.filter((concept) => concept.xlsxTaskId);
  assert.equal(mapped.length, SLICE2_CONCEPTS.length);
  assert.ok(mapped.every((concept) => concept.xlsxTaskId && concept.xlsxTaskId in { hands: 1, pivot: 1, pq: 1 }));

  for (const concept of allConcepts()) {
    if (concept.kind === "grid") {
      assert.equal(concept.xlsxTaskId, undefined, concept.id);
    }
  }
});
