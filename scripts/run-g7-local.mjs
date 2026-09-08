/** Dedicated local stack only; never loads production integration credentials. */
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { parse } from "dotenv";

const local = parse(readFileSync(".env.eval.local"));
if (local.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54721" || local.GATE_ISOLATED_DB !== "1" || local.ALLOWED_EMAIL !== "phase5a@example.test") throw Error("Dedicated G7 local configuration required");
if (Object.keys(local).some(key => /APPLE|NOTION|VAPID_PRIVATE/.test(key))) throw Error("External execution credentials are not allowed in this runner");
// Next.js also reads these files after spawning; do not let a missing child
// variable fall back to an unrelated real integration credential.
for (const path of [".env", ".env.local", ".env.development", ".env.development.local", ".env.production", ".env.production.local"]) {
  if (existsSync(path) && Object.entries(parse(readFileSync(path))).some(([key, value]) => /APPLE|NOTION|VAPID_PRIVATE/.test(key) && value)) throw Error(`External execution configuration in ${path}; use an isolated worktree`);
}
const [mode = "dev", ...args] = process.argv.slice(2);
const env = { ...process.env, ...local, JARVIS_CONTEXT_ENABLED: "true", JARVIS_INLINE_APPROVALS_ENABLED: "true", JARVIS_ATTENTION_ENABLED: "true", JARVIS_AUTOMATIC_ATTENTION_ENABLED: "false", JARVIS_CALENDAR_ACTIONS_ENABLED: "false" };
for (const key of Object.keys(env)) if (/APPLE|NOTION|VAPID_PRIVATE/.test(key)) delete env[key];
if (mode === "eval") env.DIALOGUE_EVAL_ALLOW_LIVE = "1";
const command = mode === "dev" ? ["node_modules/next/dist/bin/next", "dev", "-p", "3055"] : mode === "build" ? ["node_modules/next/dist/bin/next", "build"] : mode === "test" ? ["--import", "tsx", "--conditions=react-server", "--test", "--test-concurrency=1", ...args] : mode === "eval" ? ["--import", "tsx", "--conditions=react-server", "scripts/eval-dialogue.ts", ...args] : null;
if (!command) throw Error("Use dev, build, test <test paths>, or eval <unique label>");
const child = spawn(process.execPath, command, { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code ?? 1; });
