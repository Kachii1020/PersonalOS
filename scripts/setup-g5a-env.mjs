// Run after starting the isolated stack documented in PHASE5A-APPLY.md.
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";

if (existsSync(".env.local")) throw new Error("Refusing to overwrite .env.local");
const values = parse(execFileSync("./node_modules/.bin/supabase", [
  "status", "--workdir", "test-results/g5a-stack", "-o", "env",
], { encoding: "utf8" }));
if (values.API_URL !== "http://127.0.0.1:54621") throw new Error("Expected isolated G5A API on 54621");
const env = {
  NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
  ALLOWED_EMAIL: "phase5a@example.test",
  GATE_ISOLATED_DB: "1",
  CRON_SECRET: "g5a-local-test-only",
  AI_MONTHLY_BUDGET_USD: "10",
  G1_APP_URL: "http://localhost:3055",
  G2_APP_URL: "http://localhost:3055",
  G3_APP_URL: "http://localhost:3055",
  G4_APP_URL: "http://localhost:3055",
  G5A_APP_URL: "http://localhost:3055",
};
for (const [key, value] of Object.entries(env)) if (!value) throw new Error(`Missing ${key}`);
writeFileSync(".env.local", Object.entries(env).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join("\n") + "\n", { mode: 0o600 });
console.log("Created ignored .env.local for isolated G5A stack; no external service credentials copied.");
