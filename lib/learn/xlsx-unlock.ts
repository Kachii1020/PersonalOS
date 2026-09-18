import type { XlsxTask, XlsxUnlock } from "./types";

/**
 * 슬라이스 1: always만 연다. 나머지 언락은 이후 슬라이스에서 핵심 랩·팩을 본다.
 */
export function canSubmitXlsx(unlock: XlsxUnlock): boolean {
  return unlock === "always";
}

export function canSubmitTask(task: XlsxTask): boolean {
  return canSubmitXlsx(task.unlock);
}
