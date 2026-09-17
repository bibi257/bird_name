/* Service Worker: HTML/CSS/JS/JSON/画像をキャッシュして圏外でも動かす
   データや画像を更新したら VERSION を上げる（古いキャッシュが消える） */
const VERSION = "v1";
const CACHE = "birdref-" + VERSION;
const CORE = ["./", "./index.html", "./style.css", "./app.js", "./birds.json", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    // birds.json に載っている画像も事前キャッシュ（無いものは無視）
    try {
      const birds = await (await c.match("./birds.json")).json();
      const imgs = [...new Set(birds.map((b) => b.image).filter(Boolean))];
      await Promise.all(imgs.map((u) => c.add(u).catch(() => {})));
    } catch (_) {}
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("birdref-") && k !== CACHE).map((k) => caches.delete(k)));
    self.clients.claim();
  })());
});

// キャッシュ優先。無ければ取りに行き、取れたらキャッシュに追加
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith((async () => {
    const cached = await caches.match(e.request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(e.request);
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        (await caches.open(CACHE)).put(e.request, res.clone());
      }
      return res;
    } catch (_) {
      if (e.request.mode === "navigate") return caches.match("./index.html");
      throw _;
    }
  })());
});
