"use server";

import { revalidatePath } from "next/cache";
import { ingestIcs } from "@/lib/integrations/ics/ingest";

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
