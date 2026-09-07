import type { JsonValue } from "./types";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type DialogueKind = "read_tasks" | "read_calendar" | "read_career" | "create_task" | "create_calendar" | "update_calendar" | "clarify";
export type InputQuote = { messageIndex: number; text: string };
export type DialogueIntent = {
  kind: DialogueKind;
  sourceId: string | null;
  title: InputQuote | null;
  date: InputQuote | null;
  time: InputQuote | null;
  duration: InputQuote | null;
};
export type DialogueGrounding = {
  kind: DialogueKind;
  message: string;
  needsClarification: boolean;
  title: string | null;
  sourceId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  queryDate: string | null;
  evidence: InputQuote[];
};
export type DialogueFact = { id: string; title: string; detail: string; href: string; observedAt: string };
export type DialogueDraft = {
  id: string; type: "CREATE_TASK" | "CREATE_CALENDAR_EVENT" | "UPDATE_CALENDAR_EVENT";
  title: string; explanation: string; payload: JsonValue; expiresAt: string;
  canRequestApproval: boolean;
};
export type ChatReply = {
  mode: "answer" | "clarify" | "propose";
  message: string; facts: DialogueFact[]; draft: DialogueDraft | null;
  observedAt: string; warnings: string[];
};
