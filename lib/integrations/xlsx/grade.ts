import type { XlsxCheck, XlsxCheckResult, XlsxTask } from "@/lib/learn/types";
import { cellKey, parseXlsx } from "./parse";

const MISSING_CACHE = "엑셀에서 계산한 뒤 저장해 제출하세요.";

function normFormula(formula: string): string {
  return formula.replace(/\$/g, "").replace(/_xlfn\./gi, "").replace(/\s+/g, "").toUpperCase();
}

function valuesClose(actual: number, expected: number, tolerance: number): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function gradeCheck(
  check: XlsxCheck,
  book: ReturnType<typeof parseXlsx>,
): XlsxCheckResult {
  switch (check.kind) {
    case "sheet-exists": {
      const passed = book.sheets.includes(check.name);
      return {
        id: check.id,
        passed,
        message: passed ? `${check.name} 시트가 있습니다.` : `${check.id}: ${check.name} 시트가 없습니다 / 시트 이름을 확인하세요.`,
      };
    }
    case "sheet-order": {
      const passed = book.sheets.join("\0") === check.names.join("\0");
      return {
        id: check.id,
        passed,
        message: passed
          ? "시트 순서가 맞습니다."
          : `${check.id}: 시트 순서가 ${check.names.join(" → ")}가 아닙니다 / 순서를 맞추세요.`,
      };
    }
    case "cell-value": {
      const cell = book.cells.get(cellKey(check.sheet, check.addr));
      if (!cell) {
        return {
          id: check.id,
          passed: false,
          message: `${check.id}: ${check.sheet}!${check.addr}가 비어 있습니다 / 값을 넣으세요.`,
        };
      }
      if (cell.formula && (cell.value === null || cell.value === "")) {
        return { id: check.id, passed: false, message: MISSING_CACHE };
      }
      const tolerance = check.tolerance ?? (typeof check.expected === "number" && Number.isInteger(check.expected) ? 0 : 0.005);
      if (typeof check.expected === "number") {
        const actual = typeof cell.value === "number" ? cell.value : Number(cell.value);
        const passed = Number.isFinite(actual) && valuesClose(actual, check.expected, tolerance);
        return {
          id: check.id,
          passed,
          message: passed
            ? `${check.sheet}!${check.addr} 값이 맞습니다.`
            : `${check.id}: ${check.sheet}!${check.addr}이 ${check.expected}이 아닙니다 / 수식과 저장을 확인하세요.`,
        };
      }
      const passed = String(cell.value ?? "") === check.expected;
      return {
        id: check.id,
        passed,
        message: passed
          ? `${check.sheet}!${check.addr} 값이 맞습니다.`
          : `${check.id}: ${check.sheet}!${check.addr} 값이 다릅니다 / 기대한 텍스트를 넣으세요.`,
      };
    }
    case "cell-formula": {
      const cell = book.cells.get(cellKey(check.sheet, check.addr));
      const formula = cell?.formula;
      if (!formula) {
        return {
          id: check.id,
          passed: false,
          message: `${check.id}: ${check.sheet}!${check.addr}에 수식이 없습니다 / =로 시작하는 수식을 넣으세요.`,
        };
      }
      if (cell.value === null || cell.value === "") {
        return { id: check.id, passed: false, message: MISSING_CACHE };
      }
      const passed = normFormula(formula).includes(normFormula(check.pattern));
      return {
        id: check.id,
        passed,
        message: passed
          ? `${check.sheet}!${check.addr} 수식이 맞습니다.`
          : `${check.id}: ${check.sheet}!${check.addr} 수식에 ${check.pattern}이 없습니다 / 수식을 고치세요.`,
      };
    }
    case "named-range": {
      const passed = book.names.some((name) => name.toLowerCase() === check.name.toLowerCase());
      return {
        id: check.id,
        passed,
        message: passed
          ? `${check.name} 이름이 있습니다.`
          : `${check.id}: ${check.name} 이름이 없습니다 / 이름 관리자에서 정의하세요.`,
      };
    }
    case "font-theme":
      return { id: check.id, passed: false, message: `${check.id}: 색 채점은 아직 없습니다 / 다음 슬라이스에서 엽니다.` };
    case "part-exists": {
      const passed = book.parts[check.part];
      return {
        id: check.id,
        passed,
        message: passed
          ? `${check.part} 파트가 있습니다.`
          : `${check.id}: ${check.part}가 없습니다 / 엑셀에서 해당 기능을 쓰고 저장하세요.`,
      };
    }
  }
}

export function gradeWorkbook(
  task: XlsxTask,
  bytes: Uint8Array,
): { status: "passed" | "failed"; results: XlsxCheckResult[] } {
  let book: ReturnType<typeof parseXlsx>;
  try {
    book = parseXlsx(bytes);
  } catch (err) {
    const message = err instanceof Error ? err.message : "파일을 읽지 못했습니다.";
    return {
      status: "failed",
      results: [{ id: "parse", passed: false, message }],
    };
  }

  const results = task.checks.map((check) => gradeCheck(check, book));
  const status = results.every((row) => row.passed) ? "passed" : "failed";
  return { status, results };
}
