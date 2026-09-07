/** Optional live public-source probe. --extract uses paid AI with local usage DB. */
import { config } from "dotenv";
import { fetchOfficialCareerSourceForJob, extractCareerRequirementsForJob } from "../lib/repos/career-sources";
import { monthlyCostUsd } from "../lib/repos/ai-usage";
config({ path: ".env.local", quiet: true });

async function main() {
  const url = process.argv[2];
  if (!url) throw new Error("Usage: probe-career-source.ts PUBLIC_HTTPS_URL [--extract]");
  const extract = process.argv.includes("--extract");
  if (extract && (process.env.GATE_ISOLATED_DB !== "1" || process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54621")) throw new Error("Live extraction probe requires the dedicated local usage database");
  const source = await fetchOfficialCareerSourceForJob(url);
  const summary = { kind: source.kind, url: source.url, httpStatus: source.httpStatus, checkedAt: source.checkedAt,
    title: source.title, characters: source.text?.length, hash: source.contentHash, error: source.error };
  if (source.kind !== "ok" || !source.text) { console.log(JSON.stringify(summary)); process.exitCode = 1; return; }
  if (!extract) { console.log(JSON.stringify(summary)); return; }
  const before = await monthlyCostUsd();
  const candidates = await extractCareerRequirementsForJob(source.text, crypto.randomUUID(), source.url);
  const after = await monthlyCostUsd();
  if (candidates.requirementsComplete || candidates.requirements.some((rule) => rule.reviewed)) throw new Error("Extraction must not mark evidence reviewed");
  console.log(JSON.stringify({ ...summary, extraction: { count: candidates.requirements.length,
    unknown: candidates.requirements.filter((rule) => rule.operator === "unknown").length,
    lifecycle: candidates.lifecycle, complete: candidates.requirementsComplete, warnings: candidates.warnings,
    usageCostDeltaUsd: Number((after - before).toFixed(6)) } }));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
