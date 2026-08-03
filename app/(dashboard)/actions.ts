"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setSidebarOrder } from "@/lib/repos/user-prefs";
import { NAV_ITEMS } from "@/components/shell/nav-items";

/** 사이드바 순서 저장. 알 수 없는 경로가 섞여 오면 저장하지 않는다. */
export async function saveSidebarOrder(order: string[]) {
  const known = new Set(NAV_ITEMS.map((i) => i.href));
  const valid = order.length === known.size && order.every((href) => known.has(href));
  if (!valid) {
    return { ok: false, error: "알 수 없는 경로가 포함되어 저장하지 않았습니다." };
  }
  return setSidebarOrder(order);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
