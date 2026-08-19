"use client";

import { useEffect, useState } from "react";

/** 오프라인일 때만 보인다. 캐시 폴백 HTML이 낡은 데이터임을 숨기지 않는다 (SPEC.md 5.7). */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div role="status" className="border-b border-line bg-accent-soft px-4 py-2 text-sm text-text">
      오프라인 — 마지막 동기화 데이터
    </div>
  );
}
