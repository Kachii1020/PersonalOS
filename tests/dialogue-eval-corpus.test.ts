import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

test("version1 dialogue evaluation keeps its pre-baseline 100-scenario oracle unchanged", () => {
  const raw = readFileSync(new URL("./fixtures/dialogue-eval.json", import.meta.url), "utf8");
  assert.equal(createHash("sha256").update(raw).digest("hex"), "c08e659b0325776b7171ecd333b497be5d14396d5ecfd8b9a16d17d9b8b8aa8a");
  const corpus = JSON.parse(raw);
  assert.equal(corpus.version, 1); assert.equal(corpus.cases.length, 100);
  assert.equal(new Set(corpus.cases.map((c: { id: string }) => c.id)).size, 100);
  assert.equal(new Set(corpus.cases.map((c: { messages: unknown }) => JSON.stringify(c.messages))).size, 100);
  for (const c of corpus.cases) {
    assert.equal(c.messages.at(-1).role, "user"); assert.ok(c.messages.length <= 6);
    if (c.selectedSourceId) assert.ok(corpus.sources.some((s: { id: string }) => s.id === c.selectedSourceId));
  }
});
