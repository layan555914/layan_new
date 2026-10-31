const CACHE_NAME = "layan-aqar-shell-v57";
const APP_SHELL = [
  "./",
  "./index.html",
  "./companies.html",
  "./company.html",
  "./companies.css",
  "./companies.js",
  "./company-profile.js",
  "./styles.css",
  "./buyer.css",
  "./sponsor.css",
  "./ai.css",
  "./config.js",
  "./gubabase.js",
  "./app.js",
  "./buyer.js",
  "./sponsor.js",
  "./ai.js",
  "./manifest.json",
  "./pwa.js",
  "./icon.svg",
  "./file_000000004bbc821184c084bfa178e416.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("layan-aqar-shell-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
