import type { InboxKind, InboxStatus, JsonValue, RiskLevel } from "./types";

export type InboxItem = {
  id: string;
  kind: InboxKind;
  rawText: string | null;
  sourceUrl: string | null;
  attachmentPath: string | null;
  status: InboxStatus;
  summary: string | null;
  classificationReason: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type SystemEvent = {
  id: string;
  eventType: string;
  sourceType: string;
  sourceId: string | null;
  payload: JsonValue;
  dedupeKey: string;
  status: "pending" | "processing" | "processed" | "failed";
  attempts: number;
  lockedBy: string | null;
  lockedUntil: string | null;
  error: string | null;
};

export type AgentRun = {
  id: string;
  runType: string;
  triggerEventId: string;
  status:
    | "queued"
    | "collecting"
    | "verifying"
    | "planning"
    | "waiting_approval"
    | "executing"
    | "completed"
    | "failed";
  currentStep: string;
  state: JsonValue;
  output: JsonValue | null;
  attempts: number;
  lockedBy: string | null;
  error: string | null;
};

export type ApprovalRequest = {
  id: string;
  agentRunId: string | null;
  actionType: string;
  title: string;
  explanation: string;
  payload: JsonValue;
  riskLevel: RiskLevel;
  status: "pending" | "approved" | "rejected" | "expired" | "executing" | "executed" | "failed";
  idempotencyKey: string;
  requestedAt: string;
  expiresAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  executedAt: string | null;
  result: JsonValue | null;
  error: string | null;
};
