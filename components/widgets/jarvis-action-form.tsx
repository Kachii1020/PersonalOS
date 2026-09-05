"use client";

import { useState, type ReactNode } from "react";

/** Keep recoverable server-action errors and pending state inside the form. */
export function JarvisActionForm({ action, children, className }: {
  action: (data: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form className={className} action={async (data) => {
      setPending(true);
      setMessage(null);
      try {
        await action(data);
      } catch {
        setMessage("처리하지 못했습니다. 입력 내용과 현재 상태를 확인한 뒤 다시 시도하세요.");
      } finally {
        setPending(false);
      }
    }}>
      <fieldset disabled={pending} className="min-w-0 space-y-3" aria-busy={pending}>
        {children}
      </fieldset>
      {pending && <p role="status" className="mt-2 text-sm text-text-muted">처리 중…</p>}
      {message && <p role="alert" className="mt-2 text-sm text-negative">{message}</p>}
    </form>
  );
}
