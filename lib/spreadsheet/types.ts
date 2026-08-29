export type CellFormat = "text" | "number" | "currency" | "percent";

export interface CellDef {
  value: string | number | null;
  format?: CellFormat;
}

export interface CellRef {
  row: number;
  col: number;
}

export interface Validation {
  cell: CellRef;
  expectedValue: number | string;
  acceptFormula?: RegExp;
  tolerance?: number;
  successMessage: string;
}

export interface LabExerciseDef {
  id: string;
  moduleSlug: string;
  title: string;
  instruction: string;
  columnCount: number;
  rowCount: number;
  headers?: { cols?: string[]; rows?: string[] };
  initialGrid: CellDef[][];
  editableCells: CellRef[];
  validations: Validation[];
  hints: string[];
  difficulty: 1 | 2 | 3;
}

export type ComputedCell = {
  value: string | number | boolean | null;
  formula: string | undefined;
  error: string | null;
};

export type ValidationOutcome = {
  cell: CellRef;
  passed: boolean;
  actual: string | number | boolean | null;
  expected: number | string;
  reason?: "value" | "formula" | "error";
  message: string;
};
