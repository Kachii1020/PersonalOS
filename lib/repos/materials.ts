import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * 강의자료 데이터 접근 레이어.
 * 파일은 Supabase Storage의 'materials' 버킷, 메타·추출 텍스트는 course_materials 행에 산다.
 */

export type MaterialRow = {
  id: string;
  filename: string;
  mimeType: string;
  textLength: number;
  summary: string | null;
  keywords: string[] | null;
  uploadedAt: string;
};

const BUCKET = "materials";

export async function listMaterials(courseId: string): Promise<MaterialRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_materials")
    // extracted_text를 통째로 가져와 길이만 쓴다. 단일 사용자 규모라 별도 뷰를 만들 이유가 없다.
    .select("id, filename, mime_type, summary, keywords, uploaded_at, extracted_text")
    .eq("course_id", courseId)
    .order("uploaded_at", { ascending: false });

  if (error) throw new Error(`강의자료 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    filename: r.filename,
    mimeType: r.mime_type,
    textLength: r.extracted_text?.length ?? 0,
    summary: r.summary,
    keywords: r.keywords,
    uploadedAt: r.uploaded_at,
  }));
}

/** 요약 프롬프트에 넣을 원문. 요약 버튼을 눌렀을 때만 읽는다. */
export async function getExtractedText(id: string): Promise<{ filename: string; text: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_materials")
    .select("filename, extracted_text")
    .eq("id", id)
    .single();

  if (error) throw new Error(`강의자료 조회 실패: ${error.message}`);
  if (!data.extracted_text) throw new Error("추출된 텍스트가 없습니다. 이미지로만 된 자료는 요약할 수 없습니다.");
  return { filename: data.filename, text: data.extracted_text };
}

/**
 * 파일을 올리고 메타 행을 만든다.
 * 스토리지에 올린 뒤 행 삽입이 실패하면 올린 파일을 지운다 — 참조 없는 파일이 남으면 아무도 못 지운다.
 */
export async function createMaterial(input: {
  courseId: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  extractedText: string;
}): Promise<void> {
  const supabase = await createClient();
  const ext = input.filename.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `${input.courseId}/${crypto.randomUUID()}.${ext}`;

  const upload = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.bytes, { contentType: input.mimeType, upsert: false });
  if (upload.error) throw new Error(`파일 업로드 실패: ${upload.error.message}`);

  const { error } = await supabase.from("course_materials").insert({
    course_id: input.courseId,
    filename: input.filename,
    storage_path: storagePath,
    mime_type: input.mimeType,
    extracted_text: input.extractedText,
  });

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(`강의자료 저장 실패: ${error.message}`);
  }
}

export async function saveSummary(id: string, summary: string, keywords: string[]): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("course_materials").update({ summary, keywords }).eq("id", id);
  if (error) throw new Error(`요약 저장 실패: ${error.message}`);
}
