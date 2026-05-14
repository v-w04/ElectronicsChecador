// ============================================================================
// SISTEMA DE ACCESO — LOGIN CIRCULAR (Electronics México)
// ============================================================================
// ⚠️ LÓGICA: validación local con cache en localStorage. GAS solo se consulta
// una vez al cargar la app (o cuando ADMIN fuerza resync). La checada se
// guarda en background sin bloquear la pantalla de éxito.
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// CACHE LOCAL DE USUARIOS — PIN + contraseña sin llamar a GAS cada vez
// ─────────────────────────────────────────────────────────────────────────────
// Estructura: { "0001": {pin, idUsuario, nombre, tipo, contrasena}, ... }
// La primera carga consulta GAS (getTodosLosUsuarios), guarda en localStorage
// y todas las siguientes cargas son instantáneas. ADMIN puede invocar
// sincronizarUsuariosManual() para forzar el resync.
var _usuariosCache = null;

// _cargarUsuariosCache flujo:
//  1) Si ya está en memoria → usar (instantáneo)
//  2) Si está en localStorage → usar de inmediato + chequear versión en background
//  3) Si no hay cache → sincronizar desde GAS
// Cuando GAS devuelve una versión más nueva que la guardada, el cache se
// invalida automáticamente y se vuelve a llamar la próxima vez.
function _cargarUsuariosCache(callback) {
  if (_usuariosCache) {
    if (callback) callback(_usuariosCache);
    _chequearVersionEnBackground();
    return;
  }
  try {
    var guardado = localStorage.getItem('em_usuarios_cache');
    if (guardado) {
      _usuariosCache = JSON.parse(guardado);
      if (callback) callback(_usuariosCache);
      _chequearVersionEnBackground();
      return;
    }
  } catch(e) {}
  _sincronizarUsuarios(callback);
}

// Chequea en background si el servidor tiene una versión más nueva del cache.
// Si la versión cambió (ADMIN sincronizó desde Sheets), invalida el cache local
// y vuelve a sincronizar sin bloquear nada. El usuario actual sigue viendo el
// PIN normalmente; la próxima carga de la app ya tendrá los datos nuevos.
function _chequearVersionEnBackground() {
  google.script.run
    .withSuccessHandler(function(result) {
      if (!result || !result.ok || !result.version) return;
      var versionLocal = '0';
      try { versionLocal = localStorage.getItem('em_usuarios_version') || '0'; } catch(e) {}
      if (result.version.toString() !== versionLocal.toString()) {
        console.log('🔄 Versión nueva detectada (' + versionLocal + ' → ' + result.version + '). Resincronizando...');
        _usuariosCache = null;
        try {
          localStorage.removeItem('em_usuarios_cache');
        } catch(e) {}
        _sincronizarUsuarios(null);
      }
    })
    .withFailureHandler(function() { /* sin conexión: usar cache local */ })
    .getVersionUsuarios();
}

function _sincronizarUsuarios(callback) {
  google.script.run
    .withSuccessHandler(function(result) {
      // El backend devuelve { ok, usuarios:[{pin, idUsuario, nombre, tipo, contrasena}, ...] }
      // Construir mapa pin → usuario para lookup O(1)
      var mapa = {};
      if (result && result.ok && Array.isArray(result.usuarios)) {
        result.usuarios.forEach(function(u) {
          if (u && u.pin) mapa[u.pin.toString().trim()] = u;
        });
      }
      _usuariosCache = mapa;
      try { localStorage.setItem('em_usuarios_cache', JSON.stringify(mapa)); } catch(e) {}

      // Guardar también la versión actual del servidor para futuras comparaciones
      google.script.run
        .withSuccessHandler(function(v) {
          if (v && v.ok && v.version) {
            try { localStorage.setItem('em_usuarios_version', v.version.toString()); } catch(e) {}
          }
        })
        .withFailureHandler(function() {})
        .getVersionUsuarios();

      if (callback) callback(_usuariosCache);
    })
    .withFailureHandler(function() {
      _usuariosCache = {};
      if (callback) callback(_usuariosCache);
    })
    .getTodosLosUsuarios();
}

