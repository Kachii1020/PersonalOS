import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("dashboard navigation does not prefetch every database-backed route",()=>{
  const sidebar=readFileSync(new URL("../components/shell/sidebar.tsx",import.meta.url),"utf8");
  const tabs=readFileSync(new URL("../components/shell/bottom-tab-bar.tsx",import.meta.url),"utf8");
  assert.match(sidebar,/<Link\s+prefetch=\{false\}\s+href=\{item\.href\}/);
  assert.match(tabs,/<Link\s+prefetch=\{false\}\s+href=\{item\.href\}/);
});
