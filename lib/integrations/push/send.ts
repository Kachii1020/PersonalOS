import "server-only";
import webpush from "web-push";
import {
  deletePushSubscriptionForJob,
  listPushSubscriptionsForJob,
  type PushCategory,
} from "@/lib/repos/push";
import { deliverPush, type PushPayload, type PushSendResult } from "./deliver";

export type { PushPayload, PushSendResult };
export type { PushCategory };

/**
 * 잡 훅. 키 없거나 구독 0이면 skipped. 실패해도 throw하지 않는다.
 * category를 주면 그 카테고리를 끈 구독은 건너뛴다 (2-C). 없으면 전체 발송 (테스트 알림).
 */
export async function sendPush(payload: PushPayload, category?: PushCategory): Promise<PushSendResult> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    return { sent: 0, gone: 0, failed: 0, skipped: true };
  }

  try {
    const all = await listPushSubscriptionsForJob();
    const subscriptions = category ? all.filter((sub) => sub.prefs[category]) : all;
    if (subscriptions.length === 0) {
      return { sent: 0, gone: 0, failed: 0, skipped: true };
    }

    const mailto = process.env.ALLOWED_EMAIL?.trim() || "personal-os@localhost";
    webpush.setVapidDetails(`mailto:${mailto}`, publicKey, privateKey);

    return await deliverPush(
      subscriptions,
      payload,
      async (sub, body) => {
        const response = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(body),
        );
        return { statusCode: response.statusCode };
      },
      deletePushSubscriptionForJob,
    );
  } catch (e) {
    console.error("[push] 발송 준비 실패:", e instanceof Error ? e.message : e);
    return { sent: 0, gone: 0, failed: 1, skipped: false };
  }
}
