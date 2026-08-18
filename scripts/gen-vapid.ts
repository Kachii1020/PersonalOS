/**
 * VAPID 키를 만들고 `.env.local`에 붙인다. 이미 있으면 덮어쓰지 않는다.
 *
 *   npm run vapid:generate
 *
 * 같은 두 값을 프로덕션(Vercel 등) 환경변수에도 넣는다. 리포에 커밋하지 않는다.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import webpush from "web-push";

const PATH = ".env.local";

function main() {
  const current = existsSync(PATH) ? readFileSync(PATH, "utf8") : "";
  if (/^VAPID_PRIVATE_KEY=/m.test(current) && /^NEXT_PUBLIC_VAPID_PUBLIC_KEY=/m.test(current)) {
    console.log(`${PATH}에 VAPID 키가 이미 있습니다. 덮어쓰지 않았습니다.`);
    return;
  }

  const keys = webpush.generateVAPIDKeys();
  const block = [
    "",
    "# Web Push (npm run vapid:generate). 프로덕션에도 같은 값을 넣는다.",
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`,
    `VAPID_PRIVATE_KEY=${keys.privateKey}`,
    "",
  ].join("\n");

  const prefix = current && !current.endsWith("\n") ? `${current}\n` : current;
  writeFileSync(PATH, prefix + block, { mode: 0o600 });

  console.log(`${PATH}에 키를 썼습니다. git에 올리지 마세요.`);
  console.log("");
  console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=");
  console.log(keys.publicKey);
  console.log("VAPID_PRIVATE_KEY=");
  console.log(keys.privateKey);
  console.log("");
  console.log("이 두 값을 Vercel(또는 동급) 환경변수에 그대로 붙이세요.");
}

main();
