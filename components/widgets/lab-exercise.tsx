"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SpreadsheetGrid, type CellMark, type SpreadsheetGridHandle } from "@/components/widgets/spreadsheet-grid";
import { coreLabsForModule, extraLabsForModule } from "@/lib/learn/core-track";
import { getExercisesForModule } from "@/lib/spreadsheet/exercises";
import { cellAddress } from "@/lib/spreadsheet/engine";
import type { LabExerciseDef } from "@/lib/spreadsheet/types";

type Props = {
  moduleSlug: string;
  completedIds: string[];
  initialExerciseId?: string;
  startInExtra?: boolean;
  onCompleted: (exerciseId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onGoToQuiz: () => void;
};

function initialIndex(list: LabExerciseDef[], completedIds: string[], focusId?: string) {
  if (focusId) {
    const focused = list.findIndex((ex) => ex.id === focusId);
    if (focused >= 0) return focused;
  }
  const firstOpen = list.findIndex((ex) => !completedIds.includes(ex.id));
  return firstOpen === -1 ? 0 : firstOpen;
}

export function LabExercise({
  moduleSlug,
  completedIds,
  initialExerciseId,
  startInExtra = false,
  onCompleted,
  onGoToQuiz,
}: Props) {
  const all = useMemo(() => getExercisesForModule(moduleSlug), [moduleSlug]);
  const core = useMemo(() => coreLabsForModule(moduleSlug), [moduleSlug]);
  const extra = useMemo(() => extraLabsForModule(moduleSlug), [moduleSlug]);

  const [showExtra, setShowExtra] = useState(() => {
    if (startInExtra && extra.length > 0) return true;
    if (initialExerciseId && extra.some((ex) => ex.id === initialExerciseId)) return true;
    return false;
  });

  const exercises = showExtra ? extra : core;

  const [index, setIndex] = useState(() =>
    initialIndex(showExtra ? extra : core, completedIds, initialExerciseId),
  );
  const [hintCount, setHintCount] = useState(0);
  const [marks, setMarks] = useState<Record<string, CellMark>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [passed, setPassed] = useState(() => {
    const list = showExtra ? extra : core;
    const start = initialIndex(list, completedIds, initialExerciseId);
    return completedIds.includes(list[start]?.id ?? "");
  });
  const gridRef = useRef<SpreadsheetGridHandle>(null);

  const resetLocal = (nextIndex: number, list = exercises) => {
    setIndex(nextIndex);
    setHintCount(0);
    setMarks({});
    setFeedback(null);
    setSaveError(null);
    setPassed(completedIds.includes(list[nextIndex]?.id ?? ""));
  };

  const openList = (nextExtra: boolean) => {
    const list = nextExtra ? extra : core;
    setShowExtra(nextExtra);
    resetLocal(initialIndex(list, completedIds), list);
  };

  if (all.length === 0) {
    return (
      <EmptyState
        message="이 모듈의 실습은 아직 없습니다. 퀴즈로 개념을 확인하세요."
        action={
          <Button type="button" variant="primary" onClick={onGoToQuiz}>
            퀴즈로 이동
          </Button>
        }
      />
    );
  }

  if (!showExtra && core.length === 0) {
    return (
      <EmptyState
        message="이 모듈의 핵심 실습은 없습니다. 퀴즈로 확인하거나 더 풀어 보세요."
        action={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" onClick={onGoToQuiz}>
              퀴즈로 이동
            </Button>
            {extra.length > 0 && (
              <Button type="button" variant="secondary" onClick={() => openList(true)}>
                더 풀기 {extra.length}
              </Button>
            )}
          </div>
        }
      />
    );
  }

  if (exercises.length === 0) {
    return (
      <EmptyState
        message="이 목록에 실습이 없습니다. 핵심 실습으로 돌아가세요."
        action={
          <Button type="button" variant="primary" onClick={() => openList(false)}>
            핵심만
          </Button>
        }
      />
    );
  }

  const safeIndex = Math.min(index, exercises.length - 1);
  const exercise = exercises[safeIndex];
  const doneHere = completedIds.includes(exercise.id) || passed;
  const isDone = (id: string) =>
    completedIds.includes(id) || (id === exercise.id && passed);
  const coreDone = core.length > 0 && core.every((ex) => isDone(ex.id));

  const onValidate = async () => {
    const results = gridRef.current?.validate() ?? [];
    const nextMarks: Record<string, CellMark> = {};
    for (const result of results) {
      nextMarks[`${result.cell.row}-${result.cell.col}`] = result.passed ? "ok" : "bad";
    }
    setMarks(nextMarks);

    const failed = results.filter((r) => !r.passed);
    if (failed.length > 0) {
      const first = failed[0];
      setPassed(false);
      setFeedback(
        first
          ? `${cellAddress(first.cell.row, first.cell.col)}: ${first.message}`
          : "정답이 아닌 셀이 있습니다.",
      );
      return;
    }

    setFeedback(
      results.length > 1 ? "모든 셀이 정답입니다." : (results[0]?.message ?? "정답입니다."),
    );
    setPassed(true);
    const saved = await onCompleted(exercise.id);
    if (!saved.ok) {
      setSaveError(saved.error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs tabular-nums text-text-muted font-mono">
          {showExtra ? "더 풀기" : "핵심 실습"} {safeIndex + 1}/{exercises.length}
          {doneHere && <span className="ml-2 text-positive">완료</span>}
        </p>
        <div className="flex items-center gap-1">
          {extra.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openList(!showExtra)}
            >
              {showExtra ? "핵심만" : `더 풀기 ${extra.length}`}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={safeIndex === 0}
            onClick={() => resetLocal(safeIndex - 1)}
            aria-label="이전 실습"
          >
            <ChevronLeft size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={safeIndex >= exercises.length - 1}
            onClick={() => resetLocal(safeIndex + 1)}
            aria-label="다음 실습"
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-bold text-text">{exercise.title}</h2>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-muted">
            Lv.{exercise.difficulty}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-text">{exercise.instruction}</p>

        <div className="mt-4">
          <SpreadsheetGrid
            key={exercise.id}
            ref={gridRef}
            exercise={exercise}
            marks={marks}
          />
        </div>

        {feedback && (
          <p
            className={`mt-3 text-sm ${passed ? "text-positive" : "text-negative"}`}
            role="status"
          >
            {feedback}
          </p>
        )}

        {saveError && (
          <ErrorState
            className="mt-3"
            what="실습 완료 기록에 실패했습니다"
            fix="네트워크를 확인하고 다시 검증하세요."
          />
        )}

        {hintCount > 0 && (
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-text-muted">
            {exercise.hints.slice(0, hintCount).map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ol>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={() => void onValidate()}>
            검증
          </Button>
          {hintCount < exercise.hints.length && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setHintCount((n) => Math.min(n + 1, 3))}
            >
              <Lightbulb size={14} />
              힌트
            </Button>
          )}
        </div>
      </div>

      {coreDone && (
        <div className="rounded-xl border border-line bg-surface p-5 text-center">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 size={18} className="text-positive" />
            <span className="text-sm font-semibold text-text">핵심 실습을 모두 완료했습니다</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Button type="button" variant="primary" onClick={onGoToQuiz}>
              퀴즈 시작
            </Button>
            {!showExtra && extra.length > 0 && (
              <Button type="button" variant="secondary" onClick={() => openList(true)}>
                더 풀기 {extra.length}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