// Función expuesta al ADMIN para forzar resync manual desde el dashboard
window.sincronizarUsuariosManual = function() {
  _usuariosCache = null;
  try {
    localStorage.removeItem('em_usuarios_cache');
    localStorage.removeItem('em_usuarios_version');
  } catch(e) {}
  _sincronizarUsuarios(function() {
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('success', '✅ Usuarios sincronizados');
    } else {
      alert('Usuarios sincronizados');
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PANTALLA DE ACCESO
// ─────────────────────────────────────────────────────────────────────────────
function mostrarPantallaPIN() {
  var viejo = document.getElementById('pin-overlay');
  if (viejo) viejo.remove();

  // Pre-cargar usuarios en background (si no están en localStorage, llama GAS)
  _cargarUsuariosCache(function() {});

  var overlay = document.createElement('div');
  overlay.id = 'pin-overlay';
  overlay.className = 'pin-overlay';

  // Toda la estructura usa los mismos IDs que procesarAcceso espera:
  //   #input-pin, #input-contrasena, #input-contrasena2,
  //   #contrasena-label, #contrasena2-section, #btn-acceso,
  //   #acceso-error, #pin-box
  var box = document.createElement('div');
  box.id = 'pin-box';
  box.className = 'login-ring';
  box.setAttribute('data-state', 'idle');

  box.innerHTML =
    // ── SVG: riel + anillo activo ────────────────────────────────────────────
    '<svg class="ring" viewBox="0 0 600 600" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="ringGradient" x1="0%" y1="100%" x2="100%" y2="0%">' +
          '<stop offset="0%"  stop-color="#2456a8"/>' +
          '<stop offset="55%" stop-color="#1e90ff"/>' +
          '<stop offset="100%" stop-color="#7fdfff"/>' +
        '</linearGradient>' +
        '<linearGradient id="ringErrorGradient" x1="0%" y1="100%" x2="100%" y2="0%">' +
          '<stop offset="0%"  stop-color="#7a1a2d"/>' +
          '<stop offset="100%" stop-color="#ff4d6d"/>' +
        '</linearGradient>' +
        '<linearGradient id="ringSuccessGradient" x1="0%" y1="100%" x2="100%" y2="0%">' +
          '<stop offset="0%"  stop-color="#14633e"/>' +
          '<stop offset="100%" stop-color="#3ddc84"/>' +
        '</linearGradient>' +
        // Filtro SVG nativo de glow azul/cyan (más confiable que CSS drop-shadow)
        '<filter id="ringGlow" x="-50%" y="-50%" width="200%" height="200%">' +
          '<feGaussianBlur stdDeviation="6" result="blur1"/>' +
          '<feGaussianBlur stdDeviation="14" result="blur2"/>' +
          '<feMerge>' +
            '<feMergeNode in="blur2"/>' +
            '<feMergeNode in="blur1"/>' +
            '<feMergeNode in="SourceGraphic"/>' +
          '</feMerge>' +
        '</filter>' +
      '</defs>' +
      '<circle class="ring__track" cx="300" cy="300" r="295" />' +
      '<g class="ring__rotor">' +
        '<circle class="ring__active" cx="300" cy="300" r="295" ' +
                'stroke="url(#ringGradient)" filter="url(#ringGlow)" ' +
                'stroke-dasharray="1853.54" stroke-dashoffset="1853.54" ' +
                'transform="rotate(-90 300 300)" />' +
      '</g>' +
    '</svg>' +

    // ── Panel interior ──────────────────────────────────────────────────────
    '<div class="ring-panel">' +
      // Campo PIN (mitad superior, sin candado)
      // type="text" + -webkit-text-security: disc → Chrome no lo detecta como
      // password, no ofrece "guardar contraseña". autocomplete="one-time-code"
      // es la sugerencia oficial de Apple/Google para PINs efímeros (la única
      // que ambos respetan).
      '<div class="ring-field ring-field--top">' +
        '<label class="ring-label" for="input-pin">PIN</label>' +
        '<input id="input-pin" class="ring-input ring-input--pin ring-input--masked" type="text" ' +
               'inputmode="numeric" pattern="[0-9]*" maxlength="4" ' +
               'autocomplete="one-time-code" autocorrect="off" autocapitalize="off" spellcheck="false" ' +
               'data-form-type="other" data-lpignore="true" data-1p-ignore="true" ' +
               'name="" placeholder="••••" aria-label="PIN de acceso" />' +
      '</div>' +

      // Divisor + botón Entrar (logo de Electronics)
      '<div class="ring-divider" aria-hidden="true"></div>' +
      '<button id="btn-acceso" class="ring-btn" type="button" aria-label="Entrar">' +
        '<img class="ring-btn__logo" src="logo-electronics.png" alt="Entrar" draggable="false" />' +
      '</button>' +

      // Campo Contraseña (mitad inferior)
      '<div class="ring-field ring-field--bottom">' +
        '<label id="contrasena-label" class="ring-label" for="input-contrasena">Contraseña</label>' +
        '<input id="input-contrasena" class="ring-input ring-input--masked" type="text" ' +
               'inputmode="numeric" pattern="[0-9]*" maxlength="4" ' +
               'autocomplete="one-time-code" autocorrect="off" autocapitalize="off" spellcheck="false" ' +
               'data-form-type="other" data-lpignore="true" data-1p-ignore="true" ' +
               'name="" placeholder="••••" aria-label="Contraseña" />' +
        // Campo de confirmación oculto — legado para creación de contraseña; con
        // validación local todos los usuarios ya tienen contraseña en la hoja
        '<div id="contrasena2-section" class="ring-field__confirm" style="display:none;">' +
          '<input id="input-contrasena2" class="ring-input ring-input--masked" type="text" ' +
                 'inputmode="numeric" pattern="[0-9]*" maxlength="4" ' +
                 'autocomplete="one-time-code" autocorrect="off" autocapitalize="off" spellcheck="false" ' +
                 'data-form-type="other" data-lpignore="true" data-1p-ignore="true" ' +
                 'name="" placeholder="Confirmar" aria-label="Confirmar contraseña" />' +
        '</div>' +
      '</div>' +

      // Mensaje de error (dentro del círculo)
      '<div id="acceso-error" class="ring-error" aria-live="polite"></div>' +
      // Anuncio accesible
      '<div class="sr-only" aria-live="polite" id="status-announcer"></div>' +
    '</div>';

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // ── Reset de variables globales (igual que antes) ────────────────────────
  window._pinChofer = null;
  window._nombreChofer = null;
  window._idChofer = null;

  // ── Hooks de eventos ─────────────────────────────────────────────────────
  var ip  = document.getElementById('input-pin');
  var ic  = document.getElementById('input-contrasena');
  var ic2 = document.getElementById('input-contrasena2');
  var btn = document.getElementById('btn-acceso');

  // Helper: filtra todo lo que no sea dígito (mobile + paste + autocompletar)
  function _onlyDigits(el) {
    var clean = (el.value || '').replace(/\D+/g, '');
    if (clean !== el.value) el.value = clean;
  }

  // Helpers: marcar la mitad activa según foco (ilumina arriba o abajo)
  function _markFocusTop() {
    if (box) { box.classList.add('is-focus-top');    box.classList.remove('is-focus-bottom'); }
  }
  function _markFocusBottom() {
    if (box) { box.classList.add('is-focus-bottom'); box.classList.remove('is-focus-top'); }
  }
  function _clearFocus() {
    if (box) { box.classList.remove('is-focus-top'); box.classList.remove('is-focus-bottom'); }
  }

  if (ip) {
    // Filtro numérico + auto-salto a contraseña al llegar a 4 dígitos
    ip.addEventListener('input', function() {
      _onlyDigits(ip);
      _updateRingFromInputs();
      if (ip.value.length >= 4 && ic) {
        // Pequeño delay para que el último dígito se vea antes del salto
        setTimeout(function() { ic.focus(); }, 80);
      }
    });
    // Bloquear caracteres no numéricos antes de que entren (desktop)
    ip.addEventListener('keydown', function(e) {
      // Permitir teclas de control (Tab, Backspace, Delete, flechas, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key && e.key.length === 1 && !/[0-9]/.test(e.key)) {
        e.preventDefault();
      }
    });
    ip.addEventListener('focus', _markFocusTop);
    ip.addEventListener('blur',  _clearFocus);
    setTimeout(function() { ip.focus(); }, 100);
  }

  if (ic) {
    ic.addEventListener('input', function() {
      _onlyDigits(ic);
      _updateRingFromInputs();
      // Auto-submit al llegar a 4 dígitos (igual que un Enter implícito)
      if (ic.value.length >= 4) {
        var pinVal = (document.getElementById('input-pin') || {}).value || '';
        if (pinVal.length >= 4) {
          // Bajar el teclado virtual del móvil ANTES del submit
          ic.blur();
          if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
          }
          setTimeout(function() { procesarAcceso(); }, 100);
        }
      }
    });
    ic.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { procesarAcceso(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key && e.key.length === 1 && !/[0-9]/.test(e.key)) {
        e.preventDefault();
      }
    });
    ic.addEventListener('focus', _markFocusBottom);
    ic.addEventListener('blur',  _clearFocus);
  }

  if (ic2) {
    ic2.addEventListener('input', function() {
      _onlyDigits(ic2);
      _updateRingFromInputs();
      // Auto-submit al llegar a 4 dígitos en confirmación (primera vez)
      if (ic2.value.length >= 4) {
        // Bajar el teclado virtual del móvil ANTES del submit
        ic2.blur();
        if (document.activeElement && document.activeElement.blur) {
          document.activeElement.blur();
        }
        setTimeout(function() { procesarAcceso(); }, 100);
      }
    });
    ic2.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { procesarAcceso(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key && e.key.length === 1 && !/[0-9]/.test(e.key)) {
        e.preventDefault();
      }
    });
    ic2.addEventListener('focus', _markFocusBottom);
    ic2.addEventListener('blur',  _clearFocus);
  }

  if (btn) {
    btn.addEventListener('click', procesarAcceso);
  }
}

