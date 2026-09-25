// ============================================================================
// SERVICE WORKER — Checador Electronics México · v700
// ============================================================================
// Objetivo de esta versión: que la app ABRA Y SIRVA SIN INTERNET.
//
//   1. Al instalarse guarda las pantallas nuevas (checar, tablero, juegos) y
//      los íconos. Son archivos chicos: se guardan completos y de inmediato.
//   2. Las navegaciones se sirven del caché PRIMERO (la app abre al instante,
//      con o sin señal) y en segundo plano se refresca la copia guardada.
//   3. El respaldo es por página: si se abre tablero.html sin señal contesta
//      tablero.html, no index.html. Ese era el 404.
//   4. Las llamadas al servidor (Apps Script) nunca se cachean.
//   5. Background Sync: si el celular se queda sin señal con checadas
//      pendientes, el navegador despierta este archivo cuando vuelve la red
//      y las manda solo, aunque la app esté cerrada.
// ============================================================================

var CACHE_NAME = 'em-checador-v749';

var GAS_URL = 'https://script.google.com/macros/s/AKfycbxWu65gJ3jIbRp9WIbvNjia9IFsDJORUggDNyYUUQA_JxLYsbYjsawynN9hbV1kPqU5/exec';

// Lo indispensable para que la app funcione sin señal. Chico a propósito.
var NUCLEO = [
  './',
  './checar.html',
  './avatar.js',
  './actualizar.js',
  './ui.js',
  './juegos.html',
  './manifest.webmanifest',
  './favicon.ico',
  './favicon-32.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './logo-electronics.png'
];

// El panel viejo y el tablero de checadas, que ya salió de la navegación.
// Se intentan guardar, pero si fallan no se cae la instalación.
var EXTRAS = [
  './index.html',
  './tablero.html',
  './Styles.css',
  './WebApp.js',
  './api.js',
  './PushNotifications.js',
  './Perfil.js',
  './OfflineQueue.js',
  './Avatares.js',
  './ChecadorChoferes.js',
  './Module.js',
  './Sidebar.js'
];

var HOSTS_SIN_CACHE = [
  'script.google.com',
  'googleapis.com',
  'gstatic.com',
  'googleusercontent.com',
  'nominatim.openstreetmap.org',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'imgur.com'
];

