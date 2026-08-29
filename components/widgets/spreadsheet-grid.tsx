"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  SheetEngine,
  cellAddress,
  colToLetter,
  formatCellValue,
} from "@/lib/spreadsheet/engine";
import {
  cellInRange,
  cellsBetween,
  insertRangeRef,
  isFormulaPointing,
  lockToAxis,
  rangeAddress,
} from "@/lib/spreadsheet/formula-edit";
import type { CellRef, ComputedCell, LabExerciseDef, ValidationOutcome } from "@/lib/spreadsheet/types";

export type CellMark = "ok" | "bad";

export type SpreadsheetGridHandle = {
  validate: () => ValidationOutcome[];
};

type Props = {
  exercise: LabExerciseDef;
  marks: Record<string, CellMark>;
};

function markKey(row: number, col: number): string {
  return `${row}-${col}`;
}

function chromeLetter(exercise: LabExerciseDef, col: number): string {
  return exercise.headers?.cols?.[col] ?? colToLetter(col);
}

function chromeRow(exercise: LabExerciseDef, row: number): string {
  return exercise.headers?.rows?.[row] ?? String(row + 1);
}

function cellChromeStyle(
  kind: "header" | "readonly" | "empty" | "filled" | "active" | "range" | CellMark,
): CSSProperties {
  if (kind === "header") {
    return {
      backgroundColor: "var(--accent-soft)",
      border: "1px solid var(--line)",
      color: "var(--text)",
      fontWeight: 700,
    };
  }
  if (kind === "readonly") {
    return {
      backgroundColor: "var(--bg)",
      border: "1px solid var(--line)",
      color: "var(--text-muted)",
    };
  }
  if (kind === "ok") {
    return {
      backgroundColor: "var(--surface)",
      border: "2px solid var(--positive)",
      color: "var(--positive)",
    };
  }
  if (kind === "bad") {
    return {
      backgroundColor: "var(--surface)",
      border: "2px solid var(--negative)",
      color: "var(--negative)",
    };
  }
  if (kind === "range") {
    return {
      backgroundColor: "var(--accent-soft)",
      border: "1px solid var(--accent)",
      color: "var(--text)",
    };
  }
  if (kind === "active") {
    return {
      backgroundColor: "var(--surface)",
      border: "2px solid var(--accent)",
      color: "var(--text)",
    };
  }
  if (kind === "empty") {
    return {
      backgroundColor: "var(--surface)",
      border: "1px dashed var(--line)",
      color: "var(--text)",
    };
  }
  return {
    backgroundColor: "var(--surface)",
    border: "1px solid var(--line)",
    color: "var(--text)",
  };
}

function inputOf(cell: ComputedCell): string {
  if (cell.formula) return cell.formula;
  if (cell.error) return "";
  if (cell.value === null || cell.value === undefined) return "";
  return String(cell.value);
}

function cellFromPoint(x: number, y: number): CellRef | null {
  const el = document.elementFromPoint(x, y);
  const host = el instanceof Element ? el.closest("[data-sheet-row]") : null;
  if (!host) return null;
  const row = Number(host.getAttribute("data-sheet-row"));
  const col = Number(host.getAttribute("data-sheet-col"));
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  return { row, col };
}

