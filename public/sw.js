// Service Worker : Jendela Ragil Aluminium
// Strategi: navigasi fresh network-first, rute admin dikecualikan dari cache sw.
const CACHE = "ragil-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Jangan pernah cache rute admin atau login agar perubahan panel langsung aktif
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/login")) {
    return;
  }

  // Aset build: ambil jaringan segar lebih dulu, fallback ke cache jika offline
  if (url.pathname.startsWith("/build/") || url.pathname.startsWith("/images/")) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          // Hanya simpan respons sukses. Respons 404/403/500 yang ikut
          // tersimpan akan disajikan seolah valid saat jaringan bermasalah.
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return resp;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Navigasi etalase publik
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          // Hanya simpan respons sukses. Respons 404/403/500 yang ikut
          // tersimpan akan disajikan seolah valid saat jaringan bermasalah.
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return resp;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
  }
});
