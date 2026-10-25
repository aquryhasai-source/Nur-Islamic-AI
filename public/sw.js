// NUR Islamic AI — service worker
// Combines: PWA offline caching (restored from the pre-OneSignal version)
// + self-hosted push notifications (VAPID/web-push, no vendor SDK).

const CACHE_NAME = "nur-v2"; // bumped: old caches (incl. any cached non-OK/cross-origin entries) are purged on activate
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// Install — cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle same-origin GETs. Never touch (or cache) API calls, other sites, or non-GET requests.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache only successful, same-origin ("basic") responses so errors are never served offline.
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

// Push — self-hosted via web-push (VAPID). No vendor SDK involved.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "NŪR Islamic AI", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "NŪR Islamic AI";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only ever open pages inside this app, whatever the push payload says.
  let url = "/";
  try {
    const raw = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
    const u = new URL(raw, self.location.origin);
    if (u.origin === self.location.origin) url = u.pathname + u.search + u.hash;
  } catch (e) { /* keep "/" */ }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).pathname + new URL(client.url).search + new URL(client.url).hash === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
