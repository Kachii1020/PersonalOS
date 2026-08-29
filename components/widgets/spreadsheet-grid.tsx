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
} from "react";
import {
  SheetEngine,
  cellAddress,
  colToLetter,
  formatCellValue,
} from "@/lib/spreadsheet/engine";
import type { ComputedCell, LabExerciseDef, ValidationOutcome } from "@/lib/spreadsheet/types";

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

function cellChromeStyle(kind: "header" | "readonly" | "empty" | "filled" | "active" | CellMark): CSSProperties {
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

export const SpreadsheetGrid = forwardRef<SpreadsheetGridHandle, Props>(
  function SpreadsheetGrid({ exercise, marks }, ref) {
    const engineRef = useRef<SheetEngine | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [cells, setCells] = useState<ComputedCell[][]>([]);
    const [selected, setSelected] = useState({ row: 0, col: 0 });
    const [draft, setDraft] = useState("");

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
      return () => {
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

    const commit = (row: number, col: number, value: string) => {
      if (!isEditable(row, col)) return;
      const engine = engineRef.current;
      if (!engine) return;
      engine.setInput(row, col, value);
      setCells(engine.snapshot());
    };

    const selectCell = (row: number, col: number) => {
      if (isEditable(selected.row, selected.col)) {
        commit(selected.row, selected.col, draft);
      }
      setSelected({ row, col });
      if (isEditable(row, col)) {
        requestAnimationFrame(() => inputRef.current?.focus());
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
        const next = nextEditable(selected.row, selected.col);
        if (next) selectCell(next.row, next.col);
      } else if (event.key === "Tab") {
        event.preventDefault();
        commit(selected.row, selected.col, draft);
        const next = nextEditable(selected.row, selected.col);
        if (next) selectCell(next.row, next.col);
      } else if (event.key === "Escape") {
        event.preventDefault();
        const cell = cells[selected.row]?.[selected.col];
        setDraft(cell ? inputOf(cell) : "");
      }
    };

    const selectedComputed = cells[selected.row]?.[selected.col];
    const selectedEditable = isEditable(selected.row, selected.col);
    const formulaError = selectedComputed?.error ?? null;

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
            onBlur={() => {
              if (selectedEditable) commit(selected.row, selected.col, draft);
            }}
            onKeyDown={onFormulaKey}
            aria-label="수식 입력"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
        </div>
        {formulaError && (
          <p className="mb-2 text-xs text-negative" role="alert">
            {formulaError}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm">
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
                    const kind = mark
                      ? mark
                      : active
                        ? "active"
                        : !editable
                          ? "readonly"
                          : !computed?.value && !computed?.formula
                            ? "empty"
                            : "filled";
                    const numeric =
                      typeof computed?.value === "number" || format === "number" || format === "currency";
                    return (
                      <td key={col} className="p-0">
                        <button
                          type="button"
                          onClick={() => selectCell(row, col)}
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
