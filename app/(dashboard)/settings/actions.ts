"use server";

import { revalidatePath } from "next/cache";
import { ingestIcs } from "@/lib/integrations/ics/ingest";
import {
  deletePushSubscriptionByEndpoint,
  getPushPrefs,
  updatePushPrefs,
  upsertPushSubscription,
  DEFAULT_PUSH_PREFS,
  type PushPrefs,
} from "@/lib/repos/push";
import { sendPush } from "@/lib/integrations/push/send";

export type IcsFormState = { ok: boolean; message: string } | null;

/** MyWaseda가 파일 다운로드만 줄 때의 경로 (SPEC.md 5.1b). 크론과 같은 ingestIcs를 지난다. */
const UPLOAD_SOURCE = "upload://mywaseda-timetable";

export async function uploadIcs(_prev: IcsFormState, formData: FormData): Promise<IcsFormState> {
  const file = formData.get("ics");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: ".ics 파일을 선택하세요." };

  const content = await file.text();
  if (!content.includes("BEGIN:VCALENDAR")) {
    return { ok: false, message: `'${file.name}'은 ICS 파일이 아닙니다. MyWaseda에서 받은 .ics를 올리세요.` };
  }

  let result: Awaited<ReturnType<typeof ingestIcs>>;
  try {
    result = await ingestIcs(content, { sourceUrl: UPLOAD_SOURCE, displayName: "MyWaseda 시간표" });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/");

  if (result.skipped) return { ok: true, message: "이미 반영된 파일과 내용이 같아 그대로 두었습니다." };
  return {
    ok: true,
    message:
      `수업 ${result.events}건을 반영했습니다. 과목 연결 ${result.matched}건` +
      (result.unmatched > 0 ? ` · 코드 없음 ${result.unmatched}건` : "") +
      (result.unparsed > 0 ? ` · 읽지 못함 ${result.unparsed}건` : ""),
  };
}

export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    await upsertPushSubscription(input);
    revalidatePath("/settings");
    return { ok: true, message: "구독을 저장했습니다." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function deletePushSubscription(endpoint: string): Promise<{ ok: boolean; message: string }> {
  try {
    await deletePushSubscriptionByEndpoint(endpoint);
    revalidatePath("/settings");
    return { ok: true, message: "구독을 삭제했습니다." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** 이 기기의 알림 카테고리 설정 (2-C). 구독이 아직 없으면 기본값을 준다. */
export async function loadPushPrefs(endpoint: string): Promise<PushPrefs> {
  if (!endpoint) return DEFAULT_PUSH_PREFS;
  try {
    return await getPushPrefs(endpoint);
  } catch {
    return DEFAULT_PUSH_PREFS;
  }
}

export async function savePushPrefs(
  endpoint: string,
  prefs: PushPrefs,
): Promise<{ ok: boolean; message: string }> {
  if (!endpoint) return { ok: false, message: "구독을 먼저 만드세요." };
  try {
    await updatePushPrefs(endpoint, prefs);
    return { ok: true, message: "알림 설정을 저장했습니다." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendTestPush(): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await sendPush({
      title: "테스트 알림",
      body: "Personal OS 푸시가 이 기기에 도달했습니다.",
      url: "/settings",
    });
    if (result.skipped) return { ok: false, message: "VAPID 키가 없거나 저장된 구독이 없습니다." };
    if (result.sent === 0) return { ok: false, message: `발송된 알림이 없습니다. 만료 ${result.gone} · 실패 ${result.failed}` };
    return { ok: true, message: `알림 ${result.sent}건을 보냈습니다.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
