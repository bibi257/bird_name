/* Service Worker: HTML/CSS/JS/JSON/画像/音声をキャッシュして圏外でも動かす。
   VERSION は GitHub Actions (.github/workflows/deploy.yml) が push のたびに
   コミットSHAで自動的に書き換えてデプロイする。手動でVERSIONを上げる必要はない。 */
const VERSION = "__BUILD_VERSION__";
const CACHE = "birdref-" + VERSION;
const CORE = [
  "./", "./index.html", "./style.css", "./app.js",
  "./birds.json", "./manifest.json",
  "./icons/icon-192.png", "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    // birds.json に載っている画像・音声も事前キャッシュ(無いものは無視して続行)
    try {
      const birds = await (await c.match("./birds.json")).json();
      const extra = new Set();
      birds.forEach((b) => {
        if (b.image) extra.add(b.image);
        if (b.audio) extra.add(b.audio);
      });
      await Promise.all([...extra].map((u) => c.add(u).catch(() => {})));
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

// キャッシュ優先。無ければ取りに行き、取れたらキャッシュに追加。
// api.github.com への同期通信はキャッシュしない(常に最新を取りに行く)。
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("api.github.com")) return;
  e.respondWith((async () => {
    const cached = await caches.match(e.request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(e.request);
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        (await caches.open(CACHE)).put(e.request, res.clone());
      }
      return res;
    } catch (err) {
      if (e.request.mode === "navigate") return caches.match("./index.html");
      throw err;
    }
  })());
});
