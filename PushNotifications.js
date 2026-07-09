// ============================================================================
// PUSH NOTIFICATIONS — registro del dispositivo para alertas (Firebase FCM)
// ============================================================================
// Flujo: cuando el empleado entra a su PERFIL, se le pide permiso de
// notificaciones. Al aceptar, el dispositivo genera un token que se guarda
// en la hoja PUSH_TOKENS (vía backend). El motor de alertas usa esos tokens
// para mandar las notificaciones al celular correcto.
// Al cerrar sesión, el token del dispositivo se elimina.

var PushNotifications = (function() {

  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyAEstImEa0U-pNahzKyxZ2K7t303lF4D4E",
    authDomain: "checador-electronics.firebaseapp.com",
    projectId: "checador-electronics",
    storageBucket: "checador-electronics.firebasestorage.app",
    messagingSenderId: "888222391494",
    appId: "1:888222391494:web:3b310692d7aab6e76d8bc7"
  };
  var VAPID_KEY = 'BHyfFo8jnvNKeIuXlAEqsXmfTLCaJqKEVkfWHSl8Lk4W155rGgA9LSlP_a4zF1vviWXtHY6QpikDcnrm9flaUo4';

  var _LS_TOKEN = 'em_push_token';
  var _sdkCargado = false;

  function _cargarScript(url) {
    return new Promise(function(res, rej) {
      var s = document.createElement('script');
      s.src = url;
      s.onload = res;
      s.onerror = function() { rej(new Error('No cargó ' + url)); };
      document.head.appendChild(s);
    });
  }

  function _asegurarSDK() {
    if (_sdkCargado) return Promise.resolve();
    return _cargarScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
      .then(function() { return _cargarScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js'); })
      .then(function() {
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        _sdkCargado = true;
      });
  }

  // Pide permiso y registra el token de ESTE dispositivo para el PIN dado.
  // Silencioso: si algo falla (sin soporte, permiso negado, offline), solo
  // lo loguea — el perfil sigue funcionando normal.
  function solicitarYRegistrar(pin) {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.log('🔕 Este navegador no soporta notificaciones push');
      return Promise.resolve({ ok: false, error: 'Sin soporte de notificaciones' });
    }
    if (navigator.onLine === false) return Promise.resolve({ ok: false, error: 'Sin internet' });

    return Notification.requestPermission().then(function(permiso) {
      if (permiso !== 'granted') {
        console.log('🔕 Permiso de notificaciones: ' + permiso);
        return { ok: false, error: 'Permiso: ' + permiso };
      }
      return _asegurarSDK()
        .then(function() {
          // SW propio de FCM con scope separado — convive con service-worker.js
          return navigator.serviceWorker.register('firebase-messaging-sw.js', { scope: './fcm-push/' });
        })
        .then(function(reg) {
          window._fcmReg = reg; // para mostrar notificaciones en primer plano
          var messaging = firebase.messaging();

          // ⭐ MENSAJES EN PRIMER PLANO: cuando la app está ABIERTA, el sistema
          // NO muestra el push automáticamente — hay que mostrarlo a mano.
          // (Por esto "enviada ✅" no sonaba si estabas dentro de la app.)
          if (!window._fcmOnMessageListo) {
            window._fcmOnMessageListo = true;
            messaging.onMessage(function(payload) {
              var d = payload.data || {};
              var t = d.title || (payload.notification && payload.notification.title) || 'Checador Electronics';
              var b = d.body  || (payload.notification && payload.notification.body)  || '';
              // Si la app está oculta → notificación del sistema.
              // Si está a la vista → SOLO banner (nunca las dos = doble aviso).
              if (document.hidden) {
                try {
                  if (window._fcmReg && window._fcmReg.showNotification) {
                    window._fcmReg.showNotification(t, {
                      body: b, icon: 'icon-192.png', vibrate: [200, 100, 200], tag: 'checador-fg'
                    });
                  }
                } catch(e) {}
                return;
              }
              try {
                var old = document.getElementById('push-inapp-banner');
                if (old) old.remove();
                var el = document.createElement('div');
                el.id = 'push-inapp-banner';
                el.style.cssText =
                  'position:fixed;top:calc(14px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);' +
                  'z-index:100020;max-width:92vw;background:#142340;border:1px solid rgba(127,223,255,0.5);' +
                  'border-radius:14px;padding:14px 18px;box-shadow:0 8px 30px rgba(0,0,0,0.6);color:#F1F5F9;';
                el.innerHTML = '<div style="font-size:14px;font-weight:800;">' + t + '</div>' +
                               '<div style="font-size:13px;color:#CBD5E1;margin-top:3px;">' + b + '</div>';
                document.body.appendChild(el);
                setTimeout(function() { if (el) el.remove(); }, 6000);
              } catch(e) {}
            });
          }

          return messaging.getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: reg
          });
        })
        .then(function(token) {
          if (!token) return { ok: false, error: 'FCM no devolvió token' };
          // Token anterior de ESTE dispositivo (para que el backend lo
          // reemplace y no lleguen notificaciones dobles)
          var tokenAnterior = null;
          try { tokenAnterior = localStorage.getItem(_LS_TOKEN); } catch(e) {}
          try { localStorage.setItem(_LS_TOKEN, token); } catch(e) {}
          return new Promise(function(res) {
            google.script.run
              .withSuccessHandler(function(r) {
                console.log('🔔 ' + (r && r.message ? r.message : 'Token registrado'));
                res({ ok: true });
              })
              .withFailureHandler(function(e) {
                res({ ok: false, error: 'El backend no aceptó el token: ' + (e && e.message ? e.message : e) });
              })
              .registrarPushToken(pin, token, tokenAnterior || '');
          });
        })
        .catch(function(e) {
          console.warn('🔕 Push no disponible: ' + e.message);
          var msg = e.message || '';
          if (msg.indexOf('404') !== -1 || /script|register/i.test(msg)) {
            msg = 'No se encontró firebase-messaging-sw.js en el sitio (¿está subido a GitHub?) · ' + msg;
          }
          return { ok: false, error: msg };
        });
    });
  }

  // Elimina el token de ESTE dispositivo (al cerrar sesión del perfil)
  function eliminar() {
    var token = null;
    try { token = localStorage.getItem(_LS_TOKEN); } catch(e) {}
    if (!token) return Promise.resolve();
    try { localStorage.removeItem(_LS_TOKEN); } catch(e) {}
    return new Promise(function(res) {
      google.script.run
        .withSuccessHandler(function() { res(); })
        .withFailureHandler(function() { res(); })
        .eliminarPushToken(token);
    });
  }

  return { solicitarYRegistrar: solicitarYRegistrar, eliminar: eliminar };
})();

console.log('✅ PushNotifications módulo cargado');
