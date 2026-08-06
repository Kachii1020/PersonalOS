"use server";

import { revalidatePath } from "next/cache";
import { createCourse, createSemester, setGrade } from "@/lib/repos/courses";
import { createMaterial, getExtractedText, saveSummary } from "@/lib/repos/materials";
import { extractText, isSupported, PDF_MIME, PPTX_MIME } from "@/lib/integrations/materials/extract";
import { callStructured, AiParseError, AiRefusalError } from "@/lib/ai/client";
import { BudgetExceededError } from "@/lib/ai/budget";
import {
  MATERIAL_SCHEMA,
  MATERIAL_SYSTEM,
  buildMaterialPrompt,
  type MaterialSummaryPayload,
} from "@/lib/ai/prompts/material";

export type FormState = { ok: boolean; message: string } | null;

export async function addCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const semesterId = String(formData.get("semesterId") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const credits = Number(formData.get("credits"));

  if (!name) return { ok: false, message: "과목명을 입력하세요." };
  if (!semesterId) return { ok: false, message: "학기를 선택하세요. 학기가 없으면 먼저 추가해야 합니다." };
  if (!Number.isFinite(credits) || credits < 0) return { ok: false, message: "학점은 0 이상의 숫자여야 합니다." };

  try {
    await createCourse({ semesterId, name, code: code || null, credits });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/courses");
  return { ok: true, message: `'${name}'을 추가했습니다.` };
}

export async function addSemester(_prev: FormState, formData: FormData): Promise<FormState> {
  const label = String(formData.get("label") ?? "").trim();
  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "");
  const isCurrent = formData.get("isCurrent") === "on";

  if (!label) return { ok: false, message: "학기 이름을 입력하세요. 예: 2026 Autumn" };
  if (!startsOn || !endsOn) return { ok: false, message: "시작일과 종료일을 모두 입력하세요." };
  if (endsOn < startsOn) return { ok: false, message: "종료일이 시작일보다 빠릅니다." };

  try {
    await createSemester({ label, startsOn, endsOn, isCurrent });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/courses");
  return { ok: true, message: `'${label}' 학기를 추가했습니다.` };
}

export async function updateGrade(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const grade = String(formData.get("grade") ?? "");
  if (!id) return;

  await setGrade(id, grade || null);
  revalidatePath("/courses");
  revalidatePath(`/courses/${id}`);
}

/**
 * 업로드는 텍스트 추출까지만 한다 (SPEC.md 3절).
 * 여기서 요약까지 하면 파일을 올리는 것만으로 AI 비용이 나간다.
 */
export async function uploadMaterial(_prev: FormState, formData: FormData): Promise<FormState> {
  const courseId = String(formData.get("courseId") ?? "");
  const file = formData.get("file");

  if (!courseId) return { ok: false, message: "과목을 찾을 수 없습니다." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "파일을 선택하세요." };

  const mimeType = file.type || guessMime(file.name);
  if (!isSupported(mimeType)) {
    return { ok: false, message: `'${file.name}'은 읽을 수 없는 형식입니다. PDF나 PPTX를 올리세요.` };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let text: string;
  try {
    text = await extractText(bytes, mimeType);
  } catch (e) {
    return { ok: false, message: `텍스트 추출 실패: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (text.length === 0) {
    return {
      ok: false,
      message: `'${file.name}'에서 글자를 하나도 찾지 못했습니다. 스캔 이미지로만 된 자료는 요약할 수 없습니다.`,
    };
  }

  try {
    await createMaterial({ courseId, filename: file.name, mimeType, bytes, extractedText: text });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath(`/courses/${courseId}`);
  return { ok: true, message: `'${file.name}' 업로드 완료 — ${text.length.toLocaleString()}자를 추출했습니다.` };
}

/** 요약은 여기서만 AI를 부른다 (SPEC.md 5.5: 수동 트리거). */
export async function summarizeMaterial(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  if (!id) return { ok: false, message: "자료를 찾을 수 없습니다." };

  try {
    const { filename, text } = await getExtractedText(id);
    const { data } = await callStructured<MaterialSummaryPayload>({
      purpose: "material_summary",
      system: MATERIAL_SYSTEM,
      userMessage: buildMaterialPrompt(filename, text),
      schema: MATERIAL_SCHEMA,
      maxTokens: 2000,
    });

    await saveSummary(id, data.summary, data.keywords);
  } catch (e) {
    if (e instanceof BudgetExceededError) {
      return { ok: false, message: `${e.message} 다음 달 1일에 초기화됩니다.` };
    }
    if (e instanceof AiRefusalError) return { ok: false, message: "모델이 이 자료의 요약을 거부했습니다." };
    if (e instanceof AiParseError) return { ok: false, message: "요약 형식을 읽지 못했습니다. 다시 시도하세요." };
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath(`/courses/${courseId}`);
  return { ok: true, message: "요약했습니다." };
}

/** 브라우저가 확장자만 보내고 MIME을 비워두는 경우가 있다. */
function guessMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return PDF_MIME;
  if (ext === "pptx") return PPTX_MIME;
  return "";
}