export const SpreadsheetGrid = forwardRef<SpreadsheetGridHandle, Props>(
  function SpreadsheetGrid({ exercise, marks }, ref) {
    const engineRef = useRef<SheetEngine | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const draftRef = useRef("");
    const dragCleanupRef = useRef<(() => void) | null>(null);
    const suppressBlurCommitRef = useRef(false);
    const [cells, setCells] = useState<ComputedCell[][]>([]);
    const [selected, setSelected] = useState({ row: 0, col: 0 });
    const [draft, setDraft] = useState("");
    const [formulaFocused, setFormulaFocused] = useState(false);
    const [pointing, setPointing] = useState<{ start: CellRef; end: CellRef } | null>(null);
    const [filling, setFilling] = useState<{ start: CellRef; end: CellRef } | null>(null);

    draftRef.current = draft;

    const editableSet = useMemo(() => {
      const set = new Set<string>();
      for (const cell of exercise.editableCells) set.add(markKey(cell.row, cell.col));
      return set;
    }, [exercise.editableCells]);

    useEffect(() => {
      const engine = new SheetEngine(exercise);
      engineRef.current = engine;
      setCells(engine.snapshot());
      const first = exercise.editableCells[0] ?? { row: 0, col: 0 };
      setSelected(first);
      setDraft("");
      setPointing(null);
      setFilling(null);
      return () => {
        dragCleanupRef.current?.();
        dragCleanupRef.current = null;
        engine.destroy();
        engineRef.current = null;
      };
    }, [exercise]);

    useEffect(() => {
      const cell = cells[selected.row]?.[selected.col];
      if (cell) setDraft(inputOf(cell));
    }, [cells, selected.col, selected.row]);

    useImperativeHandle(
      ref,
      () => ({
        validate() {
          return engineRef.current?.validate(exercise.validations) ?? [];
        },
      }),
      [exercise.validations],
    );

    const isEditable = (row: number, col: number) => editableSet.has(markKey(row, col));
    const pointingMode = isFormulaPointing(draft, formulaFocused);

    const commit = (row: number, col: number, value: string) => {
      if (!isEditable(row, col)) return;
      const engine = engineRef.current;
      if (!engine) return;
      engine.setInput(row, col, value);
      setCells(engine.snapshot());
    };

    const selectCell = (row: number, col: number, edit: boolean) => {
      if (isEditable(selected.row, selected.col)) {
        commit(selected.row, selected.col, draft);
      }
      setSelected({ row, col });
      if (edit && isEditable(row, col)) {
        requestAnimationFrame(() => inputRef.current?.focus());
      } else {
        setFormulaFocused(false);
        inputRef.current?.blur();
      }
    };

    const nextEditable = (fromRow: number, fromCol: number) => {
      const list = exercise.editableCells;
      const idx = list.findIndex((c) => c.row === fromRow && c.col === fromCol);
      return list[(idx + 1) % list.length] ?? list[0];
    };

    const onFormulaKey = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit(selected.row, selected.col, draft);
        setFormulaFocused(false);
        inputRef.current?.blur();
      } else if (event.key === "Tab") {
        event.preventDefault();
        commit(selected.row, selected.col, draft);
        const next = nextEditable(selected.row, selected.col);
        if (next) selectCell(next.row, next.col, false);
      } else if (event.key === "Escape") {
        event.preventDefault();
        const cell = cells[selected.row]?.[selected.col];
        setDraft(cell ? inputOf(cell) : "");
      }
    };

    const beginPointing = (row: number, col: number, event: ReactPointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragCleanupRef.current?.();
      suppressBlurCommitRef.current = true;
      const originFormula = draftRef.current;
      const start = { row, col };
      setPointing({ start, end: start });
      setDraft(insertRangeRef(originFormula, rangeAddress(start, start)));

      const onMove = (ev: PointerEvent) => {
        const cell = cellFromPoint(ev.clientX, ev.clientY);
        if (!cell) return;
        setPointing({ start, end: cell });
        setDraft(insertRangeRef(originFormula, rangeAddress(start, cell)));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        dragCleanupRef.current = null;
        setPointing(null);
        inputRef.current?.focus();
        suppressBlurCommitRef.current = false;
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      dragCleanupRef.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
    };

    const beginFill = (event: ReactPointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragCleanupRef.current?.();
      setFormulaFocused(false);
      inputRef.current?.blur();
      if (isEditable(selected.row, selected.col)) {
        commit(selected.row, selected.col, draftRef.current);
      }
      const origin = { row: selected.row, col: selected.col };
      const live = { start: origin, end: origin };
      setFilling(live);

      const onMove = (ev: PointerEvent) => {
        const cell = cellFromPoint(ev.clientX, ev.clientY);
        if (!cell) return;
        const end = lockToAxis(origin, cell);
        live.end = end;
        setFilling({ start: origin, end });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        dragCleanupRef.current = null;
        const dests = cellsBetween(origin, live.end).filter(
          (cell) =>
            (cell.row !== origin.row || cell.col !== origin.col) && isEditable(cell.row, cell.col),
        );
        const engine = engineRef.current;
        if (engine && dests.length > 0) {
          engine.fill(origin, dests);
          setCells(engine.snapshot());
        }
        setFilling(null);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      dragCleanupRef.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
    };

    const selectedComputed = cells[selected.row]?.[selected.col];
    const selectedEditable = isEditable(selected.row, selected.col);
    const formulaError = selectedComputed?.error ?? null;
    const dragRange = pointing ?? filling;
    const showFillHandle = !pointing && !filling;

    return (
      <div>
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-bg py-2">
          <span className="w-10 shrink-0 text-center font-mono text-xs text-text-muted">
            {cellAddress(selected.row, selected.col)}
          </span>
          <input
            ref={inputRef}
            value={draft}
            disabled={!selectedEditable}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setFormulaFocused(true)}
            onBlur={() => {
              if (suppressBlurCommitRef.current) return;
              setFormulaFocused(false);
              if (selectedEditable) commit(selected.row, selected.col, draft);
            }}
            onKeyDown={onFormulaKey}
            aria-label="수식 입력"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
        </div>
        <p className="mb-2 text-xs text-text-muted">
          수식이 =로 시작할 때 셀을 드래그하면 범위가 들어갑니다. 셀 모서리 네모를 끌면 채웁니다.
        </p>
        {formulaError && (
          <p className="mb-2 text-xs text-negative" role="alert">
            {formulaError}
          </p>
        )}
        <div className="overflow-x-auto pb-2 pr-2" style={{ userSelect: dragRange ? "none" : undefined }}>
          <table className="border-collapse touch-none text-sm">
            <thead>
              <tr>
                <th
                  className="h-8 w-8 p-0 font-mono text-[10px]"
                  style={cellChromeStyle("header")}
                />
                {Array.from({ length: exercise.columnCount }, (_, col) => (
                  <th
                    key={col}
                    className="h-8 min-w-20 px-2 font-mono text-[10px]"
                    style={cellChromeStyle("header")}
                  >
                    {chromeLetter(exercise, col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: exercise.rowCount }, (_, row) => (
                <tr key={row}>
                  <th
                    className="w-8 px-1 font-mono text-[10px]"
                    style={cellChromeStyle("header")}
                  >
                    {chromeRow(exercise, row)}
                  </th>
                  {Array.from({ length: exercise.columnCount }, (_, col) => {
                    const computed = cells[row]?.[col];
                    const format = exercise.initialGrid[row]?.[col]?.format;
                    const editable = isEditable(row, col);
                    const active = selected.row === row && selected.col === col;
                    const mark = marks[markKey(row, col)];
                    const inDrag = dragRange ? cellInRange({ row, col }, dragRange.start, dragRange.end) : false;
                    const kind = mark
                      ? mark
                      : active
                        ? "active"
                        : inDrag
                          ? "range"
                          : !editable
                            ? "readonly"
                            : !computed?.value && !computed?.formula
                              ? "empty"
                              : "filled";
                    const numeric =
                      typeof computed?.value === "number" || format === "number" || format === "currency";
                    return (
                      <td
                        key={col}
                        className="relative p-0"
                        data-sheet-row={row}
                        data-sheet-col={col}
                      >
                        <button
                          type="button"
                          onPointerDown={(event) => {
                            if (pointingMode) beginPointing(row, col, event);
                          }}
                          onDoubleClick={() => {
                            if (pointingMode) return;
                            selectCell(row, col, true);
                          }}
                          onClick={() => {
                            if (pointingMode) return;
                            selectCell(row, col, false);
                          }}
                          className={`flex h-8 min-w-20 cursor-pointer items-center px-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                            numeric ? "justify-end font-mono tabular-nums" : "justify-start"
                          }`}
                          style={cellChromeStyle(kind)}
                          aria-label={`${cellAddress(row, col)}${editable ? " 편집 가능" : ""}`}
                        >
                          {computed
                            ? formatCellValue(computed.value, format, computed.error)
                            : ""}
                        </button>
                        {active && showFillHandle && (
                          <button
                            type="button"
                            aria-label="채우기 핸들"
                            onPointerDown={beginFill}
                            className="absolute -bottom-2 -right-2 z-20 flex h-4 w-4 cursor-pointer items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                          >
                            <span className="block h-2.5 w-2.5 border border-surface bg-accent" />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
);
