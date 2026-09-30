// === Service Worker для Календаря Репетитора ===
// Версия кеша — увеличивай при обновлении, чтобы браузер подтянул новую версию
const CACHE_NAME = 'tutor-calendar-v1.0.2';

// Файлы для кеширования при первой загрузке
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// === Установка: кешируем основные файлы ===
self.addEventListener('install', (event) => {
  console.log('[SW] Установка...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Кеширую основные файлы');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting()) // Активируем сразу, не ждём закрытия вкладок
  );
});

// === Активация: чистим старые кеши ===
self.addEventListener('activate', (event) => {
  console.log('[SW] Активация...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Удаляю старый кеш:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim()) // Берём контроль над всеми вкладками сразу
  );
});

// === Стратегия fetch: Cache First, потом сеть ===
// Сначала пробуем отдать из кеша, если нет — идём в сеть и кешируем
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Пропускаем запросы не-GET (например, POST)
  if (request.method !== 'GET') return;
  
  // Пропускаем запросы к внешним доменам (не наши файлы)
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Есть в кеше — отдаём и параллельно обновляем в фоне
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);
        
        return cachedResponse;
      }
      
      // Нет в кеше — идём в сеть
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        return networkResponse;
      }).catch(() => {
        // Если сеть недоступна и файла нет в кеше — показываем главную
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Офлайн-режим', { status: 503 });
      });
    })
  );
});

// === Обработка сообщений от главной страницы (например, для обновления) ===
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
