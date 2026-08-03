/**
 * .env.local의 ALLOWED_EMAIL로 supabase/seed.sql을 만든다.
 *
 * 허용 이메일을 마이그레이션에 하드코딩하지 않기 위한 것이다.
 * seed.sql은 .gitignore에 있고, `npm run db:reset`이 이 스크립트를 먼저 돌린다.
 */

import { writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });

const email = process.env.ALLOWED_EMAIL;
if (!email) throw new Error("환경변수 ALLOWED_EMAIL 없음 — .env.local을 확인할 것");

writeFileSync(
  "supabase/seed.sql",
  `-- 생성 파일. 직접 고치지 말 것. \`npm run db:reset\`이 scripts/gen-seed.ts로 다시 만든다.
insert into app_config (key, value) values ('allowed_email', ${literal(email)})
on conflict (key) do update set value = excluded.value;
`,
);

console.log(`supabase/seed.sql 생성 — allowed_email = ${email}`);

function literal(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
