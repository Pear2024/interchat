const CACHE_NAME = "interchat-cache-v2";
const OFFLINE_URLS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offlineMatch = await caches.match("/");
        return offlineMatch || Response.error();
      })
    );
    return;
  }

  if (!request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          if (!response || !response.ok || response.type === "opaqueredirect") {
            return response;
          }

          const responseClone = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            })
          );
          return response;
        })
        .catch(async () => {
          const offlineMatch = await caches.match("/");
          return offlineMatch || Response.error();
        });
    })
  );
});
