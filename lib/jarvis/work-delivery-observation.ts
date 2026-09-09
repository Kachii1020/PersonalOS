export type WorkDeliveryObservation = { deliveryId: string; token: string; event: "received" | "opened" };
export function parseWorkDeliveryObservation(deliveryId: string, body: unknown): WorkDeliveryObservation | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deliveryId) || !body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = body as Record<string, unknown>;
  if (Reflect.ownKeys(value).length !== 2 || !Object.prototype.hasOwnProperty.call(value, "event") || !Object.prototype.hasOwnProperty.call(value, "token") || typeof value.token !== "string" || !/^[0-9a-f]{64}$/.test(value.token) || (value.event !== "received" && value.event !== "opened")) return null;
  return { deliveryId: deliveryId.toLowerCase(), token: value.token, event: value.event };
}

/** No cookie/session dependency. The validated single-delivery capability is
 * checked by the service-only RPC; no caller can select another mutation. */
export async function handleWorkDeliveryObservation(request: Request, deliveryId: string, acknowledge: (input: WorkDeliveryObservation) => Promise<boolean>): Promise<Response> {
  const reply = (status: number, ok = false) => Response.json(ok ? { ok: true } : { error: "기기 관측을 기록하지 못했습니다." }, { status, headers: { "Cache-Control": "no-store" } });
  const site = request.headers.get("sec-fetch-site");
  if (request.method !== "POST" || request.headers.get("origin") !== new URL(request.url).origin || (site !== null && site !== "same-origin")) return reply(403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return reply(400);
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > 1024)) return reply(413);
  const reader = request.body?.getReader();
  if (!reader) return reply(400);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const read = async () => {
      const chunks: Uint8Array[] = []; let size = 0;
      for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 1024) return null; chunks.push(value); }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    };
    const text = await Promise.race([read(), new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 5000); })]);
    if (text === null) { await reader.cancel(); return reply(413); }
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return reply(400); }
    const input = parseWorkDeliveryObservation(deliveryId, parsed);
    if (!input) return reply(400);
    try { return await acknowledge(input) ? reply(200, true) : reply(401); }
    catch { console.warn("[work-observation] Observation storage unavailable; receipt is not confirmed."); return reply(503); }
  } catch { return reply(400); }
  finally { if (timer) clearTimeout(timer); reader.releaseLock(); }
}
