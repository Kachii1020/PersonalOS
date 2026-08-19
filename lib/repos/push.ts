import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** UI: 세션으로 구독 저장. endpoint가 같으면 키만 갱신. */
export async function upsertPushSubscription(input: PushSubscriptionRow): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(`푸시 구독 저장 실패: ${error.message}`);
}

/** UI: 이 기기 구독 해제. */
export async function deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw new Error(`푸시 구독 삭제 실패: ${error.message}`);
}

/** UI: 구독이 하나라도 있는지. */
export async function hasPushSubscription(): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`푸시 구독 조회 실패: ${error.message}`);
  return (count ?? 0) > 0;
}

/** 잡 전용. */
export async function listPushSubscriptionsForJob(): Promise<PushSubscriptionRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (error) throw new Error(`푸시 구독 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => ({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }));
}

/** 잡 전용. 410/404 응답 난 endpoint를 지운다. */
export async function deletePushSubscriptionForJob(endpoint: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw new Error(`만료 구독 삭제 실패: ${error.message}`);
}
