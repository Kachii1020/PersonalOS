"use server";

import { revalidatePath } from "next/cache";
import { processJarvisSteps } from "@/lib/jarvis/orchestrator";
import type { InboxKind } from "@/lib/jarvis/types";
import { createInboxItem } from "@/lib/repos/jarvis-inbox";

const ALLOWED_KINDS = new Set<InboxKind>(["text", "url", "note", "command"]);

/**
 * 폰·Mac 공통 빠른 캡처. DB insert가 성공하면 event trigger가 자동으로
 * system_events를 만든다. UI 응답을 빠르게 하기 위해 같은 요청에서 작은
 * deterministic worker를 한 번 돌리되, 실패해도 저장된 queue는 보존한다.
 */
export async function captureInboxItem(formData: FormData): Promise<void> {
  const rawText = String(formData.get("rawText") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  let normalizedUrl = sourceUrl;
  const requestedKind = String(formData.get("kind") ?? "command") as InboxKind;
  const kind: InboxKind = sourceUrl && !rawText ? "url" : ALLOWED_KINDS.has(requestedKind) ? requestedKind : "command";

  if (!rawText && !sourceUrl) throw new Error("메모나 URL을 입력하세요.");
  if (rawText.length > 5_000) throw new Error("캡처 내용은 5,000자를 넘을 수 없습니다.");

  if (sourceUrl) {
    if (sourceUrl.length > 2_048) throw new Error("URL은 2,048자를 넘을 수 없습니다.");
    let parsed: URL;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      throw new Error("URL 형식이 올바르지 않습니다.");
    }
    if (!new Set(["http:", "https:"]).has(parsed.protocol)) {
      throw new Error("http 또는 https URL만 저장할 수 있습니다.");
    }
    normalizedUrl = parsed.toString();
  }

  await createInboxItem({
    kind,
    rawText: rawText || null,
    sourceUrl: normalizedUrl || null,
  });

  try {
    await processJarvisSteps({ workerId: `capture-${crypto.randomUUID()}`, maxSteps: 6 });
  } catch (error) {
    // 캡처 자체는 이미 저장됐다. queue가 다음 수동/예약 job에서 재시도한다.
    console.error("[jarvis] 즉시 인박스 처리 실패:", error);
  }

  revalidatePath("/inbox");
  revalidatePath("/approvals");
  revalidatePath("/today");
}
