"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { savePushSubscription, deletePushSubscription, sendTestPush } from "@/app/(dashboard)/settings/actions";

type Status = "checking" | "unsupported" | "need-install" | "off" | "on";

export function PushSettings({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (!isStandalone()) {
        if (!cancelled) setStatus("need-install");
        return;
      }
      const existing = await currentSubscription();
      if (!cancelled) setStatus(existing ? "on" : "off");
    })();
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  async function subscribe() {
    if (!vapidPublicKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("알림 권한이 거부됐습니다. iPhone 설정에서 Personal OS 알림을 허용하세요.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("구독 키를 읽지 못했습니다.");
      }
      const result = await savePushSubscription({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setStatus("on");
      setMessage("구독했습니다. 테스트 알림을 보낼 수 있습니다.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setMessage(null);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
      setMessage("구독을 해제했습니다.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await sendTestPush();
      setMessage(result.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {status === "unsupported" && (
        <p className="text-sm text-text-muted">
          이 브라우저는 Web Push를 지원하지 않거나 VAPID 공개키가 없습니다. 환경변수 NEXT_PUBLIC_VAPID_PUBLIC_KEY를
          확인하세요.
        </p>
      )}
      {status === "need-install" && (
        <p className="text-sm text-text-muted">
          iPhone은 홈 화면에 추가한 뒤에만 알림을 받을 수 있습니다. Safari 공유 → 홈 화면에 추가 → 그 아이콘으로
          여세요.
        </p>
      )}
      {status === "off" && (
        <Button type="button" onClick={() => void subscribe()} disabled={busy}>
          알림 구독
        </Button>
      )}
      {status === "on" && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void test()} disabled={busy}>
            테스트 알림
          </Button>
          <Button type="button" variant="secondary" onClick={() => void unsubscribe()} disabled={busy}>
            구독 해제
          </Button>
        </div>
      )}
      {message && <p className="text-sm text-text-muted">{message}</p>}
    </div>
  );
}

function isStandalone(): boolean {
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const ios = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return media || ios;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
