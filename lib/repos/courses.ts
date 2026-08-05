import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 과목 데이터 접근 레이어.
 * ICS 시간표를 과목에 연결하는 데 필요한 만큼만 있다 (SPEC.md 5.1b).
 */

/** 잡 전용: code가 있는 과목의 code → id 맵. 코드는 대문자로 정규화한다. */
export async function courseCodeMapForJob(): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("courses").select("id, code").not("code", "is", null);

  if (error) throw new Error(`과목 코드 조회 실패: ${error.message}`);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.code) map.set(row.code.toUpperCase(), row.id);
  }
  return map;
}
