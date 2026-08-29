import { cellAddress } from "./engine";
import type { CellRef } from "./types";

const REF_TOKEN = /\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+|\$?[A-Z]+\$?\d+/gi;
const INSERT_BOUNDARY = /[=\(\,\+\-\*\/\&]$/;

export function normalizeFormula(formula: string): string {
  const trimmed = formula.trim();
  if (trimmed === "") return "=";
  return trimmed.startsWith("=") ? trimmed : `=${trimmed}`;
}

export function isFormulaPointing(formula: string, formulaFocused: boolean): boolean {
  return formulaFocused && formula.trim().startsWith("=");
}

export function splitFormulaRef(formula: string): { prefix: string; suffix: string } {
  const f = normalizeFormula(formula);
  let last: { start: number; end: number } | null = null;
  REF_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REF_TOKEN.exec(f)) !== null) {
    last = { start: match.index, end: match.index + match[0].length };
  }
  if (!last) return { prefix: f, suffix: "" };
  const after = f.slice(last.end);
  if (!/^\)*$/.test(after)) return { prefix: f, suffix: "" };
  const prefix = f.slice(0, last.start);
  const boundary = prefix.trimEnd();
  if (boundary === "" || INSERT_BOUNDARY.test(boundary)) {
    return { prefix, suffix: after };
  }
  return { prefix: f, suffix: "" };
}

export function insertRangeRef(formula: string, ref: string): string {
  const { prefix, suffix } = splitFormulaRef(formula);
  return `${prefix}${ref}${suffix}`;
}

export function rangeAddress(a: CellRef, b: CellRef): string {
  const r1 = Math.min(a.row, b.row);
  const c1 = Math.min(a.col, b.col);
  const r2 = Math.max(a.row, b.row);
  const c2 = Math.max(a.col, b.col);
  const start = cellAddress(r1, c1);
  const end = cellAddress(r2, c2);
  return start === end ? start : `${start}:${end}`;
}

export function lockToAxis(origin: CellRef, cursor: CellRef): CellRef {
  const dRow = cursor.row - origin.row;
  const dCol = cursor.col - origin.col;
  if (Math.abs(dRow) >= Math.abs(dCol)) {
    return { row: cursor.row, col: origin.col };
  }
  return { row: origin.row, col: cursor.col };
}

export function cellsBetween(a: CellRef, b: CellRef): CellRef[] {
  const r1 = Math.min(a.row, b.row);
  const r2 = Math.max(a.row, b.row);
  const c1 = Math.min(a.col, b.col);
  const c2 = Math.max(a.col, b.col);
  const out: CellRef[] = [];
  for (let row = r1; row <= r2; row++) {
    for (let col = c1; col <= c2; col++) {
      out.push({ row, col });
    }
  }
  return out;
}

export function cellInRange(cell: CellRef, a: CellRef, b: CellRef): boolean {
  const r1 = Math.min(a.row, b.row);
  const r2 = Math.max(a.row, b.row);
  const c1 = Math.min(a.col, b.col);
  const c2 = Math.max(a.col, b.col);
  return cell.row >= r1 && cell.row <= r2 && cell.col >= c1 && cell.col <= c2;
}
