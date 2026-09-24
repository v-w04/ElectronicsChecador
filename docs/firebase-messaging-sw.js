// ============================================================================
// FIREBASE MESSAGING SERVICE WORKER — Checador Electronics México
// ============================================================================
// Recibe las notificaciones cuando la PWA está CERRADA o en segundo plano.
// Convive con service-worker.js (el del caché): cada uno hace lo suyo.
// Este archivo DEBE llamarse firebase-messaging-sw.js y vivir en la raíz.
//
// ACUSE DE RECIBO: al mostrar la notificación le avisa al backend con el
// folio que viene en el mensaje. Esa es la única prueba de que la alerta
// llegó al celular: el código que contesta Firebase solo dice que Google la
// aceptó, no que el empleado la haya visto. Se ve en la hoja PUSH_LOG.
//
// ---------------------------------------------------------------------------
// v727 — POR QUÉ HAY DOS CAMINOS
// ---------------------------------------------------------------------------
// Este archivo bajaba dos librerías de gstatic.com con importScripts ANTES de
// poder hacer nada. Cuando el celular despierta el service worker para una
// notificación, le da una ventana de tiempo muy corta: si esas dos descargas
// tardan o fallan, el service worker muere sin mostrar nada. Firebase reporta
// 200 (aceptó el mensaje) y en el teléfono no aparece absolutamente nada.
//
// Eso fue justo lo que pasó: el 22-sep los iPhone acusaban recibo y el 23-sep
// ninguno, con el mismo backend y tokens recién registrados, mientras un
// Android seguía acusando normal.
//
// Ahora: se intenta cargar el SDK, y si no se puede, se atiende el evento
// 'push' a mano. El mensaje que manda el backend es solo datos (JSON), así
// que leerlo sin librería es trivial. Los dos caminos nunca corren juntos:
// si el SDK cargó, él manda; si no, manda el respaldo. Nunca dos avisos.
// ============================================================================

var SDK_OK = false;
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
  SDK_OK = (typeof firebase !== 'undefined' && !!firebase.messaging);
} catch (e) {
  SDK_OK = false;
}

var GAS_URL = 'https://script.google.com/macros/s/AKfycbxWu65gJ3jIbRp9WIbvNjia9IFsDJORUggDNyYUUQA_JxLYsbYjsawynN9hbV1kPqU5/exec';

// A dónde va el toque de la notificación.
//
// ⚠️ Aquí estaba el 404. Este service worker se registra con scope
// ./fcm-push/, una carpeta que NO existe en el sitio, y al tocar el aviso se
// abría self.registration.scope: .../ElectronicsChecador/fcm-push/ → 404.
// El destino se calcula quitando ese scope: la carpeta de la app.
var APP_URL = self.registration.scope.replace(/fcm-push\/?$/, '');
var APP_CHECAR = APP_URL + 'checar.html';

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

/**
 * Pinta el aviso. Un solo lugar, lo llamen del camino que lo llamen.
 * PRIMERO se muestra y DESPUÉS se acusa: si el acuse tarda o falla, el
 * empleado ya vio su alerta, que es lo único que de verdad importa.
 */
function mostrarAviso(d) {
  d = d || {};
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
    // Cada aviso con su propia etiqueta: con la etiqueta repetida el
    // celular reemplaza el anterior en silencio en vez de avisar de nuevo.
    tag: 'checador-' + (d.envio || Date.now())
  });

  return mostrar.then(function () { return acusarRecibo(d.envio); });
}

/* ---------------------------------------------------------------------------
   CAMINO 1 — con el SDK de Firebase (el de siempre)
   --------------------------------------------------------------------------- */
