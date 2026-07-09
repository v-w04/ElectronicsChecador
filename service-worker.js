// ============================================================================
// SERVICE WORKER — Checador Electronics México
// ============================================================================
// Estrategia:
//   - App shell (HTML/CSS/JS/íconos) cacheada al instalar → arranque offline
//   - Cache-first para assets del repo → velocidad
//   - Network-only para llamadas a GAS (script.google.com) → datos frescos
//   - Auto-update: cuando sube nueva versión, los dispositivos la reciben al reabrir
// ============================================================================

const CACHE_VERSION = 'em-checador-v610';
const CACHE_NAME    = CACHE_VERSION;

const APP_SHELL = [
  './',
  './index.html',
  './Styles.css',
  './WebApp.js',
  './api.js',
  './Avatares.js',
  './ChecadorChoferes.js',
  './OfflineQueue.js',
  './Perfil.js',
  './Dashboard.js',
  './Filtros.js',
  './Girly.js',
  './Inyectar.js',
  './KPIGauges.js',
  './Mapa.js',
  './Module.js',
  './Productividad.js',
  './RenderModule.js',
  './Sidebar.js',
  './Tablas.js',
  './TooltipsGauges.js',
  './logo-electronics.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  console.log('[SW] Instalando ' + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => 
      Promise.all(
        APP_SHELL.map(url =>
          cache.add(url).catch(err => console.warn('[SW] No se pudo cachear ' + url + ': ' + err.message))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activando ' + CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Borrando cache viejo: ' + k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // ⭐ NAVEGACIONES (cuando se abre la PWA): SIEMPRE intentar cache primero
  // si la red falla. Esto garantiza que la app abra sin internet aunque sea
  // la primera vez del día.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(fresh => {
          // Si la red funciona, actualizar cache en background
          if (fresh && fresh.ok) {
            const clone = fresh.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return fresh;
        })
        .catch(() => {
          // Red falla → servir index.html del cache
          return caches.match('./index.html').then(c => c || caches.match('./'));
        })
    );
    return;
  }

  // No cachear llamadas a GAS y CDNs externos
  if (
    url.host.includes('script.google.com') ||
    url.host.includes('googleapis.com') ||
    url.host.includes('googleusercontent.com') ||
    url.host.includes('nominatim.openstreetmap.org') ||
    url.host.includes('cdnjs.cloudflare.com') ||
    url.host.includes('cdn.jsdelivr.net') ||
    url.host.includes('imgur.com') ||
    url.host.includes('i.imgur.com')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Stale-while-revalidate: devuelve cache, actualiza en background
        fetch(event.request).then(fresh => {
          if (fresh && fresh.ok) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, fresh));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(event.request).then(fresh => {
        if (fresh && fresh.ok && fresh.type === 'basic') {
          const clone = fresh.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return fresh;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});