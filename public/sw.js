/*
 * 최소 서비스 워커.
 *
 * 해시가 붙은 정적 자산만 캐시-우선으로 처리한다.
 * HTML과 API 응답은 캐시하지 않는다 — 캘린더·브리핑 미러가 오래된 값을 보여주면
 * 동기화 상태를 신뢰할 수 없게 된다.
 */

const CACHE = "personal-os-static-v1";
const STATIC = /\.(?:woff2?|css|js|svg|png|ico)$/;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!STATIC.test(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request);
      if (hit) return hit;

      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    }),
  );
});
