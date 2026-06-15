// ============================================================================
// OFFLINE QUEUE — Cola persistente de checadas hechas sin internet
// ============================================================================
// Cuando un chofer/empleado checa y no hay conexión, la checada se guarda
// localmente en IndexedDB. Cuando vuelve internet, se envían en orden a GAS.
//
// API pública (todo lo que usa WebApp.js):
//   OfflineQueue.init()                  → abre/crea la DB (Promise)
//   OfflineQueue.encolar(datos)          → guarda una checada pendiente
//   OfflineQueue.listarPendientes()      → array de pendientes en orden
//   OfflineQueue.eliminar(uuid)          → quita una vez sincronizada
//   OfflineQueue.contar()                → número de pendientes
//   OfflineQueue.sincronizar()           → envía todas en orden con retry
//   OfflineQueue.onChange(callback)      → suscribirse a cambios de cola
//   OfflineQueue.generarUuid()           → UUID v4 para nuevas checadas
// ============================================================================

(function() {
  var DB_NAME    = 'em_checador_offline';
  var DB_VERSION = 1;
  var STORE      = 'checadas_pendientes';

  var _db = null;
  var _listeners = [];
  var _sincronizando = false;
  var _retryTimer = null;
  var _retryIntervalos = [5000, 30000, 120000, 600000, 1800000]; // 5s, 30s, 2min, 10min, 30min
  var _retryIdx = 0;

  // ── Abrir/crear la base ────────────────────────────────────────────────
  function init() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function(resolve, reject) {
      if (!('indexedDB' in window)) {
        console.warn('⚠️ IndexedDB no disponible en este navegador');
        reject(new Error('IndexedDB no disponible'));
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var store = db.createObjectStore(STORE, { keyPath: 'uuid' });
          store.createIndex('timestamp', 'createdAt', { unique: false });
        }
      };
      req.onsuccess = function(e) {
        _db = e.target.result;
        console.log('✅ OfflineQueue: DB abierta');
        resolve(_db);
      };
      req.onerror = function(e) {
        console.error('❌ OfflineQueue init error:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  // ── UUID v4 (RFC 4122) — para deduplicación en backend ─────────────────
  function generarUuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    // Fallback manual
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ── Encolar una checada ────────────────────────────────────────────────
  function encolar(datos) {
    return init().then(function() {
      return new Promise(function(resolve, reject) {
        var tx = _db.transaction([STORE], 'readwrite');
        var store = tx.objectStore(STORE);
        var item = Object.assign({}, datos, {
          uuid: datos.uuid || generarUuid(),
          createdAt: Date.now(),
          intentos: 0,
          ultimoIntento: null,
          ultimoError: null
        });
        var req = store.add(item);
        req.onsuccess = function() {
          console.log('📥 OfflineQueue: encolado', item.uuid, item.nombre);
          _notificar();
          resolve(item);
        };
        req.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  // ── Listar pendientes ordenados por createdAt (FIFO) ───────────────────
  function listarPendientes() {
    return init().then(function() {
      return new Promise(function(resolve) {
        var tx = _db.transaction([STORE], 'readonly');
        var store = tx.objectStore(STORE);
        var req = store.getAll();
        req.onsuccess = function(e) {
          var items = e.target.result || [];
          items.sort(function(a, b) { return a.createdAt - b.createdAt; });
          resolve(items);
        };
        req.onerror = function() { resolve([]); };
      });
    });
  }

  // ── Eliminar por UUID ──────────────────────────────────────────────────
  function eliminar(uuid) {
    return init().then(function() {
      return new Promise(function(resolve) {
        var tx = _db.transaction([STORE], 'readwrite');
        var store = tx.objectStore(STORE);
        var req = store.delete(uuid);
        req.onsuccess = function() {
          console.log('🗑️ OfflineQueue: eliminado', uuid);
          _notificar();
          resolve(true);
        };
        req.onerror = function() { resolve(false); };
      });
    });
  }

  // ── Actualizar item (para guardar intentos/error) ──────────────────────
  function _actualizar(item) {
    return init().then(function() {
      return new Promise(function(resolve) {
        var tx = _db.transaction([STORE], 'readwrite');
        var store = tx.objectStore(STORE);
        store.put(item);
        tx.oncomplete = function() { resolve(true); };
      });
    });
  }

  // ── Contar pendientes ──────────────────────────────────────────────────
  function contar() {
    return init().then(function() {
      return new Promise(function(resolve) {
        var tx = _db.transaction([STORE], 'readonly');
        var req = tx.objectStore(STORE).count();
        req.onsuccess = function(e) { resolve(e.target.result || 0); };
        req.onerror = function() { resolve(0); };
      });
    }).catch(function() { return 0; });
  }

  // ── Sincronizar: enviar todas las pendientes a GAS ─────────────────────
  // Cuando UNA falla → se programa retry con backoff (5s, 30s, 2min, ...).
  // Cuando se acaba el array de retries, espera al próximo evento 'online'.
  function sincronizar() {
    if (_sincronizando) {
      console.log('🔄 OfflineQueue: ya está sincronizando, se ignora la llamada');
      return Promise.resolve({ enviadas: 0, fallidas: 0, skipped: true });
    }
    if (!navigator.onLine) {
      console.log('📡 OfflineQueue: sin internet, se posterga sync');
      return Promise.resolve({ enviadas: 0, fallidas: 0, offline: true });
    }
    if (typeof google === 'undefined' || !google.script || !google.script.run) {
      console.warn('⚠️ OfflineQueue: google.script.run no disponible');
      return Promise.resolve({ enviadas: 0, fallidas: 0 });
    }

    _sincronizando = true;
    if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }

    return listarPendientes().then(function(items) {
      if (items.length === 0) {
        _sincronizando = false;
        _retryIdx = 0;
        return { enviadas: 0, fallidas: 0 };
      }
      console.log('📤 OfflineQueue: sincronizando ' + items.length + ' checadas pendientes...');

      var enviadas = 0, fallidas = 0;
      var promesa = Promise.resolve();
      items.forEach(function(item) {
        promesa = promesa.then(function() {
          return _enviarUna(item).then(function(ok) {
            if (ok) enviadas++; else fallidas++;
          });
        });
      });

      return promesa.then(function() {
        _sincronizando = false;
        console.log('✅ OfflineQueue: sync completo. Enviadas: ' + enviadas + ', Fallidas: ' + fallidas);
        if (fallidas > 0) _programarRetry();
        else _retryIdx = 0;
        return { enviadas: enviadas, fallidas: fallidas };
      });
    }).catch(function(err) {
      _sincronizando = false;
      console.error('❌ OfflineQueue sync error:', err);
      _programarRetry();
      return { enviadas: 0, fallidas: 0, error: err.message };
    });
  }

  function _enviarUna(item) {
    return new Promise(function(resolve) {
      // Construir el payload tal cual lo espera el backend.
      // El backend ya soporta uuid/clienteTimestamp/esOffline opcionales.
      var payload = Object.assign({}, item, { esOffline: true });
      delete payload.createdAt;
      delete payload.intentos;
      delete payload.ultimoIntento;
      delete payload.ultimoError;

      google.script.run
        .withSuccessHandler(function(result) {
          if (result && result.ok) {
            eliminar(item.uuid).then(function() { resolve(true); });
          } else {
            item.intentos = (item.intentos || 0) + 1;
            item.ultimoIntento = Date.now();
            item.ultimoError = (result && result.message) || 'Respuesta sin ok';
            _actualizar(item).then(function() { resolve(false); });
          }
        })
        .withFailureHandler(function(err) {
          item.intentos = (item.intentos || 0) + 1;
          item.ultimoIntento = Date.now();
          item.ultimoError = err && err.message ? err.message : 'Error desconocido';
          _actualizar(item).then(function() { resolve(false); });
        })
        .guardarChecadaChofer(payload);
    });
  }

  function _programarRetry() {
    if (_retryTimer) clearTimeout(_retryTimer);
    if (_retryIdx >= _retryIntervalos.length) {
      console.log('⏸️ OfflineQueue: max retries alcanzado, esperando próximo evento online');
      return;
    }
    var ms = _retryIntervalos[_retryIdx];
    _retryIdx++;
    console.log('⏲️ OfflineQueue: retry programado en ' + (ms / 1000) + 's');
    _retryTimer = setTimeout(function() {
      sincronizar();
    }, ms);
  }

  // ── Suscripción a cambios de la cola (para el indicador visual) ────────
  function onChange(callback) {
    if (typeof callback === 'function') _listeners.push(callback);
  }
  function _notificar() {
    contar().then(function(n) {
      _listeners.forEach(function(cb) {
        try { cb(n); } catch(e) {}
      });
    });
  }

  // ── Auto-sync cuando vuelve internet ───────────────────────────────────
  window.addEventListener('online', function() {
    console.log('🌐 Internet recuperado — disparando sync');
    setTimeout(sincronizar, 1500); // pequeño delay para estabilizar la red
  });

  // Exponer API
  window.OfflineQueue = {
    init:             init,
    encolar:          encolar,
    listarPendientes: listarPendientes,
    eliminar:         eliminar,
    contar:           contar,
    sincronizar:      sincronizar,
    onChange:         onChange,
    generarUuid:      generarUuid
  };

  // Inicializar al cargar (no-op si IndexedDB no existe)
  init().catch(function() {});

  console.log('✅ OfflineQueue módulo cargado');
})();
