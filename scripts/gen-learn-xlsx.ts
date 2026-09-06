import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildHandsXlsx } from "../lib/integrations/xlsx/build-hands";
import { buildPivotXlsx } from "../lib/integrations/xlsx/build-pivot";
import { buildPqXlsx } from "../lib/integrations/xlsx/build-pq";

const files = [
  { path: join("public/learn/xlsx/hands-starter.xlsx"), bytes: buildHandsXlsx("starter") },
  { path: join("tests/fixtures/learn/hands-pass.xlsx"), bytes: buildHandsXlsx("pass") },
  { path: join("tests/fixtures/learn/hands-fail-sum.xlsx"), bytes: buildHandsXlsx("fail-sum") },
  { path: join("public/learn/xlsx/pivot-starter.xlsx"), bytes: buildPivotXlsx("starter") },
  { path: join("tests/fixtures/learn/pivot-pass.xlsx"), bytes: buildPivotXlsx("pass") },
  { path: join("tests/fixtures/learn/pivot-fail-part.xlsx"), bytes: buildPivotXlsx("fail-part") },
  { path: join("public/learn/xlsx/pq-starter.xlsx"), bytes: buildPqXlsx("starter") },
  { path: join("tests/fixtures/learn/pq-pass.xlsx"), bytes: buildPqXlsx("pass") },
  { path: join("tests/fixtures/learn/pq-fail-query.xlsx"), bytes: buildPqXlsx("fail-query") },
];

for (const file of files) {
  mkdirSync(dirname(file.path), { recursive: true });
  writeFileSync(file.path, file.bytes);
}

console.log(`wrote ${files.map((file) => file.path).join(", ")}`);
