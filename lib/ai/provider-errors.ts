import { PublicHttpError } from "@/lib/http/public-error";

export class AiProviderCreditsError extends PublicHttpError {
  constructor() {
    super(
      "Anthropic 크레딧이 부족해 모델 기반 업무 처리를 계속할 수 없습니다. 크레딧을 충전한 뒤 같은 요청을 다시 보내 주세요.",
      402,
      "AiProviderCreditsError",
    );
  }
}

export class AiProviderUnavailableError extends Error {
  constructor() {
    super("AI 공급자 요청을 처리하지 못했습니다.");
    this.name = "AiProviderUnavailableError";
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function providerMessage(error: unknown): string {
  const outer = record(error);
  const payload = record(outer?.error);
  const nested = record(payload?.error);
  const value = nested?.message ?? payload?.message;
  return typeof value === "string" ? value : "";
}

export function normalizeAnthropicError(error: unknown): Error {
  const outer = record(error);
  const status = typeof outer?.status === "number" ? outer.status : null;
  const message = providerMessage(error);
  if (
    status !== null && [400, 402, 403].includes(status)
    && /credit balance is too low|purchase credits|insufficient credits/i.test(message)
  ) return new AiProviderCreditsError();
  return new AiProviderUnavailableError();
}
