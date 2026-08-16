// 离线缓存（对照 docs/技术方案.md 第 6 节）
// 策略：网络优先、失败回退缓存——保证在线时总能拿到最新版本，离线时仍可打开
// 仅在 HTTPS（正式部署后）生效；本地 file:// 打开时浏览器不会注册
const CACHE = 'zhongtai-v2';
const ASSETS = [
  './', './index.html', './css/style.css',
  './js/data.js', './js/store.js', './js/rates.js', './js/app.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
