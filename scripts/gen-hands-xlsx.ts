import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildHandsXlsx } from "../lib/integrations/xlsx/build-hands";

const files = [
  { kind: "starter" as const, path: join("public/learn/xlsx/hands-starter.xlsx") },
  { kind: "pass" as const, path: join("tests/fixtures/learn/hands-pass.xlsx") },
  { kind: "fail-sum" as const, path: join("tests/fixtures/learn/hands-fail-sum.xlsx") },
];

for (const file of files) {
  mkdirSync(dirname(file.path), { recursive: true });
  writeFileSync(file.path, buildHandsXlsx(file.kind));
}

console.log(`wrote ${files.map((f) => f.path).join(", ")}`);
