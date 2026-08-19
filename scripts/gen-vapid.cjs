/**
 * VAPID 키를 만들고 `.env.local`에 넣는다. Node 내장 crypto만 쓴다
 * (tsx / web-push / npm install 불필요). 값이 있는 키는 덮어쓰지 않는다.
 * 빈 자리표시자(`VAPID_PRIVATE_KEY=`)는 없는 것으로 본다.
 *
 *   npm run vapid:generate
 *   node scripts/gen-vapid.cjs
 */

const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const { createECDH } = require("node:crypto");

const PATH = ".env.local";
const PUBLIC = "NEXT_PUBLIC_VAPID_PUBLIC_KEY";
const PRIVATE = "VAPID_PRIVATE_KEY";

function envValue(text, key) {
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

function upsertEnv(text, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) return text.replace(re, line);
  const prefix = text && !text.endsWith("\n") ? `${text}\n` : text;
  return `${prefix}${line}\n`;
}

/** web-push generateVAPIDKeys()와 같은 패딩·base64url */
function generateVapidKeys() {
  const curve = createECDH("prime256v1");
  curve.generateKeys();
  let publicKey = curve.getPublicKey();
  let privateKey = curve.getPrivateKey();
  if (privateKey.length < 32) {
    privateKey = Buffer.concat([Buffer.alloc(32 - privateKey.length), privateKey]);
  }
  if (publicKey.length < 65) {
    publicKey = Buffer.concat([Buffer.alloc(65 - publicKey.length), publicKey]);
  }
  return {
    publicKey: publicKey.toString("base64url"),
    privateKey: privateKey.toString("base64url"),
  };
}

function printKeys(publicKey, privateKey) {
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
    console.log(`Already have VAPID keys in ${PATH} (not overwritten).`);
    console.log("");
    printKeys(existingPublic, existingPrivate);
    return;
  }

  const keys = generateVapidKeys();
  let next = current;
  if (next && !next.endsWith("\n")) next += "\n";
  if (!next.includes("# Web Push")) {
    next += "\n# Web Push (npm run vapid:generate). Same values go in production.\n";
  }
  next = upsertEnv(next, PUBLIC, keys.publicKey);
  next = upsertEnv(next, PRIVATE, keys.privateKey);
  writeFileSync(PATH, next, { mode: 0o600 });

  console.log(`Wrote keys to ${PATH}. Do not commit this file.`);
  console.log("");
  printKeys(keys.publicKey, keys.privateKey);
  console.log("");
  console.log("Paste both values into Vercel env, then redeploy.");
}

try {
  main();
} catch (err) {
  console.error("vapid:generate failed.");
  console.error(`cwd: ${process.cwd()}`);
  console.error(`node: ${process.version}`);
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
}