/* ===========================================================================
   INSTALAR / ACTIVAR
   =========================================================================== */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // El núcleo sí debe quedar completo.
      return cache.addAll(NUCLEO).catch(function () {
        return Promise.all(NUCLEO.map(function (u) {
          return cache.add(u).catch(function () {});
        }));
      }).then(function () {
        // Los extras van aparte y sin bloquear.
        return Promise.all(EXTRAS.map(function (u) {
          return cache.add(u).catch(function () {});
        }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (llaves) {
      return Promise.all(llaves.map(function (k) {
        return k === CACHE_NAME ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* ===========================================================================
   FETCH
   =========================================================================== */
function esExterno(url) {
  for (var i = 0; i < HOSTS_SIN_CACHE.length; i++) {
    if (url.host.indexOf(HOSTS_SIN_CACHE[i]) !== -1) return true;
  }
  return false;
}

/** Guarda una respuesta buena en el caché, sin estorbar. */
function guardar(request, respuesta) {
  if (!respuesta || !respuesta.ok) return;
  var copia = respuesta.clone();
  caches.open(CACHE_NAME).then(function (c) { c.put(request, copia); }).catch(function () {});
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  var url;
  try { url = new URL(event.request.url); } catch (e) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (esExterno(url)) return;              // servidor y CDNs: siempre red

  // version.json NUNCA se cachea: es justo el archivo que avisa que hay
  // versión nueva. Si se guardara, nadie se enteraría nunca.
  if (url.pathname.indexOf('version.json') !== -1) return;

  // Las portadas de los juegos (docs/juegos/…) se guardan al primer uso,
  // para que las fichas se vean también sin señal.
  if (url.pathname.indexOf('/juegos/') !== -1) {
    event.respondWith(
      caches.match(event.request).then(function (guardada) {
        if (guardada) return guardada;
        return fetch(event.request).then(function (fresca) {
          guardar(event.request, fresca);
          return fresca;
        }).catch(function () { return new Response('', { status: 504 }); });
      })
    );
    return;
  }

  // Los avatares vienen de DiceBear. Se guardan al primer uso para que las
  // caras se vean igual sin señal; el dibujo de una persona nunca cambia.
  if (url.host.indexOf('api.dicebear.com') !== -1) {
    event.respondWith(
      caches.match(event.request).then(function (guardada) {
        if (guardada) return guardada;
        return fetch(event.request).then(function (fresca) {
          guardar(event.request, fresca);
          return fresca;
        }).catch(function () { return new Response('', { status: 504 }); });
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // ---- NAVEGACIONES (abrir la app o tocar una notificación) ----------------
  // Caché primero: abre al instante con o sin señal. La copia se refresca
  // atrás para la próxima vez.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(function (guardada) {
        var red = fetch(event.request).then(function (fresca) {
          guardar(event.request, fresca);
          return fresca;
        });

        if (guardada) { red.catch(function () {}); return guardada; }

        return red.catch(function () {
          // Sin copia y sin señal: se contesta la página pedida si está en
          // caché con otro nombre, y si no, la pantalla del empleado.
          var nombre = url.pathname.split('/').pop() || 'checar.html';
          return caches.match('./' + nombre, { ignoreSearch: true })
            .then(function (r) { return r || caches.match('./checar.html'); })
            .then(function (r) { return r || caches.match('./index.html'); })
            .then(function (r) {
              return r || new Response(
                '<!doctype html><meta charset="utf-8"><title>Sin conexión</title>' +
                '<body style="background:#0d1117;color:#c9d1d9;font:16px system-ui;padding:2rem">' +
                '<h2>Sin conexión</h2><p>Abre la app una vez con señal para que quede ' +
                'guardada en el teléfono.</p></body>',
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
              );
            });
        });
      })
    );
    return;
  }

  // ---- RESTO DE ARCHIVOS: caché primero, refresco atrás --------------------
  event.respondWith(
    caches.match(event.request).then(function (guardada) {
      if (guardada) {
        fetch(event.request).then(function (fresca) {
          guardar(event.request, fresca);
        }).catch(function () {});
        return guardada;
      }
      return fetch(event.request).then(function (fresca) {
        if (fresca && fresca.type === 'basic') guardar(event.request, fresca);
        return fresca;
      });
    })
  );
});

/* ===========================================================================
   COLA OFFLINE — la misma base que usa checar.html
   =========================================================================== */
var DB_NAME = 'em_checador_offline';
var DB_STORE = 'checadas_pendientes';

function abrirDB() {
  return new Promise(function (res, rej) {
    var req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = function (e) {
      var d = e.target.result;
      if (!d.objectStoreNames.contains(DB_STORE)) {
        d.createObjectStore(DB_STORE, { keyPath: 'uuid' })
         .createIndex('timestamp', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = function (e) { res(e.target.result); };
    req.onerror = function (e) { rej(e.target.error); };
  });
}

function leerPendientes() {
  return abrirDB().then(function (d) {
    return new Promise(function (res) {
      var r = d.transaction([DB_STORE], 'readonly').objectStore(DB_STORE).getAll();
      r.onsuccess = function (e) {
        var l = e.target.result || [];
        l.sort(function (a, b) { return a.createdAt - b.createdAt; });
        res(l);
      };
      r.onerror = function () { res([]); };
    });
  }).catch(function () { return []; });
}

function borrarPendiente(uuid) {
  return abrirDB().then(function (d) {
    return new Promise(function (res) {
      var r = d.transaction([DB_STORE], 'readwrite').objectStore(DB_STORE).delete(uuid);
      r.onsuccess = r.onerror = function () { res(); };
    });
  }).catch(function () {});
}

/** Manda las checadas guardadas, una por una y en orden.
 *  Si alguna falla se queda pendiente y se reintenta después. */
function mandarPendientes() {
  return leerPendientes().then(function (lista) {
    if (!lista.length) return 0;
    var enviadas = 0;
    return lista.reduce(function (cadena, item) {
      return cadena.then(function () {
        return fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ fn: 'guardarChecadaChofer', args: [item] }),
          redirect: 'follow'
        }).then(function (r) { return r.json(); }).then(function (r) {
          if (r && !r.error) { enviadas++; return borrarPendiente(item.uuid); }
        }).catch(function () {});
      });
    }, Promise.resolve()).then(function () {
      if (enviadas) avisarClientes({ type: 'COLA_ENVIADA', enviadas: enviadas });
      return enviadas;
    });
  });
}

function avisarClientes(msg) {
  return self.clients.matchAll({ includeUncontrolled: true }).then(function (l) {
    l.forEach(function (c) { c.postMessage(msg); });
  }).catch(function () {});
}

// El navegador despierta esto cuando vuelve la señal, aunque la app esté
// cerrada. Si el celular no lo soporta (iPhone), checar.html vacía la cola
// al abrirse.
self.addEventListener('sync', function (event) {
  if (event.tag === 'checadas-pendientes') {
    event.waitUntil(mandarPendientes());
  }
});

self.addEventListener('periodicsync', function (event) {
  if (event.tag === 'checadas-pendientes') {
    event.waitUntil(mandarPendientes());
  }
});

/* ===========================================================================
   MENSAJES DE LA APP
   =========================================================================== */
self.addEventListener('message', function (event) {
  var d = event.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  if (d.type === 'VACIAR_COLA') event.waitUntil(mandarPendientes());
});
