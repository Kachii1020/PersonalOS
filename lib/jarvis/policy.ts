import type { ActionPolicy, JarvisActionType } from "./types";

const AUTO_ACTIONS = new Set<JarvisActionType>([
  "CLASSIFY_INTERNAL",
  "SUMMARIZE_INTERNAL",
  "GENERATE_BRIEF",
  "UPDATE_INTERNAL_STATE",
]);

const APPROVAL_ACTIONS = new Set<JarvisActionType>([
  "CREATE_TASK",
  "CREATE_CALENDAR_EVENT",
  "UPDATE_CALENDAR_EVENT",
  "SEND_EMAIL",
  "PUBLISH_GITHUB",
  "REGISTER_EVENT",
  "SUBMIT_APPLICATION",
]);

const DENIED_ACTIONS = new Set<JarvisActionType>([
  "MAKE_PAYMENT",
  "FINANCIAL_TRADE",
  "CHANGE_SECURITY_SETTINGS",
  "DELETE_FILE",
]);

/** Unknown actions fail closed. */
export function policyForAction(actionType: string): ActionPolicy {
  if (AUTO_ACTIONS.has(actionType as JarvisActionType)) return "auto";
  if (APPROVAL_ACTIONS.has(actionType as JarvisActionType)) return "approval";
  if (DENIED_ACTIONS.has(actionType as JarvisActionType)) return "deny";
  return "deny";
}
