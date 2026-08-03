"use server";

import { revalidatePath } from "next/cache";
import { createAppEvent } from "@/lib/integrations/caldav/sync";

export type EventFormState = { ok: boolean; message: string } | null;

/** JST 고정 오프셋. 이 앱의 기준 시간대는 Asia/Tokyo이고 서머타임이 없다. */
const JST = "+09:00";

/**
 * 앱에서 만든 이벤트를 iCloud에 PUT하고 미러에도 반영한다 (SPEC.md 5.1 절대 규칙 3).
 * 쓰기 대상이 앱 전용 캘린더인지는 lib/repos/events.ts의 assertWritable이 확인한다.
 */
export async function addEvent(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const summary = String(formData.get("summary") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const location = String(formData.get("location") ?? "").trim();

  if (!summary) return { ok: false, message: "제목을 입력하세요." };
  if (!date || !startTime || !endTime) return { ok: false, message: "날짜와 시작·종료 시각을 모두 입력하세요." };

  const startsAt = new Date(`${date}T${startTime}:00${JST}`);
  const endsAt = new Date(`${date}T${endTime}:00${JST}`);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { ok: false, message: "날짜 또는 시각 형식이 올바르지 않습니다." };
  }
  if (endsAt <= startsAt) {
    return { ok: false, message: "종료 시각이 시작 시각보다 빠릅니다." };
  }

  try {
    await createAppEvent({
      summary,
      startsAt,
      endsAt,
      ...(location ? { location } : {}),
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  return { ok: true, message: `'${summary}'를 iCloud에 추가했습니다.` };
}
