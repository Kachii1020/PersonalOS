import { DetailedCellError, HyperFormula } from "hyperformula";
import type {
  CellDef,
  CellRef,
  ComputedCell,
  LabExerciseDef,
  Validation,
  ValidationOutcome,
} from "./types";

const HF_OPTIONS = { licenseKey: "gpl-v3" as const };

function toRawGrid(
  initial: CellDef[][],
  rows: number,
  cols: number,
): (string | number | boolean | null)[][] {
  const out: (string | number | boolean | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: (string | number | boolean | null)[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(initial[r]?.[c]?.value ?? null);
    }
    out.push(row);
  }
  return out;
}

function parseInput(input: string): string | number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (trimmed.startsWith("=")) return trimmed;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function asError(value: unknown): string | null {
  if (value instanceof DetailedCellError) {
    return value.message ? `${value.value}: ${value.message}` : value.value;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    typeof (value as { value: unknown }).value === "string" &&
    String((value as { value: string }).value).startsWith("#")
  ) {
    const err = value as { value: string; message?: string };
    return err.message ? `${err.value}: ${err.message}` : err.value;
  }
  return null;
}

function valuesMatch(
  actual: string | number | boolean | null,
  expected: number | string,
  tolerance: number,
): boolean {
  if (typeof expected === "number") {
    if (typeof actual === "number" && Number.isFinite(actual)) {
      return Math.abs(actual - expected) <= tolerance;
    }
    return false;
  }
  if (typeof actual === "string") return actual === expected;
  if (typeof actual === "boolean") return String(actual) === expected;
  return false;
}

export class SheetEngine {
  private readonly hf: HyperFormula;
  readonly rowCount: number;
  readonly columnCount: number;

  constructor(exercise: LabExerciseDef) {
    this.rowCount = exercise.rowCount;
    this.columnCount = exercise.columnCount;
    this.hf = HyperFormula.buildFromArray(
      toRawGrid(exercise.initialGrid, exercise.rowCount, exercise.columnCount),
      HF_OPTIONS,
    );
  }

  setInput(row: number, col: number, input: string): ComputedCell {
    try {
      this.hf.setCellContents({ sheet: 0, row, col }, [[parseInput(input)]]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { value: null, formula: input.startsWith("=") ? input : undefined, error: message };
    }
    return this.getCell(row, col);
  }

  getCell(row: number, col: number): ComputedCell {
    const address = { sheet: 0, row, col };
    const raw = this.hf.getCellValue(address);
    const error = asError(raw);
    const formula = this.hf.getCellFormula(address);
    if (error) {
      return { value: null, formula, error };
    }
    if (raw === null || raw === undefined) {
      return { value: null, formula, error: null };
    }
    if (typeof raw === "number" || typeof raw === "string" || typeof raw === "boolean") {
      return { value: raw, formula, error: null };
    }
    return { value: null, formula, error: "#ERROR!" };
  }

  fill(from: CellRef, destinations: CellRef[]): void {
    const targets = destinations.filter((cell) => cell.row !== from.row || cell.col !== from.col);
    if (targets.length === 0) return;
    this.hf.copy({
      start: { sheet: 0, row: from.row, col: from.col },
      end: { sheet: 0, row: from.row, col: from.col },
    });
    for (const cell of targets) {
      this.hf.paste({ sheet: 0, row: cell.row, col: cell.col });
    }
    this.hf.clearClipboard();
  }

  snapshot(): ComputedCell[][] {
    const out: ComputedCell[][] = [];
    for (let r = 0; r < this.rowCount; r++) {
      const row: ComputedCell[] = [];
      for (let c = 0; c < this.columnCount; c++) {
        row.push(this.getCell(r, c));
      }
      out.push(row);
    }
    return out;
  }

  validate(validations: Validation[]): ValidationOutcome[] {
    return validations.map((v) => {
      const cell = this.getCell(v.cell.row, v.cell.col);
      if (cell.error) {
        return {
          cell: v.cell,
          passed: false,
          actual: null,
          expected: v.expectedValue,
          reason: "error",
          message: cell.error,
        };
      }
      if (v.acceptFormula) {
        const formula = cell.formula ?? "";
        if (!v.acceptFormula.test(formula)) {
          return {
            cell: v.cell,
            passed: false,
            actual: cell.value,
            expected: v.expectedValue,
            reason: "formula",
            message: "수식이 조건에 맞지 않습니다. 값을 직접 쓰지 말고 함수를 사용하세요.",
          };
        }
      }
      const tolerance = v.tolerance ?? 0.01;
      const passed = valuesMatch(cell.value, v.expectedValue, tolerance);
      return {
        cell: v.cell,
        passed,
        actual: cell.value,
        expected: v.expectedValue,
        reason: passed ? undefined : "value",
        message: passed ? v.successMessage : "계산 결과가 정답과 다릅니다.",
      };
    });
  }

  destroy(): void {
    this.hf.destroy();
  }
}

export function formatCellValue(
  value: string | number | boolean | null,
  format: CellDef["format"],
  error: string | null,
): string {
  if (error) {
    const code = error.split(":")[0]?.trim();
    return code && code.startsWith("#") ? code : "#ERROR!";
  }
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    if (format === "percent") return `${(value * 100).toFixed(2)}%`;
    if (format === "currency") {
      return `₩${Math.round(value).toLocaleString("ko-KR")}`;
    }
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 100) / 100);
  }
  return String(value);
}

export function colToLetter(col: number): string {
  let n = col + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function cellAddress(row: number, col: number): string {
  return `${colToLetter(col)}${row + 1}`;
}
