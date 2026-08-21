"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/design/cn";
import { quickAddEvent, quickAddTask } from "@/app/(dashboard)/actions";
import { ymd } from "@/lib/time";

export const QUICK_CAPTURE_EVENT = "personalos:quick-capture";

/** 어디서든 퀵 캡처를 연다. 탭 바 FAB와 키보드 N이 이걸 쓴다. */
export function openQuickCapture() {
  window.dispatchEvent(new CustomEvent(QUICK_CAPTURE_EVENT));
}

type Mode = "task" | "event";

/**
 * 퀵 캡처 (1-B). 모바일 FAB → 바텀 시트. 데스크톱은 키보드 N.
 * 할 일은 제목만으로 저장, 일정은 제목+날짜+시작으로 iCloud PUT까지.
 */
export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("task");
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(QUICK_CAPTURE_EVENT, show);
    return () => window.removeEventListener(QUICK_CAPTURE_EVENT, show);
  }, []);

  function close() {
    setOpen(false);
  }

  function submitTask(formData: FormData) {
    const title = String(formData.get("title") ?? "");
    const dueDate = String(formData.get("dueDate") ?? "");
    startTransition(async () => {
      const result = await quickAddTask({ title, ...(dueDate ? { dueDate } : {}) });
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        close();
        router.refresh();
      }
    });
  }

  function submitEvent(formData: FormData) {
    const summary = String(formData.get("summary") ?? "");
    const date = String(formData.get("date") ?? "");
    const startTime = String(formData.get("startTime") ?? "");
    startTransition(async () => {
      const result = await quickAddEvent({ summary, date, startTime });
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        close();
        router.refresh();
      }
    });
  }

  const today = ymd(new Date());

  return (
    <Dialog open={open} onClose={close} label="빠른 추가">
      <DialogHeader title="빠른 추가" onClose={close} />
      <div className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div role="tablist" aria-label="추가 종류" className="flex gap-1 rounded-lg bg-accent-soft p-1">
          <ModeTab active={mode === "task"} onClick={() => setMode("task")}>
            할 일
          </ModeTab>
          <ModeTab active={mode === "event"} onClick={() => setMode("event")}>
            일정
          </ModeTab>
        </div>

        {mode === "task" ? (
          <form action={submitTask} className="space-y-3">
            <Field label="할 일" htmlFor="qc-title" hint="Enter로 바로 저장. 카테고리는 나중에 붙일 수 있습니다.">
              {/* 시트가 열리면 바로 타이핑 — 캡처는 속도가 전부다. */}
              <Input id="qc-title" name="title" required autoFocus placeholder="예: 재무회계 과제 제출" />
            </Field>
            <Field label="마감 (선택)" htmlFor="qc-due">
              <Input id="qc-due" name="dueDate" type="date" />
            </Field>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "저장 중" : "할 일 추가"}
            </Button>
          </form>
        ) : (
          <form action={submitEvent} className="space-y-3">
            <Field label="일정" htmlFor="qc-summary">
              <Input id="qc-summary" name="summary" required autoFocus placeholder="예: 면접 준비" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="날짜" htmlFor="qc-date">
                <Input id="qc-date" name="date" type="date" required defaultValue={today} />
              </Field>
              <Field label="시작" htmlFor="qc-start" hint="종료는 1시간 뒤로 잡힙니다.">
                <Input id="qc-start" name="startTime" type="time" required />
              </Field>
            </div>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "저장 중" : "iCloud에 추가"}
            </Button>
          </form>
        )}
      </div>
    </Dialog>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-surface text-text" : "text-text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
