/* eslint-disable no-restricted-globals */
self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [100, 50, 100],
      data: { url: "/" },
    };
    event.waitUntil(self.registration.showNotification(data.title || "ArmatuProde", options));
  } catch {
    // Invalid JSON
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});
