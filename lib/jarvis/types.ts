export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type InboxKind = "text" | "url" | "note" | "file" | "image" | "command";
export type InboxStatus = "unprocessed" | "act_now" | "learn" | "monitor" | "archive" | "failed";

export type JarvisActionType =
  | "CLASSIFY_INTERNAL"
  | "SUMMARIZE_INTERNAL"
  | "GENERATE_BRIEF"
  | "UPDATE_INTERNAL_STATE"
  | "CREATE_TASK"
  | "CREATE_CALENDAR_EVENT"
  | "UPDATE_CALENDAR_EVENT"
  | "SEND_EMAIL"
  | "PUBLISH_GITHUB"
  | "REGISTER_EVENT"
  | "SUBMIT_APPLICATION"
  | "MAKE_PAYMENT"
  | "FINANCIAL_TRADE"
  | "CHANGE_SECURITY_SETTINGS"
  | "DELETE_FILE";

export type ActionPolicy = "auto" | "approval" | "deny";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ProposedAction = {
  type: JarvisActionType;
  title: string;
  explanation: string;
  payload: JsonValue;
  riskLevel: RiskLevel;
  idempotencyKey: string;
};

export type CaptureInput = {
  id: string;
  kind: InboxKind;
  rawText: string | null;
  sourceUrl: string | null;
};

export type CaptureClassification = {
  status: InboxStatus;
  summary: string;
  reason: string;
  proposedAction: ProposedAction | null;
};

export type CreateTaskPayload = {
  title: string;
  notes: string | null;
  dueAt: string | null;
  category: string | null;
  priority: number | null;
  estimatedMinutes: number | null;
};

export type BriefTask = {
  id: string;
  title: string;
  dueAt: string | null;
  deferUntil: string | null;
  priority: number | null;
  estimatedMinutes: number | null;
  category: string | null;
};

export type BriefApproval = {
  id: string;
  title: string;
  actionType: string;
  requestedAt: string;
};

export type CommandBriefAction = {
  taskId: string;
  title: string;
  score: number;
  reason: string;
  dueAt: string | null;
  estimatedMinutes: number | null;
};

export type CommandBrief = {
  date: string;
  headline: string;
  topActions: CommandBriefAction[];
  preparedItems: { approvalId: string; title: string; actionType: string }[];
  postponedItems: { taskId: string; title: string; until: string }[];
  warnings: string[];
  sourceSnapshot: {
    openTaskCount: number;
    pendingApprovalCount: number;
    generatedAt: string;
  };
};
