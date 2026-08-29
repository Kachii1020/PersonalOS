import type { CellDef, LabExerciseDef, Validation } from "../types";

export function c(value: string | number | null): CellDef {
  return { value };
}

export function gridLab(opts: {
  id: string;
  moduleSlug: string;
  title: string;
  instruction: string;
  difficulty: 1 | 2 | 3;
  grid: (string | number | null)[][];
  editable: [number, number][];
  validations: {
    row: number;
    col: number;
    expected: number | string;
    re: RegExp;
    msg: string;
    tolerance?: number;
  }[];
  hints: string[];
}): LabExerciseDef {
  const rowCount = opts.grid.length;
  const columnCount = Math.max(...opts.grid.map((row) => row.length));
  return {
    id: opts.id,
    moduleSlug: opts.moduleSlug,
    title: opts.title,
    instruction: opts.instruction,
    columnCount,
    rowCount,
    initialGrid: opts.grid.map((row) => {
      const cells: CellDef[] = [];
      for (let i = 0; i < columnCount; i++) cells.push(c(row[i] ?? null));
      return cells;
    }),
    editableCells: opts.editable.map(([row, col]) => ({ row, col })),
    validations: opts.validations.map(
      (v): Validation => ({
        cell: { row: v.row, col: v.col },
        expectedValue: v.expected,
        acceptFormula: v.re,
        tolerance: v.tolerance,
        successMessage: v.msg,
      }),
    ),
    hints: opts.hints,
    difficulty: opts.difficulty,
  };
}