// ============================================================================
// ANIMACIÓN DEL ANILLO — solo capa visual, no toca validación
// ============================================================================
var _RING_CIRCUMFERENCE = 1853.54;          // 2 * π * 295
var _RING_HALF          = _RING_CIRCUMFERENCE / 2;
var _RING_MIN_PIN       = 4;                // PIN 4 dígitos = mitad superior llena
var _RING_MIN_PWD       = 6;                // contraseña ≥ 6 chars = mitad inferior llena

function _updateRingFromInputs() {
  var ip = document.getElementById('input-pin');
  var ic = document.getElementById('input-contrasena');
  var box = document.getElementById('pin-box');
  if (!box) return;
  var arc = box.querySelector('.ring__active');
  if (!arc) return;

  // No actualizar manualmente si está en processing/success/error
  var state = box.getAttribute('data-state');
  if (state === 'processing' || state === 'success' || state === 'error') return;

  var pinLen = Math.min((ip && ip.value) ? ip.value.length : 0, _RING_MIN_PIN);
  var pwdLen = Math.min((ic && ic.value) ? ic.value.length : 0, _RING_MIN_PWD);

  var pinProgress = pinLen / _RING_MIN_PIN;
  var pwdProgress = pwdLen / _RING_MIN_PWD;

  var filled = (pinProgress * _RING_HALF) + (pwdProgress * _RING_HALF);
  var offset = _RING_CIRCUMFERENCE - filled;
  arc.style.strokeDashoffset = offset;

  box.setAttribute('data-state', (pinLen + pwdLen) > 0 ? 'filling' : 'idle');
}

