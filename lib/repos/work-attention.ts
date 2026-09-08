import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkOwner, WorkRequestError } from "./work-contexts";
import type { AttentionItem } from "@/lib/jarvis/work-types";

type AttentionRpc = "list_work_attention" | "mutate_work_attention" | "ack_work_delivery" | "claim_work_attention" | "begin_work_delivery" | "finish_work_delivery" | "finish_work_attention" | "prune_work_contexts" | "get_claimed_work_subscriptions";
async function rpc<N extends AttentionRpc>(client: SupabaseClient<Database>, name: N, args?: Database["public"]["Functions"][N]["Args"]): Promise<unknown> {
  const result = await client.rpc(name, args);
  if (result.error) throw new WorkRequestError(`업무 알림을 처리하지 못했습니다: ${result.error.message}`,
    result.error.code === "42501" ? 403 : result.error.code === "40001" || /lease|changed/i.test(result.error.message) ? 409 : 400);
  return result.data;
}
export async function listWorkAttention(): Promise<AttentionItem[]> {
  const { client } = await requireWorkOwner();
  const rows = await rpc(client, "list_work_attention") as { id: string; context_id: string; kind: AttentionItem["kind"]; due_at: string; status: string; reason: string; acknowledged_at: string | null; deliveries?: { accepted: number; received: number; opened: number; failed: number; uncertain: number } }[];
  return rows.map((row) => ({ id: row.id, contextId: row.context_id, kind: row.kind, dueAt: row.due_at, status: row.status, reason: row.reason, acknowledgedAt: row.acknowledged_at, deliveries: row.deliveries }));
}
export async function mutateWorkAttention(id: string, operation: "hour" | "tomorrow" | "disable" | "ack"): Promise<void> {
  const { client } = await requireWorkOwner(); await rpc(client, "mutate_work_attention", { p_attention_id: id, p_operation: operation });
}
export async function acknowledgeWorkDelivery(id: string, event: "received" | "opened"): Promise<void> {
  const { client } = await requireWorkOwner(); await rpc(client, "ack_work_delivery", { p_delivery_id: id, p_event: event });
}
export type ClaimedWorkAttention = AttentionItem & { ownerId: string; lockedUntil: string };
export type WorkDeliveryAttempt = { deliveryId: string; attemptToken: string; attempt: number; subscriptionId: string };
export async function claimWorkAttention(workerId: string, allowAutomatic = false): Promise<ClaimedWorkAttention | null> {
  return await rpc(createAdminClient(), "claim_work_attention", { p_worker_id: workerId, p_allow_automatic: allowAutomatic }) as ClaimedWorkAttention | null;
}
export async function beginWorkDelivery(attentionId: string, workerId: string, subscriptionId: string): Promise<WorkDeliveryAttempt | null> {
  return await rpc(createAdminClient(), "begin_work_delivery", { p_attention_id: attentionId, p_worker_id: workerId, p_subscription_id: subscriptionId }) as WorkDeliveryAttempt | null;
}
export async function finishWorkDelivery(input: { deliveryId: string; workerId: string; attemptToken: string; status: "accepted" | "failed" | "gone" | "uncertain"; error?: string }): Promise<void> {
  await rpc(createAdminClient(), "finish_work_delivery", { p_delivery_id: input.deliveryId, p_worker_id: input.workerId, p_attempt_token: input.attemptToken, p_status: input.status, p_error: input.error });
}
export async function finishWorkAttention(attentionId: string, workerId: string, status: "ready" | "failed", error?: string): Promise<void> {
  await rpc(createAdminClient(), "finish_work_attention", { p_attention_id: attentionId, p_worker_id: workerId, p_status: status, p_error: error });
}
export async function pruneWorkContextsForJob(): Promise<number> {
  return await rpc(createAdminClient(), "prune_work_contexts") as number;
}

/** Existing push subscriptions belong to the single configured allowed owner.
 * Resolve their keys only after an owned, live attention claim is established.
 * begin_work_delivery rechecks ownership/consent immediately before each send. */
export async function getClaimedWorkSubscriptions(attentionId: string): Promise<{ id: string; endpoint: string; p256dh: string; auth: string }[]> {
  // The service RPC keeps claim/owner checks at the same DB
  // boundary as the secret subscription projection; no client gets these keys.
  const result = await rpc(createAdminClient(), "get_claimed_work_subscriptions", { p_attention_id: attentionId });
  return (result ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[];
}
