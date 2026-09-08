import "server-only";
import webpush from "web-push";
import { claimWorkAttention, beginWorkDelivery, finishWorkDelivery, finishWorkAttention, getClaimedWorkSubscriptions, pruneWorkContextsForJob } from "./work-attention";
import { createAdminClient } from "@/lib/supabase/admin";

type PushTarget = { endpoint: string; p256dh: string; auth: string };
type Sender = (target: PushTarget, payload: { title: string; body: string; url: string; deliveryId: string; attentionId: string }) => Promise<number>;
export async function acknowledgeWorkTick(slot: string, finished: boolean) {
  const result = await createAdminClient().rpc("ack_work_tick", { p_slot: slot, p_finished: finished });
  if (result.error) throw new Error(`Worker acknowledgment failed: ${result.error.message}`);
}
const defaultSender: Sender = async (target, payload) => {
  webpush.setVapidDetails(`mailto:${process.env.ALLOWED_EMAIL ?? "personal-os@localhost"}`, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const response = await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, JSON.stringify(payload), { timeout: 5000, TTL: 3600 });
  return response.statusCode;
};
/** One attention per request; durable attempts are reserved immediately before send. */
export async function processWorkAttention(workerId: string, sender?: Sender) {
  const pruned = await pruneWorkContextsForJob();
  const chatPrune = await createAdminClient().rpc("prune_work_chat");
  if (chatPrune.error) throw new Error("만료된 업무 응답 정리에 실패했습니다.");
  if (process.env.JARVIS_ATTENTION_ENABLED !== "true") return { kind: "disabled", pruned };
  let allowAutomatic = false;
  if (process.env.JARVIS_AUTOMATIC_ATTENTION_ENABLED === "true") {
    const health = await createAdminClient().rpc("work_scheduler_health");
    if (health.error) throw new Error("정시성 측정을 확인하지 못했습니다. 자동 조건 알림은 보류합니다.");
    const value = health.data as { automaticPromotionReady?: boolean };
    allowAutomatic = value.automaticPromotionReady === true;
  }
  const attention = await claimWorkAttention(workerId, allowAutomatic);
  if (!attention) return { kind: "idle", pruned };
  let accepted = 0, failed = 0, uncertain = 0;
  try {
    const targets = await getClaimedWorkSubscriptions(attention.id);
    const configured = !!sender || !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
    if (configured) for (const target of targets) {
      const attempt = await beginWorkDelivery(attention.id, workerId, target.id);
      if (!attempt) continue;
      let status: "accepted" | "failed" | "gone" | "uncertain" = "uncertain"; let error: string | undefined;
      try {
        const code = await (sender ?? defaultSender)(target, { title: "JARVIS 업무 알림", body: "이어갈 업무가 있습니다. 앱에서 확인해 주세요.",
          url: `/jarvis?work=${attention.contextId}`, deliveryId: attempt.deliveryId, attentionId: attention.id });
        status = code === 404 || code === 410 ? "gone" : code >= 200 && code < 300 ? "accepted" : "failed";
        if (status !== "accepted") error = `Push HTTP ${code}`;
      } catch (e) {
        const code = e && typeof e === "object" && "statusCode" in e && typeof e.statusCode === "number" ? e.statusCode : null;
        status = code === 404 || code === 410 ? "gone" : code !== null ? "failed" : "uncertain";
        error = code !== null ? `Push HTTP ${code}` : "Provider response unknown; not automatically resent";
      }
      await finishWorkDelivery({ deliveryId: attempt.deliveryId, workerId, attemptToken: attempt.attemptToken, status, error });
      if (status === "accepted") accepted++; else if (status === "uncertain") uncertain++; else failed++;
      if (status === "gone") {
        const removed = await createAdminClient().from("push_subscriptions").delete().eq("id", target.id);
        if (removed.error) console.error("[work-push] 만료 구독 정리 실패", removed.error.code);
      }
    }
    await finishWorkAttention(attention.id, workerId, failed ? "failed" : "ready", !configured ? "Push not configured; available in app" : uncertain ? "Push result uncertain; available in app" : undefined);
    return { kind: "processed", attentionId: attention.id, accepted, failed, uncertain, pushSkipped: !configured || targets.length === 0, pruned };
  } catch (error) {
    await finishWorkAttention(attention.id, workerId, "failed", error instanceof Error ? error.message : "Work attention failed");
    throw error;
  }
}
