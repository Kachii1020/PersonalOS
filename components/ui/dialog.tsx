"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/design/cn";

/**
 * 범용 모달 (1-B·1-C 공용). 네이티브 <dialog> — 포커스 트랩과 ESC는 브라우저가 준다.
 * 모바일에서는 바텀 시트, lg 이상에서는 중앙 모달.
 */
export function Dialog({
  open,
  onClose,
  label,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        // 백드롭 클릭으로 닫기 — 내용에는 패딩이 없어 target이 dialog 자신일 때만 백드롭이다.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "w-full max-w-none border border-line bg-surface p-0 text-text backdrop:bg-black/40",
        // 모바일: 바텀 시트. 데스크톱: 중앙 모달.
        "mx-auto mt-auto mb-0 rounded-t-xl rounded-b-none",
        "lg:m-auto lg:w-[32rem] lg:rounded-xl",
        "motion-safe:transition-opacity motion-safe:duration-150",
        className,
      )}
    >
      {children}
    </dialog>
  );
}

export function DialogHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <header className="flex items-center justify-between border-b border-line px-4 py-3">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="cursor-pointer rounded-lg p-1 text-text-muted transition-colors hover:bg-accent-soft hover:text-accent"
      >
        <X className="size-4" aria-hidden />
      </button>
    </header>
  );
}
