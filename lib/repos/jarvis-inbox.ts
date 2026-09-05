import "server-only";
import { createAdminClient as createJarvisAdminClient } from "@/lib/supabase/admin";
import { createClient as createJarvisUserClient } from "@/lib/supabase/server";
import type { InboxItem } from "@/lib/jarvis/db-types";
import type { CaptureClassification, InboxKind } from "@/lib/jarvis/types";

type InboxRow = {
  id: string;
  kind: InboxKind;
  raw_text: string | null;
  source_url: string | null;
  attachment_path: string | null;
  status: InboxItem["status"];
  summary: string | null;
  classification_reason: string | null;
  created_at: string;
  processed_at: string | null;
};

const COLUMNS =
  "id, kind, raw_text, source_url, attachment_path, status, summary, classification_reason, created_at, processed_at";

function mapInbox(row: InboxRow): InboxItem {
  return {
    id: row.id,
    kind: row.kind,
    rawText: row.raw_text,
    sourceUrl: row.source_url,
    attachmentPath: row.attachment_path,
    status: row.status,
    summary: row.summary,
    classificationReason: row.classification_reason,
    createdAt: row.created_at,
    processedAt: row.processed_at,
  };
}

export async function createInboxItem(input: {
  kind: InboxKind;
  rawText: string | null;
  sourceUrl: string | null;
}): Promise<InboxItem> {
  const supabase = await createJarvisUserClient();
  const { data, error } = await supabase
    .from("inbox_items")
    .insert({ kind: input.kind, raw_text: input.rawText, source_url: input.sourceUrl })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`인박스 저장 실패: ${error.message}`);
  return mapInbox(data as InboxRow);
}

export async function listInboxItems(limit = 50): Promise<InboxItem[]> {
  const supabase = await createJarvisUserClient();
  const { data, error } = await supabase
    .from("inbox_items")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`인박스 조회 실패: ${error.message}`);
  return ((data ?? []) as InboxRow[]).map(mapInbox);
}

export async function getInboxItemForJob(id: string): Promise<InboxItem | null> {
  const supabase = createJarvisAdminClient();
  const { data, error } = await supabase.from("inbox_items").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`인박스 잡 조회 실패: ${error.message}`);
  return data ? mapInbox(data as InboxRow) : null;
}

export async function saveInboxClassificationForJob(
  id: string,
  classification: CaptureClassification,
): Promise<void> {
  const supabase = createJarvisAdminClient();
  const { error } = await supabase
    .from("inbox_items")
    .update({
      status: classification.status,
      summary: classification.summary,
      classification_reason: classification.reason,
      processed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`인박스 분류 저장 실패: ${error.message}`);
}
