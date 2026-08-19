export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushSendResult = {
  sent: number;
  gone: number;
  failed: number;
  skipped: boolean;
};

export type PushSender = (
  subscription: PushSubscriptionKeys,
  payload: PushPayload,
) => Promise<{ statusCode: number }>;

/**
 * 구독 전체에 발송. 예외를 밖으로 던지지 않는다 (SPEC.md 5.6).
 * 410/404는 remove를 호출한다.
 */
export async function deliverPush(
  subscriptions: PushSubscriptionKeys[],
  payload: PushPayload,
  sender: PushSender,
  remove: (endpoint: string) => Promise<void>,
): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, gone: 0, failed: 0, skipped: false };
  for (const sub of subscriptions) {
    try {
      const response = await sender(sub, payload);
      if (response.statusCode === 410 || response.statusCode === 404) {
        await remove(sub.endpoint);
        result.gone += 1;
      } else if (response.statusCode >= 400) {
        result.failed += 1;
      } else {
        result.sent += 1;
      }
    } catch (e) {
      const status = statusOf(e);
      if (status === 410 || status === 404) {
        try {
          await remove(sub.endpoint);
        } catch (removeError) {
          console.error("[push] 만료 구독 삭제 실패:", removeError);
        }
        result.gone += 1;
      } else {
        result.failed += 1;
        console.error("[push] 발송 실패:", e instanceof Error ? e.message : e);
      }
    }
  }
  return result;
}

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const value = (error as { statusCode: unknown }).statusCode;
    return typeof value === "number" ? value : undefined;
  }
  return undefined;
}
