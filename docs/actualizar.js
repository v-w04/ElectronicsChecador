/* ============================================================================
   ACTUALIZADOR — Checador Electronics México
   ============================================================================
   El problema que resuelve: una PWA instalada se queda pegada a la versión
   que guardó, y la única salida era borrarla y volverla a instalar. Aquí ya
   no.

   Cómo funciona:
     · docs/version.json dice cuál es la versión buena. Se lee SIN caché.
     · Si no coincide con la que trae la pantalla, se tira todo lo guardado,
       se cambia el service worker y se recarga. Dos segundos.
     · Se revisa al abrir y cada vez que se vuelve a la app.
     · Y hay un botón, por si alguien quiere forzarlo.

   Para publicar una versión nueva basta cambiar el número en version.json
   y en la pantalla. Nadie tiene que reinstalar nada.
   ========================================================================== */

var Actualizar = (function () {

  var VERSION_LOCAL = '';       // la pone la pantalla al arrancar
  var _revisando = false;
  var _ultimaRevision = 0;
  var LS_RECARGA = 'em_recarga_marca';   // evita recargas en bucle

  /** Lee la versión publicada. Sin caché: es el único archivo que siempre
   *  tiene que venir de internet. */
  function versionPublicada() {
    return fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.app) || null; })
      .catch(function () { return null; });
  }

  /** Tira caché y service worker, y recarga. */
  function aplicar() {
    // Marca para no entrar en bucle si algo sale mal.
    try {
      var marca = parseInt(localStorage.getItem(LS_RECARGA) || '0', 10);
      if (Date.now() - marca < 60000) return Promise.resolve(false);
      localStorage.setItem(LS_RECARGA, String(Date.now()));
    } catch (e) {}

    var pasos = [];

    if (self.caches && caches.keys) {
      pasos.push(caches.keys().then(function (l) {
        return Promise.all(l.map(function (k) { return caches.delete(k); }));
      }).catch(function () {}));
    }

    if ('serviceWorker' in navigator) {
      pasos.push(
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (r) {
            // El de las notificaciones se queda: si se borra, el celular
            // pierde el token y se cae de las alertas.
            if (r.scope.indexOf('fcm-push') !== -1) return r.update();
            return r.unregister();
          }));
        }).catch(function () {})
      );
    }

    return Promise.all(pasos).then(function () {
      location.reload();
      return true;
    });
  }

  /**
   * Revisa si hay versión nueva.
   *   avisar(estado, version) — opcional, para pintar algo en pantalla.
   *   Estados: 'buscando' · 'actualizando' · 'aldia' · 'sinred'
   */
  function revisar(avisar, forzado) {
    if (_revisando) return Promise.resolve();
    if (!forzado && Date.now() - _ultimaRevision < 5 * 60 * 1000) return Promise.resolve();
    if (navigator.onLine === false) {
      if (avisar) avisar('sinred');
      return Promise.resolve();
    }

    _revisando = true;
    _ultimaRevision = Date.now();
    if (avisar) avisar('buscando', VERSION_LOCAL);

    return versionPublicada().then(function (pub) {
      if (!pub) { if (avisar) avisar('sinred'); return; }

      if (VERSION_LOCAL && pub !== VERSION_LOCAL) {
        if (avisar) avisar('actualizando', pub);
        return aplicar();
      }

      // Aunque el número coincida, se le pide al service worker que se
      // asome: así entran los cambios chicos sin subir de versión.
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(function (r) {
          if (r) r.update();
        }).catch(function () {});
      }
      if (avisar) avisar('aldia', pub);

    }).catch(function () {
      if (avisar) avisar('sinred');
    }).then(function () { _revisando = false; });
  }

  /** Arranca la vigilancia. versionLocal es la de esta pantalla. */
  function iniciar(versionLocal, avisar) {
    VERSION_LOCAL = versionLocal || '';

    // Si el service worker cambió solo, recargar una vez para tomarlo.
    if ('serviceWorker' in navigator) {
      var yaRecargo = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (yaRecargo) return;
        yaRecargo = true;
        location.reload();
      });
    }

    revisar(avisar, true);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) revisar(avisar, false);
    });
    window.addEventListener('online', function () { revisar(avisar, false); });
  }

  return { iniciar: iniciar, revisar: revisar, aplicar: aplicar };
})();
