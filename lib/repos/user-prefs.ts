import { createClient } from "@/lib/supabase/server";

const SIDEBAR_ORDER_KEY = "sidebar_order";

/**
 * 사이드바 순서. 저장된 값이 없거나 읽기에 실패하면 null을 돌려주고
 * 호출부가 기본 순서를 쓴다 — 설정 하나 때문에 셸이 안 뜨면 안 된다.
 */
export async function getSidebarOrder(): Promise<string[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_prefs")
    .select("value")
    .eq("key", SIDEBAR_ORDER_KEY)
    .maybeSingle();

  if (error) {
    console.error("[user-prefs] 사이드바 순서 읽기 실패:", error.message);
    return null;
  }
  if (!data) return null;

  const value = data.value;
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    console.error("[user-prefs] sidebar_order 형식이 문자열 배열이 아님:", value);
    return null;
  }
  return value;
}

export async function setSidebarOrder(order: string[]): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_prefs")
    .upsert({ key: SIDEBAR_ORDER_KEY, value: order, updated_at: new Date().toISOString() });

  if (error) {
    console.error("[user-prefs] 사이드바 순서 저장 실패:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
