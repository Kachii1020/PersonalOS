import test from "node:test";
import assert from "node:assert/strict";
import { AiProviderCreditsError, AiProviderUnavailableError, normalizeAnthropicError } from "../lib/ai/provider-errors";
import { httpErrorResult, PublicHttpError } from "../lib/http/public-error";

test("Anthropic low-credit responses become a safe public 402", () => {
  const provider = {
    status: 400,
    error: { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API. Please purchase credits." }, request_id: "req_private" },
    message: "400 raw provider response req_private",
  };
  const normalized = normalizeAnthropicError(provider);
  assert.ok(normalized instanceof AiProviderCreditsError);
  const result = httpErrorResult(normalized, { budget: "budget", unavailable: "unavailable" });
  assert.equal(result.status, 402);
  assert.match(result.message, /Anthropic 크레딧/);
  assert.doesNotMatch(result.message, /req_private|invalid_request_error|credit balance/i);
});

test("unrecognized provider responses never expose their body or request id", () => {
  const normalized = normalizeAnthropicError({ status: 400, message: "raw req_secret", error: { error: { message: "invalid model secret" } } });
  assert.ok(normalized instanceof AiProviderUnavailableError);
  const result = httpErrorResult(normalized, { budget: "budget", unavailable: "safe fallback" });
  assert.deepEqual(result, { status: 503, message: "safe fallback" });
});

test("only explicitly public request errors expose their message", () => {
  assert.deepEqual(httpErrorResult(new PublicHttpError("safe", 409), { budget: "budget", unavailable: "fallback" }), { status: 409, message: "safe" });
  const raw = Object.assign(new Error("provider body req_secret"), { status: 400 });
  assert.deepEqual(httpErrorResult(raw, { budget: "budget", unavailable: "fallback" }), { status: 503, message: "fallback" });
});
