"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setSidebarOrder } from "@/lib/repos/user-prefs";
import { createTask } from "@/lib/repos/tasks";
import { createAppEvent } from "@/lib/integrations/caldav/sync";
import { globalSearch, type SearchResult } from "@/lib/repos/search";
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

const JST = "+09:00";

export type QuickState = { ok: boolean; message: string };

/** 퀵 캡처 (1-B): 제목만으로 할 일. 날짜는 선택 — 있으면 23:59 마감. */
export async function quickAddTask(input: { title: string; dueDate?: string }): Promise<QuickState> {
  const title = input.title.trim();
  if (!title) return { ok: false, message: "할 일 제목을 입력하세요." };

  let dueAt: string | null = null;
  if (input.dueDate) {
    const parsed = new Date(`${input.dueDate}T23:59:00${JST}`);
    if (Number.isNaN(parsed.getTime())) return { ok: false, message: "마감 날짜 형식이 올바르지 않습니다." };
    dueAt = parsed.toISOString();
  }

  try {
    await createTask({ title, dueAt, category: null, notes: null });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/tasks");
  revalidatePath("/");
  return { ok: true, message: `'${title}'를 추가했습니다.` };
}

/** 퀵 캡처 (1-B): 제목 + 날짜 + 시작 시각. 종료는 1시간 뒤. iCloud PUT까지 간다. */
export async function quickAddEvent(input: {
  summary: string;
  date: string;
  startTime: string;
}): Promise<QuickState> {
  const summary = input.summary.trim();
  if (!summary) return { ok: false, message: "일정 제목을 입력하세요." };
  if (!input.date || !input.startTime) return { ok: false, message: "날짜와 시작 시각을 입력하세요." };

  const startsAt = new Date(`${input.date}T${input.startTime}:00${JST}`);
  if (Number.isNaN(startsAt.getTime())) return { ok: false, message: "날짜 또는 시각 형식이 올바르지 않습니다." };
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

  try {
    await createAppEvent({ summary, startsAt, endsAt });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  return { ok: true, message: `'${summary}'를 iCloud에 추가했습니다 (1시간).` };
}

/** 커맨드 팔레트 검색 (1-C). 클라이언트에서 debounce 후 호출한다. */
export async function searchEverything(query: string): Promise<SearchResult[]> {
  return globalSearch(query);
}
