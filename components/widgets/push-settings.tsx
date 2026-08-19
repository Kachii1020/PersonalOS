"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { savePushSubscription, deletePushSubscription, sendTestPush } from "@/app/(dashboard)/settings/actions";

type Status = "checking" | "unsupported" | "need-install" | "off" | "on";

type Diag = {
  standalone: boolean;
  serviceWorker: boolean;
  pushManager: boolean;
  permission: NotificationPermission | "unknown";
};

export function PushSettings({
  vapidPublicKey,
  vapidReady,
  subscribedOnServer,
}: {
  vapidPublicKey: string | null;
  vapidReady: boolean;
  subscribedOnServer: boolean;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [diag, setDiag] = useState<Diag | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Diag = {
        standalone: isStandalone(),
        serviceWorker: "serviceWorker" in navigator,
        pushManager: "PushManager" in window,
        permission: typeof Notification === "undefined" ? "unknown" : Notification.permission,
      };
      if (!cancelled) setDiag(next);

      if (!vapidPublicKey || !next.serviceWorker || !next.pushManager) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (isIos() && !next.standalone) {
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
      setDiag((d) => (d ? { ...d, permission } : d));
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
      setMessage("구독했습니다. 테스트 알림을 보내 왕복을 확인하세요.");
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
      <ul className="space-y-1 text-sm">
        <DiagRow label="VAPID" ok={vapidReady} yes="설정됨" no="없음 — npm run vapid:generate" />
        <DiagRow label="홈 화면 앱" ok={diag?.standalone ?? false} yes="예" no="아니오 (iPhone은 필수)" />
        <DiagRow label="서비스 워커" ok={diag?.serviceWorker ?? false} yes="가능" no="없음" />
        <DiagRow
          label="서버 구독"
          ok={subscribedOnServer}
          yes="push_subscriptions 1행+"
          no="0행"
        />
        {diag && (
          <li className="flex justify-between gap-3">
            <span className="text-text-muted">알림 권한</span>
            <span className="text-text">{diag.permission}</span>
          </li>
        )}
      </ul>

      {status === "unsupported" && (
        <p className="text-sm text-text-muted">
          Web Push를 쓸 수 없습니다. VAPID 키와 프로덕션 서비스 워커가 필요합니다.
        </p>
      )}
      {status === "need-install" && (
        <p className="text-sm text-text-muted">
          iPhone은 Safari 공유 → 홈 화면에 추가한 뒤, 그 아이콘으로 열어야 알림을 받을 수 있습니다.
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

      <ol className="list-decimal space-y-1 pl-5 text-xs text-text-muted">
        <li>G4-1: 구독 → 테스트 알림이 이 기기에 뜨는지</li>
        <li>G4-4: 대시보드를 연 뒤 비행기 모드 → 다시 열면 상단에 오프라인 표시</li>
        <li>G4-5: 비행기 모드를 끄고 새로고침 → 최신 화면 (캐시가 가리지 않음)</li>
      </ol>
    </div>
  );
}

function DiagRow({ label, ok, yes, no }: { label: string; ok: boolean; yes: string; no: string }) {
  return (
    <li className="flex justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      <span className={ok ? "text-positive" : "text-text"}>{ok ? yes : no}</span>
    </li>
  );
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const ios = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return media || ios;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
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
