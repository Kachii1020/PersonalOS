import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const workerCode = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const layoutCode = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const bootstrap = /const swScript = `([\s\S]*?)`;/m.exec(layoutCode)![1];
const version = /const WORKER_VERSION = "([^"]+)"/.exec(workerCode)![1];
const deliveryId = "217d81fd-c2d7-44d4-a1bd-b565b3b7db27";
const observationToken = "b".repeat(64);

function worker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const observations: { path: string; body: string; credentials?: string }[] = [];
  const warnings: string[] = [];
  const notifications: unknown[] = [];
  const navigation: string[] = [];
  runInNewContext(workerCode, { URL, console: { warn: (message: string) => warnings.push(message) },
    self: { location: { origin: "https://example.test" }, addEventListener: (event: string, listener: (value: unknown) => void) => listeners.set(event, listener),
      skipWaiting: () => Promise.resolve(), registration: { showNotification: (...args: unknown[]) => { notifications.push(args); return Promise.resolve(); } },
      clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]), openWindow: (target: string) => { navigation.push(target); return Promise.resolve(); } } },
    caches: { keys: () => Promise.resolve([]), delete: () => Promise.resolve(true) },
    fetch: async (path: string, request: { body: string; credentials?: string }) => { observations.push({ path, body: request.body, credentials: request.credentials }); return { ok: false, status: 401 }; },
  });
  return { listeners, observations, notifications, navigation, warnings };
}

test("worker version handshake advertises capability without fabricating delivery events", () => {
  const f = worker(); let message: { type: string; version: string; workDeliveryCallbacks: boolean } | undefined;
  f.listeners.get("message")!({ data: { type: "PERSONAL_OS_SW_VERSION_REQUEST" }, ports: [{ postMessage: (value: typeof message) => { message = value; } }] });
  assert.equal(message?.version, version); assert.equal(message?.workDeliveryCallbacks, true);
  assert.equal(f.observations.length, 0); assert.equal(f.notifications.length, 0);
});

test("only actual push and notification click events attempt their respective callbacks", async () => {
  const f = worker(); let pending: Promise<unknown> = Promise.resolve();
  f.listeners.get("push")!({ data: { json: () => ({ title: "JARVIS", deliveryId, observationToken, url: "/jarvis?work=opaque" }) }, waitUntil: (promise: Promise<unknown>) => { pending = promise; } });
  await pending;
  assert.equal(f.notifications.length, 1); assert.equal(f.observations.length, 1);
  assert.equal(f.observations[0].path, `/api/jarvis/work-deliveries/${deliveryId}`);
  assert.deepEqual(JSON.parse(f.observations[0].body), { event: "received", token: observationToken });
  assert.equal(f.observations[0].credentials, "omit");
  f.listeners.get("notificationclick")!({ notification: { close() {}, data: { deliveryId, observationToken, url: "/jarvis?work=opaque" } }, waitUntil: (promise: Promise<unknown>) => { pending = promise; } });
  await pending;
  assert.deepEqual(JSON.parse(f.observations[1].body), { event: "opened", token: observationToken });
  assert.deepEqual(f.navigation, ["/jarvis?work=opaque"]);
  assert.equal(f.warnings.length, 2, "401 callbacks remain visibly unrecorded, never retried as fabricated success");
});

test("legacy pushes without a delivery ID do not invent tracking IDs", async () => {
  const f = worker(); let pending: Promise<unknown> = Promise.resolve();
  f.listeners.get("push")!({ data: { json: () => ({ title: "Legacy push" }) }, waitUntil: (promise: Promise<unknown>) => { pending = promise; } });
  await pending; assert.equal(f.observations.length, 0); assert.equal(f.notifications.length, 1);
  f.listeners.get("push")!({ data: { json: () => ({ title: "Old Phase7 push", deliveryId }) }, waitUntil: (promise: Promise<unknown>) => { pending = promise; } });
  await pending; assert.equal(f.observations.length, 0, "Old deliveries without a token cannot be reconstructed");
});

