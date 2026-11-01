// Minimal service worker: makes the app installable and caches static assets.
// Only successful responses are cached: a 404/502 served while Render wakes up or
// switches deploys must never be kept, or the page stays blank until the cache is cleared.
const CACHE = "nmd-v2";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/icons/icon-192.png", "/icons/icon-512.png"])));
  self.skipWaiting();
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || !url.pathname.startsWith("/_next/static")) return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    })),
  );
});