if (SDK_OK) {
  firebase.initializeApp({
    // La configuración web de Firebase es pública por diseño: identifica al
    // proyecto, no da acceso. Lo que protege es restringir la llave en Google
    // Cloud al dominio del sitio.
    apiKey: "AIzaSyAEstImEa0U-pNahzKyxZ2K7t303lF4D4E",
    authDomain: "checador-electronics.firebaseapp.com",
    projectId: "checador-electronics",
    storageBucket: "checador-electronics.firebasestorage.app",
    messagingSenderId: "888222391494",
    appId: "1:888222391494:web:3b310692d7aab6e76d8bc7"
  });

  // ⚠️ AQUÍ NO SE PINTA NADA. Esa es toda la corrección del aviso doble.
  //
  // Desde que el backend manda el bloque "notification", la propia librería
  // de Firebase dibuja el aviso en cuanto llega el mensaje. Este manejador
  // ADEMÁS se sigue llamando porque el mensaje también trae "data", y como
  // antes pintaba otro aviso, salían dos por cada alerta.
  //
  // Se queda solo con el acuse de recibo, que es lo único que la librería
  // no hace por su cuenta.
  firebase.messaging().onBackgroundMessage(function (payload) {
    var d = (payload && payload.data) || {};
    return acusarRecibo(d.envio);
  });
}

/* ---------------------------------------------------------------------------
   CAMINO 2 — sin librerías, cuando gstatic no respondió a tiempo
   ---------------------------------------------------------------------------
   Solo se engancha si el SDK NO cargó. Si cargó, él ya atiende el evento
   'push' por su cuenta y enganchar aquí mostraría el aviso dos veces.
   --------------------------------------------------------------------------- */
if (!SDK_OK) {
  self.addEventListener('push', function (event) {
    var j = {}, d = {};
    try {
      j = event.data ? event.data.json() : {};
      d = j.data || j;              // FCM lo envuelve en .data
    } catch (e) {
      try { d = { body: event.data ? event.data.text() : '' }; } catch (err) {}
    }
    // Aquí SÍ se pinta: sin la librería no hay nadie más que lo haga. Se
    // toman los textos del bloque notification si viene, y si no, de data.
    var n = j.notification || {};
    event.waitUntil(mostrarAviso({
      title: n.title || d.title,
      body:  n.body  || d.body,
      url:   d.url,
      envio: d.envio
    }));
  });
}

// ============================================================================
// AL TOCAR LA NOTIFICACION
// ============================================================================
// REGLA: tocar un aviso NO mete a nadie a la app. Hay tres clases de aviso y
// se distinguen por lo que traen pegado a la direccion:
//
//   1. ?accion=SALIDA&pin=55  (o REGRESO_COMIDA, ENTRADA, etc.)
//      LA CHECADA SE MANDA DESDE AQUI. Este service worker le pega al
//      servidor el solo y contesta con un avisito: "Listo, tu salida quedo a
//      las 18:05". La app nunca se abre. Si esta abierta, se le avisa para
//      que refresque la pantalla.
//
//   2. ?accion=DECIDIR&pin=55
//      Esa no se puede contestar con un toque ciego (vienes o no vienes), asi
//      que es la UNICA que si abre la app, en la hoja de decision.
//
//   3. Sin accion: el toque solo quita el aviso. Nada mas.
//
// UN SOLO listener. Antes habia dos y un toque podia abrir dos ventanas.

/** Un folio distinto por checada: el servidor no duplica si se repite. */
function folioChecada() {
  try { if (self.crypto && crypto.randomUUID) return 'nt-' + crypto.randomUUID(); } catch (e) {}
  return 'nt-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

var NOM_MOV = {
  ENTRADA: 'entrada',
  SALIDA: 'salida',
  SALIDA_DESAYUNO: 'salida a desayunar',
  REGRESO_DESAYUNO: 'regreso de desayuno',
  SALIDA_COMIDA: 'salida a comer',
  REGRESO_COMIDA: 'regreso de comida'
};

/** Avisito de respuesta. Etiqueta propia para que no tape a los demas. */
function avisarResultado(cuerpo) {
  return self.registration.showNotification('Checador Electronics', {
    body: cuerpo,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'checador-resp-' + Date.now(),
    data: { url: '', envio: '' }
  });
}

/** Le dice a la app, si esta abierta, que se refresque. */
function avisarALaApp(lista) {
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].url.indexOf(APP_URL) !== 0) continue;
    try { lista[i].postMessage({ tipo: 'refrescar' }); } catch (e) {}
  }
}