function _setRingState(state) {
  var box = document.getElementById('pin-box');
  if (!box) return;
  box.setAttribute('data-state', state);

  var arc = box.querySelector('.ring__active');
  if (!arc) return;

  if (state === 'processing' || state === 'success' || state === 'error') {
    arc.style.strokeDashoffset = 0;
  }

  if (state === 'success') {
    arc.setAttribute('stroke', 'url(#ringSuccessGradient)');
  } else if (state === 'error') {
    arc.setAttribute('stroke', 'url(#ringErrorGradient)');
  } else {
    arc.setAttribute('stroke', 'url(#ringGradient)');
  }

  var announcer = document.getElementById('status-announcer');
  if (announcer) {
    var msgs = {
      processing: 'Iniciando sesión',
      success:    'Acceso concedido',
      error:      'Error de credenciales'
    };
    if (msgs[state]) announcer.textContent = msgs[state];
  }
}

// Helper: cambiar contenido del botón con ajuste automático
// - "Entrar" → muestra el logo de Electronics (no texto)
// - Estados ocupados (Verificando/Guardando/Procesando) → spinner
// - Cualquier otro texto corto → render normal en span
function _setBtnLabel(btn, text) {
  if (!btn) return;
  var BUSY_STATES = { 'Verificando': true, 'Guardando': true, 'Procesando': true };
  // Normalizar quitando puntos suspensivos para comparar
  var key = (text || '').replace(/\.{2,}$/, '').trim();

  if (BUSY_STATES[key]) {
    // Estado ocupado → spinner blanco (cabe siempre, indica progreso)
    btn.classList.add('ring-btn--busy');
    btn.classList.remove('ring-btn--logo');
    btn.innerHTML = '<span class="ring-btn__spinner" aria-label="' + text + '"></span>';
  } else if (key === 'Entrar') {
    // Estado normal de entrada → mostrar logo
    btn.classList.remove('ring-btn--busy');
    btn.classList.add('ring-btn--logo');
    btn.setAttribute('aria-label', 'Entrar');
    btn.innerHTML = '<img class="ring-btn__logo" src="logo-electronics.png" alt="Entrar" draggable="false" />';
  } else {
    // Cualquier otro texto (ej. "Crear", "Reintentar") — render normal
    btn.classList.remove('ring-btn--busy');
    btn.classList.remove('ring-btn--logo');
    btn.setAttribute('aria-label', text);
    btn.innerHTML = '<span class="ring-btn__label">' + text + '</span>';
  }
}

// ============================================================================
// LÓGICA DE VALIDACIÓN — INTOCADA (solo se añadieron llamadas a _setRingState)
// ============================================================================
function procesarAcceso() {
  var pin = (document.getElementById('input-pin') || {}).value || '';
  var contrasena = (document.getElementById('input-contrasena') || {}).value || '';

  pin = pin.trim();
  contrasena = contrasena.trim();

  if (pin.length < 4) { mostrarErrorAcceso('Ingresa tu PIN de 4 dígitos'); return; }
  if (!contrasena) { mostrarErrorAcceso('Ingresa tu contraseña'); return; }

  var btn = document.getElementById('btn-acceso');
  if (btn) { btn.disabled = true; _setBtnLabel(btn, 'Verificando'); }
  _setRingState('processing');

  // ── Validación LOCAL — usa cache en localStorage, sin llamar a GAS ──
  // Si el cache aún no se cargó (primera vez), se carga ahora y luego valida
  _cargarUsuariosCache(function(usuarios) {
    var usuario = usuarios ? usuarios[pin] : null;

    if (!usuario) {
      mostrarErrorAcceso('PIN incorrecto');
      if (btn) { btn.disabled = false; _setBtnLabel(btn, 'Entrar'); }
      var ip = document.getElementById('input-pin');
      var ic = document.getElementById('input-contrasena');
      if (ip) { ip.value = ''; ip.focus(); }
      if (ic) ic.value = '';
      return;
    }

    // ADMIN: solo PIN, no necesita contraseña adicional
    if (usuario.tipo === 'ADMIN') {
      _setRingState('success');
      setTimeout(function() {
        var ov = document.getElementById('pin-overlay');
        if (ov) ov.remove();
        if (typeof window._inicializarDashboard === 'function') window._inicializarDashboard();
      }, 400);
      return;
    }

    // CHOFER: validar contraseña local
    if (contrasena !== (usuario.contrasena || '').toString().trim()) {
      mostrarErrorAcceso('Contraseña incorrecta');
      if (btn) { btn.disabled = false; _setBtnLabel(btn, 'Entrar'); }
      var ic2 = document.getElementById('input-contrasena');
      if (ic2) { ic2.value = ''; ic2.focus(); }
      return;
    }

    // Validación OK — lanzar flujo de checada inmediatamente
    _setRingState('success');
    setTimeout(function() { _lanzarFlujoChecar(usuario.nombre, usuario.idUsuario); }, 250);
  });
}

