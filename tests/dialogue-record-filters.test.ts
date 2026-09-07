import test from "node:test";
import assert from "node:assert/strict";
import { literalContainsPattern, filterDialogueCareer, dialogueTaskStatusLabel } from "../lib/jarvis/dialogue-record-filters";

test("title query escapes regex while keeping percent/underscore/asterisk literal", () => {
  assert.equal(literalContainsPattern("100%_확인\\문서"), "100%_확인\\\\문서");
  assert.equal(literalContainsPattern("a*b.(c)+[d]?$"), "a\\*b\\.\\(c\\)\\+\\[d\\]\\?\\$");
});
test("dropped or unknown task statuses are never called open", () => {
  assert.equal(dialogueTaskStatusLabel("dropped"), "중단한");
  assert.equal(dialogueTaskStatusLabel("new-status"), "상태 미확인");
});
test("career filters use structured eligibility and match before the display limit", () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: i, title: i === 25 ? "AI Internship" : "샘플 공고",
    assessment: { eligibility: i === 25 ? "confirmed_eligible" : "possibly_eligible" } }));
  assert.deepEqual(filterDialogueCareer(rows, { eligibility: "confirmed_eligible", keyword: "ai" }).map(r => r.id), [25]);
  assert.equal(filterDialogueCareer(rows, {}).length, 30);
  assert.equal(filterDialogueCareer(rows, { keyword: "%" }).length, 0);
  assert.equal(rows.length, 30);
});
