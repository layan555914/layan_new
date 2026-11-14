const CACHE_NAME = "asyut-aqar-shell-v162-verified-provider-maps-20261114";
const APP_SHELL = [
  "./",
  "./index.html",
  "./offers.html",
  "./property.html",
  "./property.css",
  "./property.js",
  "./admin.html",
  "./admin.js?v=20261114-service-profiles-1",
  "./admin-layout.js?v=20261114-service-profiles-1",
  "./admin-approval.js?v=20261114-service-profiles-1",
  "./admin-entry.js",
  "./companies.html",
  "./directory.html",
  "./directory-admin.html",
  "./directory-admin.js?v=20261114-service-profiles-1",
  "./directory.css",
  "./directory.js",
  "./directory-public.json",
  "./marketplace.html",
  "./favorites.html",
  "./favorites.js",
  "./marketplace.css",
  "./marketplace-page.css",
  "./marketplace.js?v=20261114-service-profiles-1",
  "./my-listings.html",
  "./my-listings.css",
  "./my-listings.js",
  "./reset-password.html",
  "./payment.html",
  "./company.html",
  "./companies.css",
  "./companies.js?v=20261114-service-profiles-1",
  "./company-profile.js?v=20261114-service-profiles-2",
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
  "./home-how.js",
  "./ai.js",
  "./assistant.js",
  "./mascot.js",
  "./camera.js",
  "./listing-form.js",
  "./tracking.js",
  "./app-shell.js",
  "./site-nav.js",
  "./advertiser-logos.js",
  "./admin-edits.js",
  "./advertiser.html",
  "./advertiser.js",
  "./assets/brand/mascot.webp",
  "./manifest.json",
  "./pwa.js",
  "./icon.svg",
  "./assets/build/home.min.css",
  "./assets/build/property.min.css",
  "./assets/build/base.min.css"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL.map(path => new Request(path, { cache: "reload" }))))
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

  // Code and styles: network first so the installed app always gets the latest version;
  // the cached copy is only used offline.
  if (/\.(css|js|json|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(request, { cache: "no-cache" }).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match(request, { ignoreSearch: true }))
    );
    return;
  }

  // Images and fonts: cache first.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      // Revalidate with the server so a stale HTTP-cache copy is never pinned in the shell cache.
      return fetch(request, { cache: "no-cache" }).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
