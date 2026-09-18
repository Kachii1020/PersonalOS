"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { submitWorkbook } from "@/app/(dashboard)/learn/actions";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonLines } from "@/components/ui/skeleton";
import { XLSX_TASKS } from "@/lib/learn/xlsx-tasks";
import { canSubmitXlsx } from "@/lib/learn/xlsx-unlock";
import type { WorkbookSubmission, XlsxCheckResult } from "@/lib/learn/types";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type Props = {
  submissions: WorkbookSubmission[];
  completions: string[];
  focusTaskId?: string;
  onOpenLab?: () => void;
};

export function ExcelTasks({ submissions, completions, focusTaskId, onOpenLab }: Props) {
  const passed = submissions.filter((row) => row.status === "passed").length;

  useEffect(() => {
    if (!focusTaskId) return;
    document.getElementById(`xlsx-${focusTaskId}`)?.scrollIntoView({ block: "start" });
  }, [focusTaskId]);

  return (
    <div className="space-y-4">
      <p className="text-xs tabular-nums text-text-muted font-mono">
        과제 {passed}/{XLSX_TASKS.length}
      </p>
      {XLSX_TASKS.map((task) => (
        <TaskCard
          key={task.id}
          taskId={task.id}
          title={task.title}
          file={task.file}
          instruction={task.instruction}
          unlocked={canSubmitXlsx(task, completions, submissions)}
          submission={submissions.find((row) => row.taskId === task.id)}
          focused={focusTaskId === task.id}
          onOpenLab={onOpenLab}
        />
      ))}
    </div>
  );
}

function TaskCard({
  taskId,
  title,
  file,
  instruction,
  unlocked,
  submission,
  focused,
  onOpenLab,
}: {
  taskId: string;
  title: string;
  file: string;
  instruction: string;
  unlocked: boolean;
  submission?: WorkbookSubmission;
  focused: boolean;
  onOpenLab?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<XlsxCheckResult[] | null>(submission?.results ?? null);
  const [status, setStatus] = useState(submission?.status);

  const onSubmit = async () => {
    const picked = inputRef.current?.files?.[0];
    if (!picked) {
      setError("xlsx 파일을 고르세요.");
      return;
    }
    setPending(true);
    setError(null);
    const body = new FormData();
    body.set("file", picked);
    const result = await submitWorkbook(taskId, body);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStatus(result.status);
    setResults(result.results);
  };

  const failed = (results ?? []).filter((row) => !row.passed);

  return (
    <article
      id={`xlsx-${taskId}`}
      className={`rounded-xl border bg-surface p-5 ${focused ? "border-accent" : "border-line"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-bold text-text">{title}</h2>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-muted">
          {status === "passed" ? "통과" : status === "failed" ? "실패" : "미제출"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-text">{instruction}</p>
      {!unlocked && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-text-muted">핵심 실습을 더 끝내면 제출할 수 있습니다</p>
          {onOpenLab && (
            <button
              type="button"
              onClick={onOpenLab}
              className={`cursor-pointer text-xs font-semibold text-accent ${FOCUS}`}
            >
              실습
            </button>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={file}
          download
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent-soft px-3 py-2 text-xs font-medium text-accent ${FOCUS}`}
        >
          <Download size={12} />
          스타터 받기
        </a>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!unlocked || pending}
          onClick={() => inputRef.current?.click()}
        >
          {fileName ?? "파일 선택"}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!unlocked || pending}
          onClick={() => void onSubmit()}
        >
          제출
        </Button>
      </div>
      {pending && (
        <div className="mt-3">
          <SkeletonLines lines={3} />
        </div>
      )}
      {!pending && error && (
        <ErrorState className="mt-3 py-3" what={error} fix="xlsx인지, 로그인을 확인하세요." />
      )}
      {!pending && status === "failed" && failed.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {failed.map((row) => (
            <li key={row.id} className="text-negative">
              {row.message}
            </li>
          ))}
        </ul>
      )}
      {!pending && status === "passed" && (
        <p className="mt-3 text-sm font-semibold text-positive">이 과제를 통과했습니다</p>
      )}
    </article>
  );
}