function page(replyVersion: string | null) {
  const windowListeners = new Map<string, () => void>(); const serviceListeners = new Map<string, () => void>(); const documentListeners = new Map<string, () => void>();
  const timers = new Map<number, () => void>(); const events: { detail: { status: string; version: string | null } }[] = [];
  let updates = 0; let registerOptions: unknown; let serial = 0;
  const worker = { postMessage(_request: unknown, ports: { reply: (value: unknown) => void }[]) { if (replyVersion) ports[0].reply({ type: "PERSONAL_OS_SW_VERSION", version: replyVersion, workDeliveryCallbacks: true }); } };
  const registration = { active: worker, update: async () => { updates++; }, addEventListener() {} };
  const scope = { personalOsServiceWorker: null as unknown, addEventListener: (name: string, callback: () => void) => windowListeners.set(name, callback), dispatchEvent: (event: typeof events[number]) => events.push(event) };
  runInNewContext(bootstrap, { window: scope, document: { visibilityState: "visible", addEventListener: (name: string, callback: () => void) => documentListeners.set(name, callback) },
    navigator: { serviceWorker: { controller: worker, register: async (_url: string, options: unknown) => { registerOptions = options; return registration; }, addEventListener: (name: string, callback: () => void) => serviceListeners.set(name, callback) } },
    MessageChannel: class { port1 = { onmessage: null as null | ((event: { data: unknown }) => void), close() {} }; port2 = { reply: (data: unknown) => this.port1.onmessage?.({ data }) }; },
    CustomEvent: class { detail: unknown; constructor(_type: string, options: { detail: unknown }) { this.detail = options.detail; } },
    setTimeout: (callback: () => void) => { timers.set(++serial, callback); return serial; }, clearTimeout: (id: number) => timers.delete(id), console: { warn() {} },
  });
  return { scope, events, windowListeners, serviceListeners, documentListeners, timers, updates: () => updates, registerOptions: () => registerOptions };
}

test("bootstrap bypasses update cache and requires matching worker handshake for readiness", async () => {
  const f = page(version); f.windowListeners.get("load")!(); await new Promise(setImmediate);
  assert.equal((f.registerOptions() as { updateViaCache: string }).updateViaCache, "none");
  assert.equal(f.updates(), 1); assert.equal(f.events.at(-1)?.detail.status, "ready");
  f.documentListeners.get("visibilitychange")!(); await new Promise(setImmediate); assert.equal(f.updates(), 2);
  f.serviceListeners.get("controllerchange")!(); assert.equal(f.events.at(-1)?.detail.status, "ready");
});

test("old or silent worker never reports callback readiness", async () => {
  const old = page("old-worker"); old.windowListeners.get("load")!(); await new Promise(setImmediate);
  assert.equal(old.events.at(-1)?.detail.status, "outdated");
  const silent = page(null); silent.windowListeners.get("load")!(); await new Promise(setImmediate);
  for (const callback of silent.timers.values()) callback();
  assert.equal(silent.events.at(-1)?.detail.status, "unconfirmed");
});

test("push settings reads and subscribes to readiness while distinguishing it from receipt", () => {
  const settings = readFileSync(new URL("../components/widgets/push-settings.tsx", import.meta.url), "utf8");
  assert.match(settings, /personalOsServiceWorker/);
  assert.match(settings, /addEventListener\("personalos:service-worker", refreshReadiness\)/);
  assert.match(settings, /removeEventListener\("personalos:service-worker", refreshReadiness\)/);
  assert.match(settings, /workerReadiness\.version === workerReadiness\.expectedVersion/);
  assert.match(settings, /현재 버전:/);
  assert.match(settings, /실제 알림 수신·열람이 확인됐다는 뜻은 아닙니다/);
  assert.doesNotMatch(bootstrap, /location\.reload|work-deliveries/);
});
