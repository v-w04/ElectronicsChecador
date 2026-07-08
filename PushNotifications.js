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
      return Promise.resolve(false);
    }
    if (navigator.onLine === false) return Promise.resolve(false);

    return Notification.requestPermission().then(function(permiso) {
      if (permiso !== 'granted') {
        console.log('🔕 Permiso de notificaciones: ' + permiso);
        return false;
      }
      return _asegurarSDK()
        .then(function() {
          // SW propio de FCM con scope separado — convive con service-worker.js
          return navigator.serviceWorker.register('firebase-messaging-sw.js', { scope: './fcm-push/' });
        })
        .then(function(reg) {
          return firebase.messaging().getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: reg
          });
        })
        .then(function(token) {
          if (!token) return false;
          try { localStorage.setItem(_LS_TOKEN, token); } catch(e) {}
          return new Promise(function(res) {
            google.script.run
              .withSuccessHandler(function(r) {
                console.log('🔔 ' + (r && r.message ? r.message : 'Token registrado'));
                res(true);
              })
              .withFailureHandler(function() { res(false); })
              .registrarPushToken(pin, token);
          });
        })
        .catch(function(e) {
          console.warn('🔕 Push no disponible: ' + e.message);
          return false;
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
