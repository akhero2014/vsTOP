/* sw.js — オフラインでも使えるようにするためのService Worker。
   アプリは完全にブラウザ内で完結するため、初回読み込み時にファイル一式を
   キャッシュし、以降はオフラインでもそのまま起動できるようにする。

   アプリの中身（index.html や js/ 以下）を更新したときは、
   CACHE_NAME のバージョン番号を必ず上げてください。
   そうしないと、古いキャッシュが使われ続けて更新が反映されません。 */

const CACHE_NAME = 'vstop-cache-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './js/state.js',
  './js/game-logic.js',
  './js/team-management.js',
  './js/stats.js',
  './js/csv-export.js',
  './js/render-common.js',
  './js/render-home.js',
  './js/render-lineup.js',
  './js/render-match.js',
  './js/render-sheets.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// キャッシュ優先。キャッシュに無ければネットワークから取得し、取得できたものは
// 次回のためにキャッシュへ保存しておく（同一オリジンのGETリクエストのみ対象）。
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
