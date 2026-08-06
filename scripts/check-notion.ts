import { config } from "dotenv";
config({ path: [".env.development.local", ".env.local"] });

import { describeDatabase, queryDataSource, NotionError } from "@/lib/integrations/notion/client";

/**
 * Notion 설정 진단 (docs/NOTION-SETUP.md).
 * DB 5개에 각각 붙어보고 몇 건이 보이는지 찍는다. 실패는 원인을 짚어준다.
 */

/**
 * Phase 2에 필요한 건 위키뿐이다 (SPEC.md 6.2: /wiki는 Phase 2, /invest·/apply는 Phase 3).
 * 나머지는 비어 있어도 실패로 세지 않는다 — 안 쓸 DB를 지금 만들게 할 이유가 없다.
 */
const DBS = [
  ["NOTION_DB_WIKI", "위키", "required"],
  ["NOTION_DB_COURSE_NOTES", "과목 노트", "optional"],
  ["NOTION_DB_RESEARCH", "리서치 노트", "optional"],
  ["NOTION_DB_ALGO", "알고리즘 패턴", "optional"],
  ["NOTION_DB_APPLICATIONS", "지원 파이프라인", "optional"],
] as const;

async function main(): Promise<void> {
  if (!process.env.NOTION_TOKEN?.trim()) {
    console.error("NOTION_TOKEN이 .env.local에 없습니다. docs/NOTION-SETUP.md의 1번을 보세요.");
    process.exit(1);
  }

  let failed = 0;

  for (const [envName, label, need] of DBS) {
    const id = process.env[envName]?.trim();
    if (!id) {
      if (need === "optional") {
        console.log(`· ${label} — 아직 없음 (Phase 3에서 필요합니다. 지금은 넘어가도 됩니다)`);
        continue;
      }
      console.log(`✖ ${label} (${envName}) — 값이 비어 있습니다`);
      failed++;
      continue;
    }

    try {
      const info = await describeDatabase(id);
      const { results, hasMore } = await queryDataSource(info.dataSourceId, { pageSize: 5 });
      const count = hasMore ? `${results.length}건 이상` : `${results.length}건`;
      const multi = info.dataSourceCount > 1 ? ` ⚠ data source ${info.dataSourceCount}개 중 첫 번째 사용` : "";
      console.log(`✔ ${label} — '${info.title}' ${count}${multi}`);
    } catch (e) {
      const message = e instanceof NotionError ? `${e.status} ${e.message}` : e instanceof Error ? e.message : String(e);
      console.log(`✖ ${label} (${envName}) — ${message}`);
      failed++;
    }
  }

  console.log(
    failed === 0
      ? "\n연결됐습니다. 이제 /wiki를 만들 수 있습니다."
      : `\n${failed}개 실패. 위 메시지를 보고 고치세요. 자세한 절차는 docs/NOTION-SETUP.md`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

void main();