// ============================================================================
// FLUJO POST-LOGIN: GPS → muestra éxito inmediato → GAS en background → vuelve
// ============================================================================
function _lanzarFlujoChecar(nombre, idUsuario) {
  var box = document.getElementById('pin-box');
  if (!box) return;

  // 1) Limpiar state previo para que el navegador reconozca la transición
  box.removeAttribute('data-state');
  box.classList.add('login-ring--flow');

  box.innerHTML =
    '<svg class="ring" viewBox="0 0 600 600" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="ringGradientFlow" x1="0%" y1="100%" x2="100%" y2="0%">' +
          '<stop offset="0%"  stop-color="#2456a8"/>' +
          '<stop offset="55%" stop-color="#1e90ff"/>' +
          '<stop offset="100%" stop-color="#7fdfff"/>' +
        '</linearGradient>' +
        '<filter id="ringGlowFlow" x="-50%" y="-50%" width="200%" height="200%">' +
          '<feGaussianBlur stdDeviation="6" result="blur1"/>' +
          '<feGaussianBlur stdDeviation="14" result="blur2"/>' +
          '<feMerge>' +
            '<feMergeNode in="blur2"/>' +
            '<feMergeNode in="blur1"/>' +
            '<feMergeNode in="SourceGraphic"/>' +
          '</feMerge>' +
        '</filter>' +
      '</defs>' +
      '<circle class="ring__track" cx="300" cy="300" r="295" />' +
      '<g class="ring__rotor">' +
        '<circle class="ring__active" cx="300" cy="300" r="295" ' +
                'stroke="url(#ringGradientFlow)" filter="url(#ringGlowFlow)" stroke-dasharray="1853.54" ' +
                'stroke-dashoffset="0" transform="rotate(-90 300 300)" />' +
      '</g>' +
    '</svg>' +
    '<div class="ring-panel ring-panel--flow">' +
      '<div class="ring-flow__avatar">👤</div>' +
      '<div class="ring-flow__name">' + nombre + '</div>' +
      '<div id="flujo-status" class="ring-flow__status">Obteniendo ubicación GPS...</div>' +
      '<div class="ring-flow__spinner"></div>' +
    '</div>';

  // 2) Forzar reflow y aplicar data-state="processing" para que la animación arranque
  //    sobre los elementos SVG recién creados (rotor + arco)
  void box.offsetWidth;
  box.setAttribute('data-state', 'processing');

  function setStatus(msg, color) {
    var el = document.getElementById('flujo-status');
    if (el) { el.textContent = msg; if (color) el.style.color = color; }
  }

  function lanzarGPS() {
    if (!navigator.geolocation) {
      _registrarChecada(nombre, idUsuario, null, setStatus);
      return;
    }

    if (!_zonasValidas || _zonasValidas.length === 0) {
      // Intentar leer de localStorage primero (instantáneo)
      try {
        var z = localStorage.getItem('em_zonas_cache');
        if (z) {
          var parsed = JSON.parse(z);
          if (Array.isArray(parsed) && parsed.length > 0) {
            _zonasValidas = parsed;
            obtenerGPS();
            return;
          }
        }
      } catch(e) {}

      // Fallback: pedir a GAS solo si no hay cache
      setStatus('Cargando zonas...', '#94A3B8');
      google.script.run
        .withSuccessHandler(function(res) {
          _zonasValidas = (res && res.zonas) ? res.zonas : [];
          try { localStorage.setItem('em_zonas_cache', JSON.stringify(_zonasValidas)); } catch(e) {}
          obtenerGPS();
        })
        .withFailureHandler(function() { _zonasValidas = []; obtenerGPS(); })
        .getZonasValidas();
    } else {
      obtenerGPS();
    }
  }

  function obtenerGPS() {
    setStatus('Obteniendo ubicación GPS...', '#94A3B8');
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        var precision = Math.round(pos.coords.accuracy);
        var linkMaps = 'https://maps.google.com/?q=' + lat + ',' + lng;
        setStatus('Verificando zona...', '#94A3B8');

        fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&accept-language=es')
          .then(function(r) { return r.json(); })
          .then(function(d) {
            _registrarChecada(nombre, idUsuario, {
              lat: lat, lng: lng, precision: precision,
              direccion: d.display_name || (lat.toFixed(6) + ',' + lng.toFixed(6)),
              linkMaps: linkMaps
            }, setStatus);
          })
          .catch(function() {
            _registrarChecada(nombre, idUsuario, {
              lat: lat, lng: lng, precision: precision,
              direccion: lat.toFixed(6) + ',' + lng.toFixed(6),
              linkMaps: linkMaps
            }, setStatus);
          });
      },
      function() {
        _registrarChecada(nombre, idUsuario, null, setStatus);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  lanzarGPS();
}

function _registrarChecada(nombre, idUsuario, gpsData, setStatus) {
  var ahora = new Date();
  var fecha = ahora.toISOString().substring(0, 10);
  var hora = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  var timestamp = ahora.toLocaleString('es-MX');

  var zonaInfo = gpsData ? verificarZonaChofer(gpsData.lat, gpsData.lng) : { estadoZona: 'SIN_GPS', zonaCercana: '' };

  var datos = {
    idUsuario: idUsuario,
    nombre: nombre,
    fecha: fecha,
    hora: hora,
    timestampCompleto: timestamp,
    lat: gpsData ? gpsData.lat : '',
    lng: gpsData ? gpsData.lng : '',
    direccion: gpsData ? gpsData.direccion : '',
    precision: gpsData ? gpsData.precision : '',
    linkMaps: gpsData ? gpsData.linkMaps : '',
    estadoZona: zonaInfo.estadoZona,
    zonaCercana: zonaInfo.zonaCercana
  };

  // ── Mostrar pantalla de éxito INMEDIATA — no esperar respuesta del GAS ──
  var box = document.getElementById('pin-box');
  if (box) {
    var zonaValida = datos.estadoZona === 'VÁLIDA';
    var colorZona = zonaValida ? '#3ddc84' : '#f4c542';
    var textoZona = zonaValida ? '📍 ' + zonaInfo.zonaCercana : '📍 Fuera de zona';

    box.removeAttribute('data-state');
    box.innerHTML =
      '<svg class="ring" viewBox="0 0 600 600" aria-hidden="true">' +
        '<defs>' +
          '<linearGradient id="ringSuccessFlow" x1="0%" y1="100%" x2="100%" y2="0%">' +
            '<stop offset="0%"  stop-color="#14633e"/>' +
            '<stop offset="100%" stop-color="#3ddc84"/>' +
          '</linearGradient>' +
          '<filter id="ringGlowSuccess" x="-50%" y="-50%" width="200%" height="200%">' +
            '<feGaussianBlur stdDeviation="7" result="blur1"/>' +
            '<feGaussianBlur stdDeviation="18" result="blur2"/>' +
            '<feMerge>' +
              '<feMergeNode in="blur2"/>' +
              '<feMergeNode in="blur1"/>' +
              '<feMergeNode in="SourceGraphic"/>' +
            '</feMerge>' +
          '</filter>' +
        '</defs>' +
        '<circle class="ring__track" cx="300" cy="300" r="295" />' +
        '<g class="ring__rotor">' +
          '<circle class="ring__active" cx="300" cy="300" r="295" ' +
                  'stroke="url(#ringSuccessFlow)" filter="url(#ringGlowSuccess)" stroke-dasharray="1853.54" ' +
                  'stroke-dashoffset="0" transform="rotate(-90 300 300)" />' +
        '</g>' +
      '</svg>' +
      '<div class="ring-panel ring-panel--flow">' +
        '<div class="ring-flow__check">✓</div>' +
        '<div class="ring-flow__title">¡Checada Registrada!</div>' +
        '<div class="ring-flow__name">' + nombre + ' · ' + hora + '</div>' +
        '<div class="ring-flow__zone" style="color:' + colorZona + ';border-color:' + colorZona + ';">' + textoZona + '</div>' +
      '</div>';

    // Forzar reflow para que el flash de success se aplique al nuevo SVG
    void box.offsetWidth;
    box.setAttribute('data-state', 'success');

    // Volver al PIN en 1.5s (antes era countdown de 5s)
    setTimeout(function() { mostrarPantallaPIN(); }, 1500);
  }

  // ── Enviar a GAS en BACKGROUND — no bloquea la pantalla de éxito ──
  // Si falla, se registra en consola pero el usuario ya vio "Registrada"
  google.script.run
    .withSuccessHandler(function(result) {
      if (!result || !result.ok) {
        console.warn('⚠️ guardarChecadaChofer respondió error:', result && result.message);
      }
    })
    .withFailureHandler(function(err) {
      console.warn('⚠️ guardarChecadaChofer falló:', err && err.message);
    })
    .guardarChecadaChofer(datos);
}

// ============================================================================
// MENSAJE DE ERROR — actualiza el anillo a rojo + shake, vuelve a filling
// ============================================================================
function mostrarErrorAcceso(msg) {
  const errEl = document.getElementById('acceso-error');
  if (errEl) {
    errEl.textContent = msg;
    errEl.classList.add('ring-error--visible');
    setTimeout(function() { errEl.classList.remove('ring-error--visible'); }, 3000);
  }

  _setRingState('error');
  const box = document.getElementById('pin-box');
  if (box) {
    box.classList.remove('ring-shake');
    void box.offsetWidth; // reflow para reiniciar animación
    box.classList.add('ring-shake');
  }

  setTimeout(function() {
    var box2 = document.getElementById('pin-box');
    if (!box2) return;
    box2.classList.remove('ring-shake');
    _setRingState('filling');
    _updateRingFromInputs();
  }, 1500);
}

// ============================================================================
// CHECADOR CHOFER DIRECTO — mantenido por compatibilidad
// ============================================================================
function verificarBtnRegistrar() {
  // ya no usada en flujo directo
}
var _streamCamara = null;

// ============================================================================
// PARTÍCULAS DE FONDO
// ============================================================================
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  container.innerHTML = '';
  const isMobile = window.innerWidth <= 768;
  const particleCount = isMobile ? 25 : 50;
  const animations = ['floatOrganic1', 'floatOrganic2', 'floatOrganic3'];
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    const size = 2 + Math.random() * 2;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    const animationType = animations[Math.floor(Math.random() * animations.length)];
    particle.style.animation = animationType + ' ' + (15 + Math.random() * 15) + 's infinite';
    particle.style.animationDelay = Math.random() * 20 + 's';
    particle.style.opacity = 0.6 + Math.random() * 0.4;
    container.appendChild(particle);
  }
}

