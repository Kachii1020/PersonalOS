import "server-only";
import { unstable_cache } from "next/cache";
import { describeDatabase, queryDataSource } from "@/lib/integrations/notion/client";
import { titleOf, labelOf } from "@/lib/integrations/notion/properties";

/**
 * 지원 파이프라인 (Notion 읽기 전용).
 *
 * SPEC.md 3절: Applications DB를 읽기 전용으로 미러.
 * SPEC.md Phase 3 G3 조건 5: "지원 파이프라인이 Notion에서 읽히고 단계별로 그룹핑된다".
 *
 * Wiki와 같은 패턴: 6시간 캐시, Supabase에 복사 안 함.
 */

export type Application = {
  id: string;
  company: string;
  role: string | null;
  stage: string;
  deadline: string | null;
  url: string;
  lastEditedAt: string;
};

const SIX_HOURS = 21_600;

export async function listApplications(): Promise<Application[]> {
  const id = process.env.NOTION_DB_APPLICATIONS?.trim();
  if (!id) return []; // 아직 설정 안 됐으면 빈 배열 (위키와 달리 에러를 던지지 않는다)

  return fetchApplications(id);
}

const fetchApplications = unstable_cache(
  async (id: string): Promise<Application[]> => {
    const info = await describeDatabase(id);
    const { results } = await queryDataSource(info.dataSourceId, { pageSize: 100 });

    return results.map((page) => ({
      id: page.id,
      company: titleOf(page.properties) || "(회사명 없음)",
      role: labelOf(page.properties, ["직무", "role", "position", "직위"]),
      stage: labelOf(page.properties, ["단계", "stage", "status", "상태"]) ?? "미분류",
      deadline: extractDate(page.properties),
      url: page.url,
      lastEditedAt: page.last_edited_time,
    }));
  },
  ["applications"],
  { revalidate: SIX_HOURS, tags: ["applications"] },
);

/** 날짜 속성을 이름에 상관없이 찾는다. */
function extractDate(props: Record<string, unknown>): string | null {
  for (const val of Object.values(props)) {
    if (val && typeof val === "object" && "type" in val) {
      const v = val as { type: string; date?: { start?: string } };
      if (v.type === "date" && v.date?.start) return v.date.start;
    }
  }
  return null;
}

/** 단계별로 그룹핑한다 (G3 조건 5). */
export function groupByStage(apps: Application[]): Map<string, Application[]> {
  const groups = new Map<string, Application[]>();
  for (const app of apps) {
    const list = groups.get(app.stage) ?? [];
    list.push(app);
    groups.set(app.stage, list);
  }
  return groups;
}