/**
 * Manda la checada al servidor desde el propio aviso.
 * El servidor decide la hora (la del cliente solo se usa si va offline) y
 * puede negarse — "aun no es tu hora de salida" —; eso se le repite al
 * empleado tal cual en el avisito de respuesta.
 */
function checarDesdeElAviso(tipo, pin) {
  var nom = NOM_MOV[tipo] || 'checada';
  return fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn: 'guardarChecadaChofer', args: [{
      idUsuario: pin,
      nombre: '',                 // lo pone el servidor buscando el pin
      tipo: tipo,
      uuid: folioChecada(),
      origen: 'NOTIF',
      esOffline: false,
      clienteTimestamp: new Date().toISOString()
    }] }),
    redirect: 'follow'
  }).then(function (r) { return r.text(); }).then(function (t) {
    var j = {};
    try { j = JSON.parse(t); } catch (e) {}
    if (!j.ok) return avisarResultado('No se pudo registrar tu ' + nom + '. Abre la app.');
    if (j.noRegistrada) return avisarResultado(j.message || 'No se registro tu ' + nom + '.');
    if (j.duplicado)    return avisarResultado('Tu ' + nom + ' ya estaba registrada.');
    return avisarResultado('Listo, tu ' + nom + ' quedo a las ' +
                           (j.horaServidor || '').slice(0, 5) + '.');
  }).catch(function () {
    // Sin senal no hay nada que encolar desde aqui: la cola offline vive en
    // la app. Se dice claro en vez de fingir que se registro.
    return avisarResultado('Sin senal: no se registro tu ' + nom + '. Abrela cuando tengas internet.');
  });
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var d = event.notification.data || {};
  var destino = d.url || '';

  // Desde que el aviso lo pinta el propio sistema (bloque notification en el
  // mensaje), este service worker ya no se entera de que se mostro, asi que
  // no puede acusar recibo en ese momento. El acuse se manda al TOCARLO.
  var acuse = d.envio ? acusarRecibo(d.envio) : Promise.resolve();

  var acc = (destino.match(/[?&]accion=([^&]+)/) || [])[1] || '';
  var pin = (destino.match(/[?&]pin=([^&]+)/) || [])[1] || '';
  if (!acc) {
    // Direcciones viejas, de notificaciones que ya estaban en el celular.
    var v = (destino.match(/[?&]salidaRemota=([^&]+)/) || [])[1];
    if (v) { acc = 'SALIDA'; pin = v; }
    else if (destino.indexOf('diaLibre') !== -1) { acc = 'DECIDIR'; }
  }
  acc = acc ? decodeURIComponent(acc).toUpperCase() : '';
  pin = pin ? decodeURIComponent(pin) : '';

  // 3. Sin accion: el aviso ya se quito y con eso basta.
  if (!acc) { event.waitUntil(acuse); return; }

  // 1. Con tipo de movimiento: se checa desde aqui, sin abrir la app.
  if (NOM_MOV[acc]) {
    event.waitUntil(
      acuse.then(function () { return checarDesdeElAviso(acc, pin); })
           .then(function () {
             return clients.matchAll({ type: 'window', includeUncontrolled: true });
           })
           .then(avisarALaApp)
    );
    return;
  }

  // 2. DECIDIR (o cualquier otra que no sea un movimiento): abre la app.
  event.waitUntil(
    acuse.then(function () {
      return clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(function (lista) {
      var enChecar = null;
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].url.indexOf(APP_URL) !== 0) continue;
        if (lista[i].url.indexOf('checar') !== -1) { enChecar = lista[i]; break; }
      }
      if (enChecar) {
        try { enChecar.postMessage({ tipo: 'accion', accion: acc, pin: pin }); } catch (e) {}
        return ('focus' in enChecar) ? enChecar.focus() : undefined;
      }
      return clients.openWindow(destino);
    })
  );
});