// ============================================================================
// EJECUTAR CONTROL DE ASISTENCIA
// ============================================================================
function ejecutarControlAsistencia() {
  const btn = document.getElementById('btn-control-asistencia');
  if (!btn) return;

  const mensajesProgreso = [
    { tiempo: 0,  texto: '🚀 Iniciando Control de Asistencia...' },
    { tiempo: 2,  texto: '📋 Limpiando logs anteriores...' },
    { tiempo: 4,  texto: '🔍 Leyendo configuración de turnos...' },
    { tiempo: 8,  texto: '📊 Procesando RAW (Sheet 1/2)...' },
    { tiempo: 15, texto: '📊 Procesando RAW_ADOLFO (Sheet 2/2)...' },
    { tiempo: 22, texto: '⏰ Calculando métricas por empleado...' },
    { tiempo: 30, texto: '📈 Generando métricas diarias...' },
    { tiempo: 38, texto: '📅 Calculando resumen mensual...' },
    { tiempo: 45, texto: '⚠️ Detectando alertas y excepciones...' },
    { tiempo: 52, texto: '💾 Guardando resultados...' },
    { tiempo: 56, texto: '✅ Finalizando proceso...' },
    { tiempo: 60, texto: '✅ Proceso completado exitosamente' }
  ];

  const overlay = document.createElement('div');
  overlay.id = 'progress-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.95);z-index:99998;display:flex;align-items:center;justify-content:center;';

  const modalHTML = document.createElement('div');
  modalHTML.style.cssText = 'background:rgba(30,41,59,0.95);border:2px solid var(--primary);border-radius:16px;padding:48px;max-width:500px;width:90%;text-align:center;';
  modalHTML.innerHTML = '<div style="font-size:64px;margin-bottom:24px;"><i class="fas fa-cog fa-spin" style="color:var(--primary);"></i></div><h2 style="color:var(--text-primary);margin-bottom:12px;font-size:26px;font-weight:700;">Ejecutando Control de Asistencia</h2><div style="background:rgba(51,65,85,0.6);border-radius:12px;height:12px;overflow:hidden;margin:24px 0;"><div id="progress-bar" style="background:linear-gradient(90deg,#3B82F6,#06B6D4,#10B981);height:100%;width:0%;transition:width 0.5s ease;"></div></div><div id="progress-text" style="color:var(--primary);font-size:18px;font-weight:600;margin-bottom:16px;">0%</div><div id="status-text" style="color:var(--text-secondary);font-size:14px;min-height:24px;font-family:Courier New,monospace;">Iniciando...</div>';

  overlay.appendChild(modalHTML);
  document.body.appendChild(overlay);

  const progressBar  = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const statusText   = document.getElementById('status-text');

  let tiempoTranscurrido = 0;
  let indiceMensaje = 0;
  let procesoTerminado = false;

  google.script.run
    .withSuccessHandler(function(raw) {
      const result = safeResult(raw);
      if (result.error === true) { console.error(result.message); return; }
      procesoTerminado = true;
      if (result && result.registros === 0) {
        clearInterval(progressInterval);
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        modalHTML.innerHTML = '<div style="font-size:72px;margin-bottom:24px;"><i class="fas fa-info-circle" style="color:#F59E0B;"></i></div><h2 style="color:#F59E0B;margin-bottom:12px;font-size:28px;font-weight:700;">Sin Datos para Procesar</h2><p style="color:var(--text-secondary);margin-bottom:28px;font-size:15px;">No se encontraron registros en RAW.</p><button id="btn-cerrar-info" style="padding:14px 32px;background:#F59E0B;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Cerrar y Refrescar</button>';
        document.getElementById('btn-cerrar-info').onclick = function() { overlay.remove(); loadDashboard(); };
      }
    })
    .withFailureHandler(function(error) {
      procesoTerminado = true;
      modalHTML.innerHTML = '<div style="font-size:72px;margin-bottom:24px;"><i class="fas fa-exclamation-circle" style="color:var(--danger);"></i></div><h2 style="color:var(--danger);margin-bottom:12px;font-size:28px;font-weight:700;">Error en el Proceso</h2><p style="color:var(--text-secondary);margin-bottom:12px;font-size:15px;">' + error.message + '</p><button id="btn-cerrar-error" style="padding:14px 32px;background:var(--danger);color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Cerrar</button>';
      document.getElementById('btn-cerrar-error').onclick = function() { overlay.remove(); };
    })
    .procesarAsistenciasCompleto();

  const progressInterval = setInterval(function() {
    tiempoTranscurrido++;
    const porcentaje = Math.min(95, (tiempoTranscurrido / 60) * 100);
    progressBar.style.width = porcentaje + '%';
    progressText.textContent = Math.round(porcentaje) + '%';
    if (indiceMensaje < mensajesProgreso.length) {
      if (tiempoTranscurrido >= mensajesProgreso[indiceMensaje].tiempo) {
        statusText.textContent = mensajesProgreso[indiceMensaje].texto;
        indiceMensaje++;
      }
    }
    if (tiempoTranscurrido >= 60 && procesoTerminado) {
      clearInterval(progressInterval);
      progressBar.style.width = '100%';
      progressText.textContent = '100%';
      modalHTML.innerHTML = '<div style="font-size:72px;margin-bottom:24px;"><i class="fas fa-check-circle" style="color:var(--success);"></i></div><h2 style="color:var(--success);margin-bottom:12px;font-size:28px;font-weight:700;">¡Proceso Completado!</h2><p style="color:var(--text-secondary);margin-bottom:28px;font-size:15px;">El control de asistencia se ejecutó correctamente</p><button id="btn-cerrar-exito" style="padding:14px 32px;background:var(--success);color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Cerrar y Refrescar</button>';
      document.getElementById('btn-cerrar-exito').onclick = function() { overlay.remove(); if (!currentModule) loadDashboard(); };
    }
  }, 1000);
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
  if (localStorage.getItem('theme') === 'girly') {
    document.body.classList.add('girly-mode');
  }
  mostrarPantallaPIN();
});

