"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { cn } from "@/lib/design/cn";

type ToastKind = "success" | "error";
type ToastItem = { id: number; message: string; kind: ToastKind };

const ToastContext = createContext<((message: string, kind?: ToastKind) => void) | null>(null);

/**
 * 폼 제출 결과를 하단 토스트로 보여준다 (UX 개선 F13).
 * (dashboard)/layout.tsx 최상단에 한 번만 마운트한다.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const push = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "toast-in pointer-events-auto max-w-sm rounded-lg px-4 py-2.5 text-sm shadow-lg",
              t.kind === "success" ? "bg-positive text-bg" : "bg-negative text-bg",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** 폼 결과 `{ ok, message }`를 토스트 한 줄로 띄운다. 없으면 아무것도 하지 않는다. */
export function useToast(): (message: string, kind?: ToastKind) => void {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast는 ToastProvider 안에서만 쓸 수 있습니다.");
  return push;
}
