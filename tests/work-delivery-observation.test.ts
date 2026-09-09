import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleWorkDeliveryObservation, parseWorkDeliveryObservation } from "../lib/jarvis/work-delivery-observation";

const id = "217d81fd-c2d7-44d4-a1bd-b565b3b7db27";
const token = "c".repeat(64);
const request = (body: unknown, headers: Record<string, string> = {}) => new Request(`https://example.test/api/jarvis/work-deliveries/${id}`, { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

test("observation accepts only UUID, 256-bit capability and the two exact event fields", () => {
  assert.deepEqual(parseWorkDeliveryObservation(id, { token, event: "opened" }), { deliveryId: id, token, event: "opened" });
  for (const body of [null, [], { token, event: "approved" }, { token: "a".repeat(63), event: "received" }, { token: "A".repeat(64), event: "received" }, { token, event: "received", ownerId: "other" }, { token, event: "received", receivedAt: "yesterday" }, { event: "received" }]) assert.equal(parseWorkDeliveryObservation(id, body), null);
  assert.equal(parseWorkDeliveryObservation("not-a-uuid", { token, event: "received" }), null);
});

test("valid same-origin observation reaches capability verifier with no browser session", async () => {
  let called = 0;
  const response = await handleWorkDeliveryObservation(request({ token, event: "received" }), id, async (input) => { called++; assert.equal(input.deliveryId, id); assert.equal(input.token, token); return true; });
  assert.equal(response.status, 200); assert.equal(called, 1); assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("origin body and size guards run before any service-level database call", async () => {
  let calls = 0; const verify = async () => { calls++; return true; };
  for (const req of [request({ token, event: "received" }, { origin: "https://other.test" }), request({ token, event: "received" }, { "sec-fetch-site": "cross-site" }), request({ token, event: "received" }, { "content-type": "text/plain" }), request({ token, event: "received", extra: true }), request({ token: "x".repeat(2048), event: "received" })]) assert.notEqual((await handleWorkDeliveryObservation(req, id, verify)).status, 200);
  assert.notEqual((await handleWorkDeliveryObservation(request({ token, event: "received" }), "bad-id", verify)).status, 200);
  assert.equal(calls, 0);
});

test("invalid capability and unknown delivery get the same generic non-enumerating response", async () => {
  const wrongToken = await handleWorkDeliveryObservation(request({ token, event: "received" }), id, async () => false);
  const unknownId = await handleWorkDeliveryObservation(request({ token, event: "received" }), "857b1ea4-e592-4d11-8b1e-c0546b607188", async () => false);
  assert.equal(wrongToken.status, 401); assert.equal(unknownId.status, 401);
  assert.deepEqual(await wrongToken.json(), await unknownId.json());
});

test("SQL observation capability is service-only and preserves existing owner acknowledgment", () => {
  const migration = readFileSync(new URL("../supabase/migrations/0026_work_delivery_observation_tokens.sql", import.meta.url), "utf8");
  assert.match(migration, /begin_user_work_delivery\(p_attention_id,p_worker_id,p_subscription_id\)/);
  assert.match(migration, /is_measurement/);
  assert.match(migration, /gen_random_bytes\(32\)/);
  assert.match(migration, /observation_token_hash=encode\(sha256/);
  assert.match(migration, /provider_state in \('attempted','accepted','uncertain'\)/);
  assert.match(migration, /observation_expires_at>observed/);
  assert.match(migration, /from public,anon,authenticated/);
  assert.doesNotMatch(migration, /create (?:or replace )?function public\.ack_work_delivery/);
  const route = readFileSync(new URL("../app/api/jarvis/work-deliveries/[id]/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /workHttp|requireWorkOwner/);
});