// ============================================================================
// EXPORTAR PDF
// ============================================================================
function exportarResumenAPDF() {
  const elemento = document.getElementById('resumen-mensual-contenido');
  if (!elemento) { alert('❌ No se encontró el contenido para exportar'); return; }
  const btnExportar = event.target.closest('button');
  const textoOriginal = btnExportar.innerHTML;
  btnExportar.disabled = true;
  btnExportar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando PDF...';
  const opt = {
    margin: [10, 10, 10, 10],
    filename: 'Resumen_Mensual_' + new Date().toISOString().split('T')[0] + '.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2.1, useCORS: true, logging: false, backgroundColor: '#0F172A' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };
  html2pdf().set(opt).from(elemento).save()
    .then(() => { btnExportar.disabled = false; btnExportar.innerHTML = textoOriginal; })
    .catch(err => { alert('Error al generar PDF'); btnExportar.disabled = false; btnExportar.innerHTML = textoOriginal; });
}

// ============================================================================
// MÓVIL
// ============================================================================
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const btn = document.getElementById('mobile-menu-btn');
  if (!sidebar) return;
  const isOpen = sidebar.classList.contains('active');
  sidebar.classList.toggle('active');
  if (btn) btn.innerHTML = isOpen ? '<i class="fas fa-bars"></i>' : '<i class="fas fa-times"></i>';
}

