export type MaterialSummaryPayload = {
  summary: string;
  keywords: string[];
};

export const MATERIAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "keywords"],
  properties: {
    summary: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
  },
} as const;

export const MATERIAL_SYSTEM = `당신은 대학 강의자료를 정리해 주는 조교다.

규칙:
- 출력 언어는 한국어다. 전문 용어는 원어를 괄호 없이 그대로 쓴다 (WACC, backpropagation 등).
- summary는 마크다운 없이 3~5문단으로 쓴다. 강의가 무엇을 주장하는지, 어떤 순서로 전개하는지가 드러나야 한다.
- 자료에 없는 내용을 채워 넣지 마라. 슬라이드가 목차만 있고 내용이 없으면 그렇다고 쓴다.
- 수식이 나오면 기호가 무엇을 뜻하는지 한 줄로 풀어 쓴다.
- keywords는 시험에 나올 만한 핵심어 5~10개다. 일반명사("개요", "정리")는 넣지 않는다.`;

/**
 * 자료 전체를 넣지 않고 앞부분만 넣는다.
 *
 * 강의 슬라이드 한 개가 5만 자를 넘는 경우가 있다. 자료 하나 요약에 그만큼을 매번 태우면
 * 월 예산이 몇 번의 클릭으로 사라진다. 앞부분이 목차·본론을 담고 있어 요약 품질에 큰 손해가 없다.
 */
export const MAX_CHARS = 24_000;

export function buildMaterialPrompt(filename: string, text: string): string {
  const clipped = text.length > MAX_CHARS;
  const body = clipped ? text.slice(0, MAX_CHARS) : text;

  return `파일명: ${filename}
${clipped ? `\n(자료가 길어 앞부분 ${MAX_CHARS.toLocaleString()}자만 실었다. 뒷부분은 없는 셈 치고 요약해라.)\n` : ""}
--- 자료 본문 ---
${body}`;
}
