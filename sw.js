/*
  KAIXA Phone PWA Service Worker

  更新规则：
  - 在线时优先读取服务器上的最新代码、图片和音效。
  - 成功取得新版后自动覆盖离线缓存。
  - 断网时回退到最近一次成功缓存的版本。
  - 普通代码更新无需删除桌面 App 再重新添加。
*/

const CACHE_NAME = 'kaixa-phone-runtime-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  // 当前项目用 HEAD 探测音频扩展名，HEAD 请求保持原样走网络。
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.mode === 'navigate') {
          return (
            await caches.match('./index.html') ||
            await caches.match('./')
          );
        }

        return new Response('', {
          status: 504,
          statusText: 'Offline'
        });
      })
  );
});
