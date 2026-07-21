/*
  KAIXA Phone PWA Service Worker

  策略：
  - 页面导航：网络优先，保证代码可以更新。
  - 图片、音频、图标：缓存优先，立即使用本地资源；
    同时在后台更新缓存。
  - 其他同源静态资源：缓存优先并后台更新。
*/

const CACHE_NAME = 'kaixa-phone-runtime-v9';

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

function isStaticAsset(request, url){
  if(
    request.destination === 'audio' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ){
    return true;
  }

  return /\.(m4a|mp3|wav|mp4|jpg|jpeg|png|webp|gif|svg|ico)$/i
    .test(url.pathname);
}

async function networkFirst(request){
  try{
    const response = await fetch(request);

    if(response && response.ok){
      const copy = response.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, copy);
    }

    return response;
  }catch{
    const cached = await caches.match(request);

    if(cached) return cached;

    if(request.mode === 'navigate'){
      return (
        await caches.match('./index.html') ||
        await caches.match('./')
      );
    }

    return new Response('', {
      status: 504,
      statusText: 'Offline'
    });
  }
}

async function staleWhileRevalidate(request){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async response => {
      if(response && response.ok){
        await cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  if(cached){
    /*
     * 立刻使用本地缓存。
     * 网络结果只负责更新下一次使用的版本。
     */
    return cached;
  }

  const networkResponse = await networkPromise;

  if(networkResponse){
    return networkResponse;
  }

  return new Response('', {
    status: 504,
    statusText: 'Offline'
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;

  if(request.method !== 'GET') return;

  const url = new URL(request.url);

  if(url.origin !== self.location.origin) return;

  if(request.mode === 'navigate'){
    event.respondWith(networkFirst(request));
    return;
  }

  if(isStaticAsset(request, url)){
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