function ajustarGaugesMobile() {
  if (window.innerWidth > 768) return;
  document.querySelectorAll('#kpi-hoy-display,#kpi-faltas-display,#kpi-vacaciones-display,#kpi-retardos-display,#kpi-incidencias-display').forEach(el => {
    el.style.fontSize = '22px'; el.style.margin = '2px 0';
  });
  document.querySelectorAll('#percentage-hoy,#percentage-faltas,#percentage-vacaciones,#percentage-retardos,#percentage-incidencias').forEach(el => {
    el.style.fontSize = '11px'; el.style.bottom = '-14px';
  });
  document.querySelectorAll('#needle-hoy,#needle-faltas,#needle-vacaciones,#needle-retardos,#needle-incidencias').forEach(el => {
    el.style.height = '13px'; el.style.width = '2px'; el.style.bottom = '3px';
  });
  ['hoy','faltas','vacaciones','retardos','incidencias'].forEach(id => {
    const needle = document.getElementById('needle-' + id);
    if (needle && needle.parentElement) {
      needle.parentElement.style.width = '80px';
      needle.parentElement.style.height = '46px';
    }
  });
}

function forzarDosColumnasMovil() {
  const grid = document.querySelector('.gauges-grid');
  if (!grid) return;
  if (window.innerWidth <= 768) {
    grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    grid.style.gap = '6px';
    grid.querySelectorAll('.kpi-card').forEach(card => {
      card.style.padding = '8px 4px';
      card.style.minHeight = 'unset';
      card.style.overflow = 'hidden';
    });
  }
}
