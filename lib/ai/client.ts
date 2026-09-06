import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { assertWithinBudget } from "./budget";
import { recordUsage, type AiPurpose } from "@/lib/repos/ai-usage";

/**
 * Anthropic API 호출의 유일한 통로 (SPEC.md 5.5).
 *
 * 이 파일 밖에서 @anthropic-ai/sdk를 import하면 리뷰에서 반려된다.
 * 여기를 지나야 예산 검사와 사용량 기록이 빠지지 않는다.
 */

/** 1M 토큰당 달러. platform.claude.com 2026-08-03 기준. */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/**
 * 2026-08-03 승인: 브리핑은 sonnet-5로 돈다.
 * 같은 입력으로 opus-5(medium)와 비교했을 때 출력 품질 차이는 없었고 비용은 45%였다.
 * 월 30회 기준 $3.65로, SPEC 5.5의 나머지 호출 지점 2곳 몫이 남는다.
 * `AI_MODEL`로 호출 지점별 재정의 가능.
 */
const DEFAULT_MODEL = "claude-sonnet-5";

/** 서버측 거절 폴백(`fallbacks`)을 받아주는 모델. 나머지에 보내면 400이다. */
const FALLBACK_CAPABLE = new Set(["claude-opus-5", "claude-fable-5"]);

export class AiRefusalError extends Error {
  constructor(readonly category: string | null) {
    super(`모델이 요청을 거절했습니다 (분류: ${category ?? "미상"})`);
    this.name = "AiRefusalError";
  }
}

export class AiParseError extends Error {
  constructor(
    message: string,
    readonly raw: string,
  ) {
    super(message);
    this.name = "AiParseError";
  }
}

export type CallResult<T> = {
  data: T;
  model: string;
  inputToken: number;
  outputToken: number;
  costUsd: number;
  attempts: number;
};

export type StructuredCallOptions = {
  purpose: AiPurpose;
  system: string;
  userMessage: string;
  /** JSON Schema. additionalProperties: false와 required가 있어야 한다. */
  schema: Record<string, unknown>;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** 파싱 실패 시 재시도 횟수. SPEC.md 5.5는 1회만 허용한다. */
  retries?: number;
  /** Bounded worker calls disable SDK transport retries within this timeout. */
  timeoutMs?: number;
};

function model(): string {
  return process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
}

function costUsd(modelId: string, usage: Anthropic.Beta.BetaUsage): number {
  const price = PRICING[modelId];
  if (!price) throw new Error(`모델 ${modelId}의 단가가 PRICING에 없습니다`);

  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;

  return (
    (input * price.input +
      output * price.output +
      // 캐시 읽기는 입력가의 0.1배, 5분 캐시 쓰기는 1.25배.
      cacheRead * price.input * 0.1 +
      cacheWrite * price.input * 1.25) /
    1_000_000
  );
}

/**
 * 구조화된 JSON을 받는 단일 호출.
 *
 * 순서가 중요하다: 예산 검사 → 호출 → 사용량 기록. 기록 전에 예외가 나면
 * 그 호출은 집계되지 않으므로, 파싱 실패로 재시도할 때도 각 호출을 따로 기록한다.
 */
export async function callStructured<T>(options: StructuredCallOptions): Promise<CallResult<T>> {
  const modelId = model();
  const maxAttempts = 1 + (options.retries ?? 0);

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await assertWithinBudget();

    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: modelId,
      max_tokens: options.maxTokens ?? 16000,
      // 안전 분류기가 거절하면 Anthropic이 권장 대체 모델로 재실행한다.
      // Opus 5 계열만 지원한다 — 다른 모델에 붙이면 400이다.
      ...(FALLBACK_CAPABLE.has(modelId)
        ? { betas: ["server-side-fallback-2026-07-01"] as const, fallbacks: "default" as const }
        : {}),
      system: options.system,
      output_config: {
        effort: options.effort ?? "medium",
        format: { type: "json_schema", schema: options.schema },
      },
      messages: [{ role: "user", content: options.userMessage }],
    }, options.timeoutMs === undefined ? undefined : { timeout: options.timeoutMs, maxRetries: 0 });

    const spent = costUsd(response.model, response.usage);
    await recordUsage({
      purpose: options.purpose,
      model: response.model,
      inputToken: response.usage.input_tokens ?? 0,
      outputToken: response.usage.output_tokens ?? 0,
      costUsd: spent,
    });

    if (response.stop_reason === "refusal") {
      throw new AiRefusalError(response.stop_details?.category ?? null);
    }
    if (response.stop_reason === "max_tokens") {
      lastError = new AiParseError("max_tokens에서 잘렸습니다", "");
      continue;
    }

    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    try {
      return {
        data: JSON.parse(text) as T,
        model: response.model,
        inputToken: response.usage.input_tokens ?? 0,
        outputToken: response.usage.output_tokens ?? 0,
        costUsd: spent,
        attempts: attempt,
      };
    } catch {
      lastError = new AiParseError("응답이 JSON이 아닙니다", text.slice(0, 400));
    }
  }

  throw lastError ?? new AiParseError("알 수 없는 파싱 실패", "");
}
