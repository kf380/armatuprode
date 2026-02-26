/* eslint-disable no-restricted-globals */
var CACHE_NAME = "armatuprode-v4";
var STATIC_ASSETS = [
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
];

// Install: cache only icons/manifest, skip waiting immediately
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: delete ALL old caches
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: always network-first for pages and JS/CSS
self.addEventListener("fetch", function (event) {
  // Skip non-GET
  if (event.request.method !== "GET") return;

  var url = new URL(event.request.url);

  // Skip API requests entirely
  if (url.pathname.startsWith("/api/")) return;

  // For navigation and app assets: ALWAYS network first
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        // Cache successful responses for offline fallback
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(function () {
        // Offline: try cache
        return caches.match(event.request).then(function (cached) {
          return cached || (event.request.mode === "navigate" ? caches.match("/") : undefined);
        });
      })
  );
});

// Push notifications
self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    var data = event.data.json();
    var options = {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [100, 50, 100],
      data: { url: "/" },
    };
    event.waitUntil(self.registration.showNotification(data.title || "ArmatuProde", options));
  } catch (e) {
    // Invalid JSON
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});
