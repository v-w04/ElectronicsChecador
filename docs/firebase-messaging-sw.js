// ============================================================================
// FIREBASE MESSAGING SERVICE WORKER — Checador Electronics México
// ============================================================================
// Recibe las notificaciones push cuando la PWA está CERRADA o en background.
// Convive con service-worker.js (el del cache) — cada uno hace lo suyo.
// Este archivo DEBE llamarse firebase-messaging-sw.js y vivir en la raíz.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAEstImEa0U-pNahzKyxZ2K7t303lF4D4E",
  authDomain: "checador-electronics.firebaseapp.com",
  projectId: "checador-electronics",
  storageBucket: "checador-electronics.firebasestorage.app",
  messagingSenderId: "888222391494",
  appId: "1:888222391494:web:3b310692d7aab6e76d8bc7"
});

const messaging = firebase.messaging();

// Notificaciones en background (app cerrada o minimizada)
// El backend manda SOLO data (sin "notification") para que la notificación
// se muestre UNA sola vez, aquí, con nuestro ícono y vibración.
messaging.onBackgroundMessage(function(payload) {
  const d = payload.data || {};
  const titulo = d.title || (payload.notification && payload.notification.title) || 'Checador Electronics';
  const cuerpo = d.body || (payload.notification && payload.notification.body) || '';
  self.registration.showNotification(titulo, {
    data: { url: d.url || '' },
    // ⭐ Persistente: no se auto-oculta — el empleado tiene que quitarla
    // (Android/desktop la fijan; iOS decide según los ajustes del sistema)
    requireInteraction: true,
    renotify: true,
    // ⭐ Estilo "urgente": se queda en pantalla hasta que el usuario la
    // descarte a mano (Android/PC). Vibración larga tipo alarma.
    requireInteraction: true,
    body: cuerpo,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    vibrate: [400, 150, 400, 150, 400],
    tag: 'checador-alerta'
  });
});

// Al tocar la notificación → abrir/enfocar la PWA
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(lista) {
      for (var i = 0; i < lista.length; i++) {
        if ('focus' in lista[i]) return lista[i].focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});


// Al tocar la notificación: abrir la app (con la acción si trae URL, p.ej.
// la salida remota) o enfocar la ventana ya abierta.
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var destino = (event.notification.data && event.notification.data.url) ||
                self.registration.scope;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(lista) {
      // Si trae acción específica (salida remota), abrir SIEMPRE esa URL
      if (destino.indexOf('salidaRemota') !== -1) {
        return clients.openWindow(destino);
      }
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].url.indexOf(self.registration.scope) === 0 && 'focus' in lista[i]) {
          return lista[i].focus();
        }
      }
      return clients.openWindow(destino);
    })
  );
});
