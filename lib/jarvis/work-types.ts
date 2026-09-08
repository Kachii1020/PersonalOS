import type { DialogueDraft, ChatMessage } from "./dialogue-types";
import type { JsonValue } from "./types";

export type WorkStatus = "active" | "paused" | "completed" | "cancelled";
export type WorkInput = {
  goal: string; progress: string; nextStep: string;
  deadlineAt: string | null; reminderAt: string | null;
  deadlineReminder: boolean; resumeReminder: boolean;
};
export type WorkContext = WorkInput & {
  id: string; ownerId: string; status: WorkStatus; revision: number;
  missingFields: string[]; sourceRefs: JsonValue[];
  lastProgressAt: string; createdAt: string; updatedAt: string;
  expiresAt: string | null; forgottenAt: string | null;
};
export type WorkAction = {
  id: string; contextId: string; draft: DialogueDraft; approvalId: string | null;
  status: string; result: JsonValue | null; error: string | null;
};
export type AttentionKind = "explicit" | "deadline" | "resume";
export type AttentionItem = {
  id: string; contextId: string; kind: AttentionKind; dueAt: string;
  status: string; reason: string; acknowledgedAt: string | null;
  deliveries?: { accepted: number; received: number; opened: number; failed: number; uncertain: number };
};
export type WorkSnapshot = { context: WorkContext; actions: WorkAction[]; attention: AttentionItem[] };
export type WorkChatReply = {
  mode: "answer" | "clarify" | "preview" | "propose";
  message: string; work: WorkSnapshot | null; preview: WorkInput | null;
  proposals: DialogueDraft[]; requestId: string;
};
export type WorkChatInput = { messages: ChatMessage[]; contextId?: string | null; expectedRevision?: number; requestId: string };
