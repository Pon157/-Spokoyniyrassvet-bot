// service-worker.js - Push Notifications Service Worker
const CACHE_NAME = 'spokoyny-rassvet-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/common.css',
  '/css/auth.css',
  '/css/settings.css',
  '/js/auth.js',
  '/js/settings.js'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('🛠️ Service Worker установлен');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker активирован');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Обработка fetch запросов
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Возвращаем кэшированную версию или делаем запрос
        return response || fetch(event.request);
      }
    )
  );
});

// Обработка push уведомлений
self.addEventListener('push', (event) => {
  console.log('📨 Получено push уведомление', event);
  
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Новое уведомление',
    icon: data.icon || '/images/logo.png',
    badge: '/images/badge.png',
    image: data.image,
    tag: data.tag || 'general',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Спокойный рассвет', options)
  );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Клик по уведомлению', event);
  
  event.notification.close();

  const urlToOpen = new URL('/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // Проверяем есть ли уже открытая вкладка
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Открываем новую вкладку если нет открытой
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Обработка закрытия уведомлений
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Уведомление закрыто', event);
});

// Фоновая синхронизация
self.addEventListener('sync', (event) => {
  console.log('🔄 Фоновая синхронизация:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Фоновая синхронизация данных
  try {
    const registration = await self.registration;
    console.log('✅ Фоновая синхронизация выполнена');
  } catch (error) {
    console.error('❌ Ошибка фоновой синхронизации:', error);
  }
}

// Периодическая фоновая синхронизация
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-update') {
    console.log('🔄 Периодическая синхронизация контента');
    event.waitUntil(updateContent());
  }
});

async function updateContent() {
  // Обновление кэшированного контента
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = urlsToCache.map(url => new Request(url));
    
    await Promise.all(
      requests.map(request => 
        fetch(request).then(response => {
          if (response.status === 200) {
            cache.put(request, response);
          }
        })
      )
    );
    
    console.log('✅ Контент обновлен');
  } catch (error) {
    console.error('❌ Ошибка обновления контента:', error);
  }
}
