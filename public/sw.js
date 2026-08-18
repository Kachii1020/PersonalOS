/*
 * 정적 자산은 캐시-우선.
 * 내비게이션 HTML은 network-first — 온라인이면 캐시가 응답하지 않는다 (SPEC.md 5.7).
 */

const STATIC_CACHE = "personal-os-static-v2";
const PAGE_CACHE = "personal-os-pages-v1";
const STATIC = /\.(?:woff2?|css|js|svg|png|ico)$/;
const IMMUTABLE_PREFIX = "/_next/static/";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC_CACHE, PAGE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (!url.pathname.startsWith(IMMUTABLE_PREFIX)) return;
  if (!STATIC.test(url.pathname)) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    }),
  );
});

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const hit = (await cache.match(request)) ?? (await cache.match("/"));
    if (hit) return hit;
    throw new Error("offline and no cached page");
  }
}

self.addEventListener("push", (event) => {
  let data = { title: "Personal OS", body: "", url: "/" };
  try {
    data = { ...data, ...(event.data ? event.data.json() : {}) };
  } catch {
    const text = event.data ? event.data.text() : "";
    if (text) data.body = text;
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          client.navigate?.(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
