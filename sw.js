const CACHE_NAME = "asyut-aqar-shell-v97-background-push-map-20261102";
const APP_SHELL = [
  "./",
  "./index.html",
  "./admin.html",
  "./admin.js",
  "./admin-entry.js",
  "./companies.html",
  "./marketplace.html",
  "./favorites.html",
  "./favorites.js",
  "./marketplace.css",
  "./marketplace-page.css",
  "./marketplace.js",
  "./my-listings.html",
  "./my-listings.css",
  "./my-listings.js",
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
  "./map.js",
  "./buyer.js",
  "./sponsor.js",
  "./ai.js",
  "./manifest.json",
  "./pwa.js",
  "./icon.svg"
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
      .then(keys => Promise.all(keys.filter(key => (key.startsWith("layan-aqar-shell-") || key.startsWith("asyut-aqar-shell-")) && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});


self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; } catch (_) {}
    const title = String(payload.title || "أسيوط عقار");
    const options = {
      body: String(payload.body || "ظهر عرض عقاري جديد يناسب طلبك."),
      icon: String(payload.icon || "./icon.svg"),
      badge: "./icon.svg",
      tag: String(payload.tag || "asyut-aqar-buyer-alert"),
      data: { url: String(payload.url || "./") },
      renotify: false,
      dir: "rtl",
      lang: "ar",
    };
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.navigate(target.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(target.href);
  })());
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
