// 캐싱은 하지 않습니다 (곡 목록이 항상 최신으로 보이도록). PWA 설치 조건을 만족시키기 위한 최소 서비스 워커입니다.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {});
