/**
 * VAPID 키를 만들고 `.env.local`에 넣는다. 값이 있는 키는 덮어쓰지 않는다.
 * 빈 자리표시자(`VAPID_PRIVATE_KEY=`)는 없는 것으로 본다.
 *
 *   npm run vapid:generate
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import webpush from "web-push";

const PATH = ".env.local";
const PUBLIC = "NEXT_PUBLIC_VAPID_PUBLIC_KEY";
const PRIVATE = "VAPID_PRIVATE_KEY";

function envValue(text: string, key: string): string | null {
  const match = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) return null;
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value.length > 0 ? value : null;
}

function upsertEnv(text: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) return text.replace(re, line);
  const prefix = text && !text.endsWith("\n") ? `${text}\n` : text;
  return `${prefix}${line}\n`;
}

function printKeys(publicKey: string, privateKey: string) {
  console.log(`${PUBLIC}=`);
  console.log(publicKey);
  console.log(`${PRIVATE}=`);
  console.log(privateKey);
}

function main() {
  const current = existsSync(PATH) ? readFileSync(PATH, "utf8") : "";
  const existingPublic = envValue(current, PUBLIC);
  const existingPrivate = envValue(current, PRIVATE);
  if (existingPublic && existingPrivate) {
    console.log(`${PATH}에 VAPID 키가 이미 있습니다. 덮어쓰지 않았습니다.`);
    console.log("");
    printKeys(existingPublic, existingPrivate);
    return;
  }

  const keys = webpush.generateVAPIDKeys();
  let next = current;
  if (next && !next.endsWith("\n")) next += "\n";
  if (!next.includes("# Web Push")) {
    next += "\n# Web Push (npm run vapid:generate). 프로덕션에도 같은 값을 넣는다.\n";
  }
  next = upsertEnv(next, PUBLIC, keys.publicKey);
  next = upsertEnv(next, PRIVATE, keys.privateKey);
  writeFileSync(PATH, next, { mode: 0o600 });

  console.log(`${PATH}에 키를 썼습니다. git에 올리지 마세요.`);
  console.log("");
  printKeys(keys.publicKey, keys.privateKey);
  console.log("");
  console.log("이 두 값을 Vercel(또는 동급) 환경변수에 그대로 붙이세요.");
}

main();
