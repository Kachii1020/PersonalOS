import type { CreateTaskPayload, JsonValue } from "./types";

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: JsonValue | undefined, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("문자열 필드 형식이 올바르지 않습니다.");
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) throw new Error(`문자열은 ${maxLength}자를 넘을 수 없습니다.`);
  return trimmed;
}

function optionalNumber(value: JsonValue | undefined, min: number, max: number): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`숫자는 ${min} 이상 ${max} 이하여야 합니다.`);
  }
  return Math.round(value);
}

export function parseCreateTaskPayload(value: JsonValue): CreateTaskPayload {
  if (!isRecord(value)) throw new Error("CREATE_TASK payload는 객체여야 합니다.");

  const title = optionalString(value.title, 200);
  if (!title) throw new Error("할 일 제목이 필요합니다.");

  const dueAt = optionalString(value.dueAt, 80);
  if (dueAt && Number.isNaN(new Date(dueAt).getTime())) {
    throw new Error("dueAt이 유효한 날짜가 아닙니다.");
  }

  return {
    title,
    notes: optionalString(value.notes, 2000),
    dueAt,
    category: optionalString(value.category, 50),
    priority: optionalNumber(value.priority, 0, 100),
    estimatedMinutes: optionalNumber(value.estimatedMinutes, 1, 1440),
  };
}
