// ============================================================================
// FIREBASE MESSAGING SERVICE WORKER — Checador Electronics México
// ============================================================================
// Recibe las notificaciones cuando la PWA está CERRADA o en segundo plano.
// Convive con service-worker.js (el del caché): cada uno hace lo suyo.
// Este archivo DEBE llamarse firebase-messaging-sw.js y vivir en la raíz.
//
// NUEVO (v700): ACUSE DE RECIBO.
// Al mostrar la notificación, le avisa al backend con el folio que viene en
// el mensaje. Esa es la única prueba de que la alerta llegó al celular: el
// código que contesta Firebase solo dice que Google la aceptó, no que el
// empleado la haya visto. En la hoja PUSH_LOG se ve columna por columna.
// ============================================================================

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// La configuración web de Firebase es pública por diseño: identifica al
// proyecto, no da acceso. Lo que protege es restringir la llave en Google
// Cloud al dominio del sitio.
firebase.initializeApp({
  apiKey: "AIzaSyAEstImEa0U-pNahzKyxZ2K7t303lF4D4E",
  authDomain: "checador-electronics.firebaseapp.com",
  projectId: "checador-electronics",
  storageBucket: "checador-electronics.firebasestorage.app",
  messagingSenderId: "888222391494",
  appId: "1:888222391494:web:3b310692d7aab6e76d8bc7"
});

var GAS_URL = 'https://script.google.com/macros/s/AKfycbxWu65gJ3jIbRp9WIbvNjia9IFsDJORUggDNyYUUQA_JxLYsbYjsawynN9hbV1kPqU5/exec';

// A dónde va el toque de la notificación.
//
// ⚠️ Aquí estaba el 404. Este service worker se registra con scope
// ./fcm-push/, una carpeta que NO existe en el sitio, y al tocar el aviso se
// abría self.registration.scope: .../ElectronicsChecador/fcm-push/ → 404.
// El destino se calcula quitando ese scope: la carpeta de la app.
var APP_URL = self.registration.scope.replace(/fcm-push\/?$/, '');
var APP_CHECAR = APP_URL + 'checar.html';

var messaging = firebase.messaging();

/** Avisa al backend que esta notificación sí llegó. Si falla, ni modo:
 *  nunca debe impedir que el aviso se muestre. */
function acusarRecibo(folio) {
  if (!folio) return Promise.resolve();
  return fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn: 'confirmarEntregaPush', args: [folio] }),
    redirect: 'follow'
  }).catch(function () {});
}

// Notificaciones en segundo plano (app cerrada o minimizada).
// El backend manda SOLO data (sin "notification") para que el aviso se
// muestre UNA vez, aquí, con nuestro ícono y nuestra vibración.
messaging.onBackgroundMessage(function (payload) {
  var d = payload.data || {};
  var titulo = d.title || 'Checador Electronics';
  var cuerpo = d.body || '';

  var mostrar = self.registration.showNotification(titulo, {
    body: cuerpo,
    data: { url: d.url || '', envio: d.envio || '' },
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    // Se queda en pantalla hasta que la quiten a mano (Android y escritorio;
    // en iPhone manda la configuración del sistema).
    requireInteraction: true,
    renotify: true,
    vibrate: [400, 150, 400, 150, 400],
    tag: 'checador-alerta'
  });

  // El acuse va en paralelo: que el aviso salga primero.
  return Promise.all([mostrar, acusarRecibo(d.envio)]);
});

// Al tocar la notificación: abrir la acción si la trae (por ejemplo la salida
// remota) o enfocar la ventana que ya esté abierta.
// ⚠️ UN SOLO listener. Antes había dos y un toque podía abrir dos ventanas.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var destino = (event.notification.data && event.notification.data.url) || APP_CHECAR;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lista) {
      // Si trae acción específica, esa gana siempre.
      if (destino.indexOf('salidaRemota') !== -1) return clients.openWindow(destino);

      for (var i = 0; i < lista.length; i++) {
        if (lista[i].url.indexOf(APP_URL) === 0 && 'focus' in lista[i]) {
          return lista[i].focus();
        }
      }
      return clients.openWindow(destino);
    })
  );
});
