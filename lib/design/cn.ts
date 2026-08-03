/** 조건부 className을 합친다. 라이브러리를 하나 더 들이지 않기 위한 최소 구현. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
