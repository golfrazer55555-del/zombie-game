/* 오프라인 실행용 서비스 워커: 게임 파일을 저장해 두고 인터넷 없이도 실행한다. */
const CACHE = 'zsurv-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './css/style.css',
  './fonts/galmuri11-sub.woff2', './fonts/galmuri11-bold-sub.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './js/util.js', './js/data.js', './js/sprites.js', './js/icons.js', './js/tiles.js', './js/world.js',
  './js/audio.js', './js/game.js', './js/render.js', './js/input.js', './js/ui.js', './js/main.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
// 인터넷이 되면 최신 파일, 안 되면 저장해 둔 파일
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
