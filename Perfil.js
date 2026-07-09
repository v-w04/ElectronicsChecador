// ============================================================================
// PERFIL PERSONAL — Panel del empleado (Fase 2)
// ============================================================================
// Se abre desde el botón "Mi Perfil" en la pantalla del PIN.
// Reutiliza los helpers de WebApp.js: _calcularVeredicto, _registrarChecadaLocal,
// _checadasHoyDe, _turnoDe, _enviarOEncolarChecada, _ETIQUETAS_TIPO, _usuariosCache.
//
// Funciones:
//   - Login de perfil con PIN + contraseña (validación local)
//   - Sesión persistente OPCIONAL (checkbox "mantener sesión") para celulares
//   - 6 botones de checada manual (el empleado elige el tipo)
//   - Estado del día (checadas de hoy con hora)
//   - Cronómetros en vivo: desayuno, comida, tiempo regalado post-turno
//   - Historial de últimos 7 días (del backend)
//   - Auto-cierre a los 60s de inactividad si NO marcó "mantener sesión"
// ============================================================================

var _PERFIL_LS_SESION = 'em_perfil_sesion';
var _perfilTimerInactividad = null;
var _perfilTimerCrono = null;

// ── Sesión ──────────────────────────────────────────────────────────────────
// ⭐ Solo la sesión PERSISTENTE (checkbox marcado) se guarda en localStorage.
// La sesión temporal (tablet) vive únicamente en memoria: se pierde al
// recargar la página, al cerrar sesión o a los 60s de inactividad.
function _perfilGuardarSesion(usuario, persistente) {
  var sesion = {
    pin: usuario.pin,
    idUsuario: usuario.idUsuario,
    nombre: usuario.nombre,
    turnoHorario: usuario.turnoHorario || '',
    persistente: !!persistente,
    ts: Date.now()
  };
  if (persistente) {
    try { localStorage.setItem(_PERFIL_LS_SESION, JSON.stringify(sesion)); } catch(e) {}
  } else {
    window._perfilSesionTemp = sesion;
  }
}

function _perfilLeerSesion() {
  if (window._perfilSesionTemp) return window._perfilSesionTemp;
  try {
    var raw = localStorage.getItem(_PERFIL_LS_SESION);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}

function _perfilCerrarSesion() {
  // ⭐ Desvincular este dispositivo de las notificaciones push
  if (typeof PushNotifications !== 'undefined') {
    PushNotifications.eliminar();
  }
  window._perfilSesionTemp = null;
  try { localStorage.removeItem(_PERFIL_LS_SESION); } catch(e) {}
  _perfilDetenerTimers();
  var overlay = document.getElementById('perfil-overlay');
  if (overlay) overlay.remove();
  var login = document.getElementById('perfil-login-overlay');
  if (login) login.remove();
  mostrarPantallaPIN();
}

function _perfilDetenerTimers() {
  if (_perfilTimerInactividad) { clearTimeout(_perfilTimerInactividad); _perfilTimerInactividad = null; }
  if (_perfilTimerCrono) { clearInterval(_perfilTimerCrono); _perfilTimerCrono = null; }
}

// ── Punto de entrada: botón "Mi Perfil" ─────────────────────────────────────

// ── MODO PERFIL — se activa sobre la MISMA pantalla del PIN ─────────────────
// Al tocar "Mi Perfil": el fondo cambia a tono violeta, el anillo vira a
// púrpura y aparece el checkbox "mantener sesión". El empleado usa LOS MISMOS
// inputs grandes de PIN y contraseña; al validar, entra al perfil en lugar
// de checar. Sin popups nuevos.

function abrirLoginPerfil() {
  // Entrar directo SOLO si la sesión fue marcada "mantener en este dispositivo".
  // Las sesiones no persistentes (tablet) nunca reviven: siempre piden PIN.
  var sesion = _perfilLeerSesion();
  if (sesion && sesion.pin && sesion.persistente) {
    abrirPerfil(sesion);
    return;
  }
  if (sesion && !sesion.persistente) {
    // Sesión huérfana de tablet (quedó guardada si cerraron la pestaña
    // antes del auto-cierre) → limpiarla
    try { localStorage.removeItem(_PERFIL_LS_SESION); } catch(e) {}
  }
  if (window._modoPerfil) desactivarModoPerfil();
  else activarModoPerfil();
}

function activarModoPerfil() {
  window._modoPerfil = true;
  var box = document.getElementById('pin-box');
  var btn = document.getElementById('btn-mi-perfil');

  // ⭐ Solo el DISCO CENTRAL cambia a violeta (el fondo y el anillo se quedan)
  var panel = box ? box.querySelector('.ring-panel') : null;
  if (panel) {
    panel.style.transition = 'background 0.4s ease, box-shadow 0.4s ease';
    panel.style.background = 'radial-gradient(circle at 50% 35%, #4c3a8f 0%, #2e2358 55%, #1a1436 100%)';
    panel.style.boxShadow = 'inset 0 0 0 1px rgba(167,139,250,0.35), inset 0 20px 60px rgba(0,0,0,0.45), 0 0 40px rgba(139,92,246,0.18)';
  }

  if (btn) {
    btn.innerHTML = '✕ Cancelar';
    btn.style.color = '#C4B5FD';
    btn.style.borderColor = 'rgba(167,139,250,0.45)';
  }

  // Etiqueta MODO PERFIL
  var overlay = document.getElementById('pin-overlay');
  var tag = document.getElementById('perfil-mode-tag');
  if (!tag && overlay) {
    tag = document.createElement('div');
    tag.id = 'perfil-mode-tag';
    tag.innerHTML = '👤 MODO PERFIL — entra con tu PIN y contraseña';
    tag.style.cssText =
      'position:fixed;top:calc(66px + env(safe-area-inset-top, 0px));left:50%;transform:translateX(-50%);z-index:100000;' +
      'padding:9px 20px;border-radius:999px;background:rgba(76,58,143,0.4);color:#DDD6FE;' +
      'border:1px solid rgba(167,139,250,0.4);font-size:13px;font-weight:700;letter-spacing:1px;' +
      'backdrop-filter:blur(8px);white-space:nowrap;';
    overlay.appendChild(tag);
  }

  // ⭐ Botón "Registrar en este dispositivo" a la DERECHA del disco central.
  // Es un interruptor: encendido = la sesión queda guardada en el dispositivo.
  var kb = document.getElementById('perfil-keep-btn');
  if (!kb && box) {
    kb = document.createElement('button');
    kb.id = 'perfil-keep-btn';
    kb.type = 'button';
    kb.dataset.on = '0';
    kb.innerHTML = '📱 Registrar en<br>este dispositivo';
    kb.style.cssText =
      'position:absolute;top:50%;left:calc(50% + 30%);transform:translateY(-50%);z-index:6;' +
      'padding:12px 14px;border-radius:12px;background:rgba(30,27,75,0.75);color:#A5B4FC;' +
      'border:1px solid rgba(167,139,250,0.3);font-size:12px;font-weight:700;line-height:1.35;' +
      'cursor:pointer;backdrop-filter:blur(6px);text-align:center;transition:all 0.2s;max-width:130px;';
    kb.onclick = function(e) {
      e.preventDefault();
      var on = kb.dataset.on === '1';
      kb.dataset.on = on ? '0' : '1';
      if (!on) {
        kb.style.background = 'linear-gradient(135deg,#6d28d9,#8b5cf6)';
        kb.style.color = '#fff';
        kb.style.borderColor = 'rgba(196,181,253,0.6)';
        kb.innerHTML = '✅ Se guardará en<br>este dispositivo';
      } else {
        kb.style.background = 'rgba(30,27,75,0.75)';
        kb.style.color = '#A5B4FC';
        kb.style.borderColor = 'rgba(167,139,250,0.3)';
        kb.innerHTML = '📱 Registrar en<br>este dispositivo';
      }
      var ip = document.getElementById('input-pin');
      if (ip && !ip.value) ip.focus();
    };
    box.appendChild(kb);
  }

  // Mostrar el campo de contraseña (oculto en el flujo rápido de solo PIN)
  var campoPass = document.getElementById('campo-contrasena-wrap');
  if (campoPass) campoPass.style.visibility = 'visible';

  // Focus inmediato en el PIN
  var inputPin = document.getElementById('input-pin');
  if (inputPin) { inputPin.value = ''; inputPin.focus(); }
}

function desactivarModoPerfil() {
  window._modoPerfil = false;
  var box = document.getElementById('pin-box');
  var btn = document.getElementById('btn-mi-perfil');

  var panel = box ? box.querySelector('.ring-panel') : null;
  if (panel) { panel.style.background = ''; panel.style.boxShadow = ''; }

  if (btn) {
    btn.innerHTML = '👤 Mi Perfil';
    btn.style.color = '#94A3B8';
    btn.style.borderColor = 'rgba(255,255,255,0.1)';
  }
  var campoPass = document.getElementById('campo-contrasena-wrap');
  if (campoPass) campoPass.style.visibility = 'hidden';
  var inputPass = document.getElementById('input-contrasena');
  if (inputPass) inputPass.value = '';

  var tag = document.getElementById('perfil-mode-tag');
  if (tag) tag.remove();
  var kb = document.getElementById('perfil-keep-btn');
  if (kb) kb.remove();
  var keep = document.getElementById('perfil-keep-wrap');
  if (keep) keep.remove();
}

// ── Panel principal del perfil ──────────────────────────────────────────────
function abrirPerfil(sesion) {
  _perfilDetenerTimers();
  var viejo = document.getElementById('perfil-overlay');
  if (viejo) viejo.remove();

  var overlay = document.createElement('div');
  overlay.id = 'perfil-overlay';
  // Usa el mismo fondo del login del sistema (--lr-bg-page)
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:100001;overflow-y:auto;' +
    'background:radial-gradient(circle at 50% 50%, #0e1d3a 0%, #050b18 100%);' +
    'font-family:\'Inter\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;';

  // ⭐ Avatar REAL del sistema (Avatares.js) — el mismo que usa el dashboard,
  // respetando los overrides configurados. Fallback a inicial si no está.
  var avatarHtml;
  if (typeof crearAvatarElement === 'function') {
    avatarHtml = crearAvatarElement(sesion.nombre, 56);
  } else {
    var inicial = (sesion.nombre || '?').trim().charAt(0).toUpperCase();
    avatarHtml = '<div style="width:56px;height:56px;border-radius:50%;background:var(--primary,#3B82F6);' +
                 'display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#fff;">' +
                 inicial + '</div>';
  }

  overlay.innerHTML =
    '<div style="max-width:640px;margin:0 auto;padding:24px 18px 70px;">' +

      // Header con avatar del sistema
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">' +
        '<div style="display:flex;align-items:center;gap:14px;">' +
          '<div id="perfil-avatar-wrap" style="flex-shrink:0;border-radius:50%;border:2px solid rgba(80,150,220,0.25);' +
                 'box-shadow:0 0 16px rgba(30,144,255,0.25);line-height:0;">' + avatarHtml + '</div>' +
          '<div>' +
            '<div class="perfil-nombre" style="font-size:21px;font-weight:800;color:var(--text-primary,#F1F5F9);letter-spacing:-0.3px;line-height:1.2;">' + sesion.nombre + '</div>' +
            '<div style="font-size:14px;color:var(--text-secondary,#94A3B8);margin-top:3px;font-weight:600;">' +
              (sesion.turnoHorario ? '🕐 ' + sesion.turnoHorario : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          // ⭐ Recargar: suelta el cache de usuarios/turnos y recarga la app.
          // Necesario cuando cambian horarios en TURNOS_DEFAULT (en iOS no hay
          // "deslizar para recargar" como en Android).
          '<button id="perfil-btn-recargar" onclick="_perfilRecargarTodo()" title="Recargar turnos y horarios" ' +
                  'style="padding:10px 13px;background:transparent;color:#7fdfff;border:1px solid rgba(127,223,255,0.35);' +
                         'border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;line-height:1;">↻</button>' +
          '<button onclick="_perfilCerrarSesion()" ' +
                  'style="padding:10px 18px;background:transparent;color:var(--danger,#EF4444);border:1px solid rgba(239,68,68,0.35);' +
                         'border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">' +
            'Cerrar sesión' +
          '</button>' +
        '</div>' +
      '</div>' +

      // Banner de notificaciones (activar / estado)
      '<div id="perfil-push-banner" style="margin-bottom:18px;"></div>' +

      // Cronómetro activo (se llena dinámicamente)
      '<div id="perfil-crono" style="display:none;margin-bottom:18px;"></div>' +

      // Veredicto de la última checada desde el perfil
      '<div id="perfil-veredicto" style="display:none;margin-bottom:18px;"></div>' +

      // ── 1. Excepciones del día ──
      '<div style="font-size:12px;color:var(--text-secondary,#94A3B8);text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:6px;">Hoy no trabajo</div>' +
      '<div style="font-size:12px;color:#64748B;margin-bottom:12px;">Marca el día y la app no te manda alertas.</div>' +
      '<div id="perfil-excepciones" style="margin-bottom:28px;"></div>' +

      // ── 2. Desglose de HOY ──
      '<div style="font-size:12px;color:var(--text-secondary,#94A3B8);text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:12px;">Hoy</div>' +
      '<div id="perfil-hoy" style="margin-bottom:28px;">' +
        '<div style="color:#64748B;font-size:14px;font-style:italic;padding:8px 0;">Cargando...</div>' +
      '</div>' +

      // ── 3. Quincena (colapsable, cerrada de inicio) ──
      _secColapsable('sec-quincena', '📆 Mis checadas por quincena',
        '<div id="perfil-quincena-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"></div>' +
        '<div id="perfil-historial">' +
          '<div style="color:#64748B;font-size:14px;font-style:italic;padding:8px 0;">Cargando...</div>' +
        '</div>') +

      // ── 4. Mis alertas (colapsable) ──
      _secColapsable('sec-alertas', '🔔 Mis alertas y dispositivos',
        '<div id="perfil-alertas">' +
          '<div style="color:#64748B;font-size:14px;font-style:italic;padding:8px 0;">Cargando...</div>' +
        '</div>') +

      // ── 5. Checada manual (colapsable, hasta el fondo) ──
      _secColapsable('sec-manual', '🆘 Checada manual',
        '<div style="font-size:12px;color:#64748B;margin-bottom:12px;">Solo para emergencias — lo normal es checar en la tablet con tu PIN.</div>' +
        '<div id="perfil-botones" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"></div>') +

    '</div>';
  document.body.appendChild(overlay);

  _perfilPintarBotones(sesion);
  _perfilCargarDatos(sesion);
  _perfilCargarAlertas(sesion);
  _perfilCargarExcepciones(sesion);
  _perfilCargarQuincena(sesion, 0);

  // ⭐ Notificaciones push: pedir el permiso REQUIERE un gesto del usuario
  // (Chrome silencia los prompts automáticos y iOS ni los muestra), así que
  // según el estado se pinta un banner con botón o se registra directo.
  _perfilInicializarPush(sesion);
  _perfilIniciarCrono(sesion);

  // ⭐ Cargar overrides de avatar si aún no están (el avatar se repinta al llegar)
  if (navigator.onLine !== false && typeof cargarAvatarOverrides === 'function' &&
      (!window._avatarOverrides || Object.keys(window._avatarOverrides).length === 0)) {
    cargarAvatarOverrides(function() {
      var wrap = document.getElementById('perfil-avatar-wrap');
      if (wrap && typeof crearAvatarElement === 'function') {
        wrap.innerHTML = crearAvatarElement(sesion.nombre, 56);
      }
    });
  }

  // ── Auto-cierre por inactividad (solo sesiones NO persistentes) ──────────
  // Sistema por timestamp: un vigilante revisa cada 5s cuánto tiempo pasó
  // desde la última interacción REAL (click/touch/tecla). No usamos 'scroll'
  // porque el re-render del cronómetro cada segundo puede disparar eventos
  // scroll fantasma que mantendrían la sesión abierta para siempre.
  if (!sesion.persistente) {
    window._perfilUltimaActividad = Date.now();
    var marcar = function() { window._perfilUltimaActividad = Date.now(); };
    overlay.addEventListener('click', marcar);
    overlay.addEventListener('touchstart', marcar);
    overlay.addEventListener('keydown', marcar);

    _perfilTimerInactividad = setInterval(function() {
      // Si el overlay ya no existe, detener el vigilante
      if (!document.getElementById('perfil-overlay')) {
        clearInterval(_perfilTimerInactividad);
        _perfilTimerInactividad = null;
        return;
      }
      if (Date.now() - window._perfilUltimaActividad > 60000) {
        console.log('⏲️ Perfil cerrado por inactividad (60s sin interacción)');
        _perfilCerrarSesion();
      }
    }, 5000);
  }
}

// ── Botones de checada manual ───────────────────────────────────────────────
function _perfilPintarBotones(sesion) {
  var cont = document.getElementById('perfil-botones');
  if (!cont) return;

  var botones = [
    { tipo: 'ENTRADA',          emoji: '🏢', label: 'Entrada',            color: '#3B82F6' },
    { tipo: 'SALIDA_DESAYUNO',  emoji: '🥐', label: 'Desayuno',           color: '#F59E0B' },
    { tipo: 'REGRESO_DESAYUNO', emoji: '↩️', label: 'Regreso desayuno',   color: '#F59E0B' },
    { tipo: 'SALIDA_COMIDA',    emoji: '🍽️', label: 'Comida',             color: '#EC4899' },
    { tipo: 'REGRESO_COMIDA',   emoji: '↩️', label: 'Regreso comida',     color: '#EC4899' },
    { tipo: 'SALIDA',           emoji: '🏠', label: 'Salida',             color: '#10B981' }
  ];

  cont.innerHTML = botones.map(function(b) {
    return (
      '<button onclick="_perfilChecar(\'' + b.tipo + '\')" ' +
              'onpointerdown="this.style.transform=\'scale(0.96)\'" onpointerup="this.style.transform=\'\'" onpointerleave="this.style.transform=\'\'" ' +
              'style="padding:22px 12px;background:linear-gradient(180deg,#142340 0%,#0c1729 100%);border:1.5px solid ' + b.color + '55;' +
                     'border-radius:16px;cursor:pointer;text-align:center;transition:all 0.12s;color:#F1F5F9;">' +
        '<div style="font-size:32px;margin-bottom:8px;line-height:1;">' + b.emoji + '</div>' +
        '<div style="font-size:15px;font-weight:800;letter-spacing:-0.2px;">' + b.label + '</div>' +
      '</button>'
    );
  }).join('');
}

// ── Registrar checada desde el perfil (tipo explícito) ──────────────────────
function _perfilChecar(tipo) {
  var sesion = _perfilLeerSesion();
  if (!sesion) return;

  var ahora = new Date();
  var TZ_MEX = 'America/Mexico_City';
  var fecha = ahora.toLocaleDateString('en-CA', { timeZone: TZ_MEX });
  var hora  = ahora.toLocaleTimeString('es-MX', { timeZone: TZ_MEX, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  var timestamp = ahora.toLocaleString('es-MX', { timeZone: TZ_MEX });

  var uuid = (window.OfflineQueue && OfflineQueue.generarUuid)
    ? OfflineQueue.generarUuid()
    : (Date.now() + '-' + Math.random().toString(36).substr(2, 9));

  var datos = {
    uuid: uuid,
    idUsuario: sesion.idUsuario,
    nombre: sesion.nombre,
    fecha: fecha,
    hora: hora,
    timestampCompleto: timestamp,
    clienteTimestamp: ahora.toISOString(),
    tipo: tipo, // el empleado lo eligió — se respeta
    lat: '', lng: '', accuracy: '',
    estadoZona: 'VÁLIDA', zonaCercana: '', distancia: 0
  };

  var etiqueta = _ETIQUETAS_TIPO[tipo] || _ETIQUETAS_TIPO['EXTRA'];
  var box = document.getElementById('perfil-veredicto');

  function pintarBanner(veredicto, horaMostrar) {
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML =
      '<div style="background:rgba(255,255,255,0.04);border:1px solid ' + veredicto.color + '55;border-left:5px solid ' + veredicto.color + ';' +
             'border-radius:12px;padding:16px 18px;">' +
        '<div style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;font-weight:700;">' +
          etiqueta.emoji + ' ' + etiqueta.label + ' · ' + horaMostrar.substring(0, 5) +
        '</div>' +
        '<div style="font-size:17px;font-weight:800;color:' + veredicto.color + ';margin-top:4px;">' + veredicto.texto + '</div>' +
        (veredicto.detalle ? '<div style="font-size:13px;color:#CBD5E1;margin-top:4px;">' + veredicto.detalle + '</div>' : '') +
      '</div>';
  }

  var online = navigator.onLine !== false;

  if (online && window.google && google.script && google.script.run) {
    // ⭐ EL SHEET ES LA LEY: el veredicto lo calcula el backend con las
    // checadas reales de CHECADOR_CHOFERES.
    if (box) {
      box.style.display = 'block';
      box.innerHTML = '<div style="padding:14px;color:#64748B;font-size:13px;font-style:italic;">Registrando ' + etiqueta.label.toLowerCase() + '...</div>';
    }
    google.script.run
      .withSuccessHandler(function(result) {
        if (result && result.ok && result.veredicto) {
          // Sincronizar local con el servidor
          try {
            var data = _leerChecadasDia();
            var key = _normId(sesion.idUsuario);
            data.porUsuario[key] = (result.checadasHoyServidor || []).map(function(c) {
              var ts = new Date(c.fecha + 'T' + c.hora).getTime();
              return { tipo: c.tipo, ts: isNaN(ts) ? Date.now() : ts };
            });
            localStorage.setItem(_LS_KEY_CHECADAS_DIA, JSON.stringify(data));
          } catch(e) {}
          pintarBanner(result.veredicto, result.horaServidor || hora);
        } else {
          pintarBanner({ texto: '⚠️ No se pudo registrar', color: '#ef4444',
                         detalle: (result && result.message) || 'Intenta de nuevo' }, hora);
        }
        _perfilPintarHoyLocal(sesion);
        _perfilIniciarCrono(sesion);
      })
      .withFailureHandler(function() {
        // Backend caído → fallback local + encolar
        var veredicto = _calcularVeredicto(tipo, sesion.idUsuario, ahora);
        _registrarChecadaLocal(sesion.idUsuario, tipo, ahora.getTime());
        if (window.OfflineQueue) OfflineQueue.encolar(datos).catch(function() {});
        pintarBanner(veredicto, hora);
        _perfilPintarHoyLocal(sesion);
        _perfilIniciarCrono(sesion);
      })
      .guardarChecadaChofer(datos);
  } else {
    // OFFLINE: cálculo local + cola
    var veredicto = _calcularVeredicto(tipo, sesion.idUsuario, ahora);
    _registrarChecadaLocal(sesion.idUsuario, tipo, ahora.getTime());
    _enviarOEncolarChecada(datos);
    pintarBanner(veredicto, hora);
    _perfilPintarHoyLocal(sesion);
    _perfilIniciarCrono(sesion);
  }
}

// ── Cargar datos del backend (checadas de hoy + historial) ──────────────────
function _perfilCargarDatos(sesion) {
  // Pintar de inmediato lo local (funciona offline)
  _perfilPintarHoyLocal(sesion);

  if (navigator.onLine === false) {
    var hist = document.getElementById('perfil-historial');
    if (hist) hist.innerHTML = '<div style="color:#475569;font-size:13px;font-style:italic;">📡 Sin internet — historial no disponible</div>';
    return;
  }

  google.script.run
    .withSuccessHandler(function(result) {
      if (!result || !result.ok) return;

      // ── Sincronizar registro local con el backend ──
      // El BACKEND es la fuente de verdad SIEMPRE que no haya checadas
      // offline pendientes de enviar. Así, si el admin borra filas de
      // CHECADOR_CHOFERES, el dispositivo se limpia solo al abrir el perfil.
      // (Si hay cola offline pendiente, se conserva lo local hasta que
      // sincronice, para no perder la detección de tipo.)
      function aplicarMerge(pendientes) {
        try {
          var data = _leerChecadasDia();
          var key = _normId(sesion.idUsuario);
          var delBackend = (result.checadasHoy || []).map(function(c) {
            var ts = new Date(c.fecha + 'T' + c.hora).getTime();
            return { tipo: c.tipo, ts: isNaN(ts) ? Date.now() : ts };
          });
          if (pendientes === 0) {
            // Sin cola → backend manda (aunque tenga menos o cero checadas)
            data.porUsuario[key] = delBackend;
            localStorage.setItem(_LS_KEY_CHECADAS_DIA, JSON.stringify(data));
          } else if (delBackend.length >= (data.porUsuario[key] || []).length) {
            data.porUsuario[key] = delBackend;
            localStorage.setItem(_LS_KEY_CHECADAS_DIA, JSON.stringify(data));
          }
        } catch(e) {}
        _perfilPintarHoyLocal(sesion);
        _perfilIniciarCrono(sesion);
        }

      if (window.OfflineQueue && OfflineQueue.contar) {
        OfflineQueue.contar().then(aplicarMerge).catch(function() { aplicarMerge(1); });
      } else {
        aplicarMerge(0);
      }
    })
    .withFailureHandler(function() {
      var hist = document.getElementById('perfil-historial');
      if (hist) hist.innerHTML = '<div style="color:#475569;font-size:13px;font-style:italic;">No se pudo cargar el historial</div>';
    })
    .getPerfilEmpleado(sesion.pin);
}

// ── Pintar checadas de HOY (desde registro local) ───────────────────────────


// ── Historial de 7 días ─────────────────────────────────────────────────────

// ── CRONÓMETROS EN VIVO ─────────────────────────────────────────────────────
// Decide qué cronómetro corre según el estado del día:
//   - Última checada = SALIDA_DESAYUNO sin regreso → cuenta desayuno (20 min)
//   - Última checada = SALIDA_COMIDA sin regreso  → cuenta comida (60 min)
//   - Turno terminó y no hay SALIDA hoy           → cuenta tiempo regalado
function _perfilIniciarCrono(sesion) {
  if (_perfilTimerCrono) { clearInterval(_perfilTimerCrono); _perfilTimerCrono = null; }
  _perfilActualizarCrono(sesion);
  _perfilTimerCrono = setInterval(function() { _perfilActualizarCrono(sesion); }, 1000);
}

function _perfilActualizarCrono(sesion) {
  var box = document.getElementById('perfil-crono');
  if (!box) { _perfilDetenerTimers(); return; }

  var checadas = _checadasHoyDe(sesion.idUsuario);
  var ultima = checadas.length ? checadas[checadas.length - 1] : null;
  var ahora = new Date();

  function fmt(seg) {
    var h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
    return (h > 0 ? String(h).padStart(2, '0') + ':' : '') +
           String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // 1) ¿En desayuno o comida sin regresar? → CUENTA REGRESIVA: parte del
  // límite (25:00) hacia 00:00; al pasarse muestra el exceso como −MM:SS.
  if (ultima && (ultima.tipo === 'SALIDA_DESAYUNO' || ultima.tipo === 'SALIDA_COMIDA')) {
    var esDes = ultima.tipo === 'SALIDA_DESAYUNO';
    var limMin = esDes ? _durDesayunoDe(sesion.idUsuario) : _durComidaDe(sesion.idUsuario);
    var trans = Math.floor((ahora.getTime() - ultima.ts) / 1000);
    var limSeg = limMin * 60;
    var resta = limSeg - trans;             // >0: tiempo que queda · <0: exceso
    var excedido = resta < 0;
    var color = excedido ? '#EF4444' : (resta <= 300 ? '#F59E0B' : '#3B82F6');
    var titulo = esDes ? '🥐 Desayuno en curso' : '🍽️ Comida en curso';
    var display = (excedido ? '−' : '') + fmt(Math.abs(resta));

    box.style.display = 'block';
    box.innerHTML =
      '<div style="background:linear-gradient(180deg,#142340 0%,#0c1729 100%);border:1px solid ' + color + '55;border-radius:14px;padding:18px;text-align:center;">' +
        '<div style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">' + titulo + '</div>' +
        '<div style="font-size:38px;font-weight:800;color:' + color + ';font-variant-numeric:tabular-nums;margin:6px 0 2px;">' + display + '</div>' +
        '<div style="font-size:13px;color:#CBD5E1;">' +
          (excedido
            ? '❌ Exceso — checa tu regreso YA'
            : 'de ' + limMin + ' min · regresa antes de que llegue a 0') +
        '</div>' +
      '</div>';
    return;
  }

  // 2) ¿Turno terminado sin checar salida? → tiempo regalado
  var turno = _turnoDe(sesion.idUsuario);
  var yaSalio = checadas.some(function(c) { return c.tipo === 'SALIDA'; });
  if (turno && !yaSalio && checadas.length > 0) {
    var finMs = new Date();
    finMs.setHours(turno.fin.h, turno.fin.m, 0, 0);
    if (ahora.getTime() > finMs.getTime()) {
      var reg = Math.floor((ahora.getTime() - finMs.getTime()) / 1000);
      box.style.display = 'block';
      box.innerHTML =
        '<div style="background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.4);border-radius:14px;padding:18px;text-align:center;">' +
          '<div style="font-size:12px;color:#FBBF24;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">⏱️ Tiempo extra (no se paga)</div>' +
          '<div style="font-size:38px;font-weight:800;color:#FBBF24;font-variant-numeric:tabular-nums;margin:6px 0 2px;">' + fmt(reg) + '</div>' +
          '<div style="font-size:13px;color:#CBD5E1;">Checa tu salida.</div>' +
        '</div>';
      return;
    }
  }

  // 3) Nada activo → ocultar
  box.style.display = 'none';
}

console.log('✅ Perfil módulo cargado');

// ── MIS ALERTAS — preferencias por empleado ─────────────────────────────────
// Toggles para activar/desactivar cada categoría de alertas push.
// Se guardan en la hoja PREFS_ALERTAS; el motor las respeta al minuto.
var _PERFIL_CATS_ALERTAS = [
  { key: 'entrada',  emoji: '🏢', label: 'Entrada',  desc: 'Aviso 15 min antes y al momento de tu hora (bono)' },
  { key: 'desayuno', emoji: '🥐', label: 'Desayuno', desc: 'Aviso antes del exceso y recordatorios' },
  { key: 'comida',   emoji: '🍽️', label: 'Comida',   desc: 'Aviso antes del exceso y recordatorios' },
  { key: 'salida',   emoji: '🏠', label: 'Salida',   desc: 'Aviso antes de tu hora y tiempo extra' }
];

function _perfilCargarAlertas(sesion) {
  var cont = document.getElementById('perfil-alertas');
  if (!cont) return;

  if (navigator.onLine === false) {
    cont.innerHTML = '<div style="color:#64748B;font-size:13px;font-style:italic;">📡 Sin internet — configura tus alertas cuando haya conexión</div>';
    return;
  }

  google.script.run
    .withSuccessHandler(function(result) {
      if (!result || !result.ok) {
        cont.innerHTML = '<div style="color:#64748B;font-size:13px;font-style:italic;">No se pudieron cargar tus alertas</div>';
        return;
      }
      window._perfilPrefs = result.prefs;
      _perfilPintarAlertas(sesion);
    })
    .withFailureHandler(function() {
      cont.innerHTML = '<div style="color:#64748B;font-size:13px;font-style:italic;">No se pudieron cargar tus alertas</div>';
    })
    .getPrefsAlertas(sesion.pin);
}

function _perfilPintarAlertas(sesion) {
  var cont = document.getElementById('perfil-alertas');
  if (!cont) return;
  var prefs = window._perfilPrefs || { entrada: 'SI', desayuno: 'SI', comida: 'SI', salida: 'SI' };
  var todasActivas = _PERFIL_CATS_ALERTAS.every(function(c) { return prefs[c.key] !== 'NO'; });

  function toggleHtml(activo, onclickJs) {
    return '<div onclick="' + onclickJs + '" ' +
           'style="width:48px;height:27px;border-radius:999px;cursor:pointer;flex-shrink:0;position:relative;transition:background 0.2s;' +
                  'background:' + (activo ? 'var(--primary,#3B82F6)' : 'rgba(255,255,255,0.12)') + ';">' +
             '<div style="position:absolute;top:3px;' + (activo ? 'right:3px;' : 'left:3px;') +
                    'width:21px;height:21px;border-radius:50%;background:#fff;transition:all 0.2s;"></div>' +
           '</div>';
  }

  var html =
    // Master
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;margin-bottom:8px;' +
           'background:linear-gradient(180deg,#142340 0%,#0c1729 100%);border-radius:12px;border:1px solid rgba(80,150,220,0.18);">' +
      '<div>' +
        '<div style="font-size:15px;font-weight:800;color:var(--text-primary,#F1F5F9);">Todas las alertas</div>' +
        '<div style="font-size:12px;color:#64748B;margin-top:2px;">Activa o apaga todo de un golpe</div>' +
      '</div>' +
      toggleHtml(todasActivas, '_perfilToggleTodas()') +
    '</div>';

  _PERFIL_CATS_ALERTAS.forEach(function(c) {
    var activo = prefs[c.key] !== 'NO';
    html +=
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;margin-bottom:6px;' +
             'background:linear-gradient(180deg,#142340 0%,#0c1729 100%);border-radius:12px;border:1px solid rgba(80,150,220,0.1);' +
             (activo ? '' : 'opacity:0.55;') + '">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:14px;font-weight:700;color:var(--text-primary,#F1F5F9);">' + c.emoji + ' ' + c.label + '</div>' +
          '<div style="font-size:12px;color:#64748B;margin-top:2px;">' + c.desc + '</div>' +
        '</div>' +
        toggleHtml(activo, '_perfilToggleAlerta(\'' + c.key + '\')') +
      '</div>';
  });

  html += '<div id="perfil-dispositivos" style="margin-top:14px;"></div>';
  html += '<button onclick="_perfilTestPush()" ' +
          'style="width:100%;margin-top:8px;padding:13px;background:transparent;color:#7fdfff;' +
                 'border:1px solid rgba(127,223,255,0.4);border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">' +
    '🔔 Enviar notificación de PRUEBA ahora' +
  '</button>';
  html += '<button onclick="_perfilDiagAlertas()" ' +
          'style="width:100%;margin-top:8px;padding:11px;background:transparent;color:#94A3B8;' +
                 'border:1px solid rgba(255,255,255,0.14);border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;">' +
    '🩺 ¿Por qué no me llegan alertas?' +
  '</button>';
  html += '<div id="perfil-alertas-status" style="font-size:12px;color:#64748B;text-align:right;padding:4px 4px 0;min-height:16px;"></div>';
  html += '<div id="perfil-diag-alertas" style="margin-top:8px;"></div>';
  cont.innerHTML = html;
  _perfilCargarDispositivos(sesion);
}

// ── Mis dispositivos: un empleado puede vincular varios (celular, tablet...) ──
function _perfilCargarDispositivos(sesion) {
  var cont = document.getElementById('perfil-dispositivos');
  if (!cont || navigator.onLine === false) return;
  var tkActual = (typeof PushNotifications !== 'undefined' && PushNotifications.tokenActual)
    ? PushNotifications.tokenActual() : '';

  google.script.run
    .withSuccessHandler(function(r) {
      var c = document.getElementById('perfil-dispositivos');
      if (!c || !r || !r.ok) return;
      var lista = r.dispositivos || [];
      if (lista.length === 0) {
        c.innerHTML = '<div style="font-size:12px;color:#64748B;padding:4px 2px;">Sin dispositivos vinculados todavía.</div>';
        return;
      }
      var html = '<div style="font-size:12px;color:var(--text-secondary,#94A3B8);text-transform:uppercase;' +
                 'letter-spacing:1.5px;font-weight:800;margin-bottom:8px;">📱 Mis dispositivos (' + lista.length + ')</div>';
      lista.forEach(function(d) {
        html +=
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 14px;margin-bottom:6px;' +
                 'background:linear-gradient(180deg,#142340 0%,#0c1729 100%);border-radius:10px;' +
                 'border:1px solid ' + (d.esActual ? 'rgba(16,185,129,0.4)' : 'rgba(80,150,220,0.12)') + ';">' +
            '<div style="min-width:0;">' +
              '<div style="font-size:13px;font-weight:700;color:var(--text-primary,#F1F5F9);">' + d.dispositivo +
                (d.esActual ? ' <span style="color:#10B981;font-size:11px;">· este</span>' : '') + '</div>' +
              '<div style="font-size:11px;color:#64748B;">Desde ' + (d.registrado || '—') + '</div>' +
            '</div>' +
            (d.esActual ? '' :
              '<button onclick="_perfilDesvincular(\'' + d.token.substring(0, 60) + '\')" ' +
                      'style="padding:7px 12px;background:transparent;color:#F87171;border:1px solid rgba(248,113,113,0.3);' +
                             'border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;">Quitar</button>') +
          '</div>';
      });
      c.innerHTML = html;
    })
    .withFailureHandler(function() {})
    .getMisDispositivos(sesion.pin, tkActual);
}

function _perfilDesvincular(tokenPrefijo) {
  var sesion = _perfilLeerSesion();
  if (!sesion) return;
  if (!window.confirm('¿Quitar este dispositivo? Dejará de recibir tus alertas.')) return;
  google.script.run
    .withSuccessHandler(function() { _perfilCargarDispositivos(sesion); })
    .withFailureHandler(function() {})
    .desvincularDispositivo(sesion.pin, tokenPrefijo);
}

// ── Test inmediato: valida todo el circuito de push y reporta el eslabón roto ──
function _perfilTestPush() {
  var sesion = _perfilLeerSesion();
  if (!sesion) return;
  var s = document.getElementById('perfil-alertas-status');
  if (s) { s.textContent = 'Enviando prueba...'; s.style.color = '#64748B'; }

  google.script.run
    .withSuccessHandler(function(r) {
      var st = document.getElementById('perfil-alertas-status');
      if (!st) return;
      st.style.color = (r && r.ok) ? '#10B981' : '#F87171';
      st.style.textAlign = 'left';
      st.textContent = (r && r.message) ? r.message : 'Sin respuesta';
    })
    .withFailureHandler(function(err) {
      var st = document.getElementById('perfil-alertas-status');
      if (st) {
        st.style.color = '#F87171';
        st.style.textAlign = 'left';
        st.textContent = '❌ Error de comunicación: ' + (err && err.message ? err.message : err) +
          ' — probablemente el backend desplegado no tiene testPushEmpleado (versión vieja).';
      }
    })
    .testPushEmpleado(sesion.pin);
}

function _perfilToggleAlerta(key) {
  var prefs = window._perfilPrefs;
  if (!prefs) return;
  prefs[key] = (prefs[key] === 'NO') ? 'SI' : 'NO';
  var sesion = _perfilLeerSesion();
  if (sesion) { _perfilPintarAlertas(sesion); _perfilGuardarAlertas(sesion); }
}

function _perfilToggleTodas() {
  var prefs = window._perfilPrefs;
  if (!prefs) return;
  var todasActivas = _PERFIL_CATS_ALERTAS.every(function(c) { return prefs[c.key] !== 'NO'; });
  var nuevo = todasActivas ? 'NO' : 'SI';
  _PERFIL_CATS_ALERTAS.forEach(function(c) { prefs[c.key] = nuevo; });
  var sesion = _perfilLeerSesion();
  if (sesion) { _perfilPintarAlertas(sesion); _perfilGuardarAlertas(sesion); }
}

function _perfilGuardarAlertas(sesion) {
  var status = document.getElementById('perfil-alertas-status');
  if (status) status.textContent = 'Guardando...';
  google.script.run
    .withSuccessHandler(function(r) {
      var s = document.getElementById('perfil-alertas-status');
      if (s) {
        s.textContent = (r && r.ok) ? '✓ Guardado' : '✗ No se pudo guardar';
        setTimeout(function() { if (s) s.textContent = ''; }, 2500);
      }
    })
    .withFailureHandler(function() {
      var s = document.getElementById('perfil-alertas-status');
      if (s) s.textContent = '✗ Sin conexión — reintenta';
    })
    .guardarPrefsAlertas(sesion.pin, window._perfilPrefs);
}

// ── Notificaciones push: banner según el estado del permiso ─────────────────
function _perfilInicializarPush(sesion) {
  var banner = document.getElementById('perfil-push-banner');
  if (!banner || typeof PushNotifications === 'undefined') return;

  // iPhone sin instalar (o navegador sin soporte): Notification no existe
  if (!('Notification' in window)) {
    var esIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    banner.innerHTML =
      '<div style="background:linear-gradient(180deg,#142340 0%,#0c1729 100%);border:1px solid rgba(245,158,11,0.35);' +
             'border-radius:12px;padding:14px 16px;font-size:13px;color:#FCD34D;line-height:1.5;">' +
        (esIOS
          ? '🔔 Para recibir alertas en iPhone: abre esto en <strong>Safari</strong> → botón <strong>Compartir</strong> → ' +
            '<strong>"Agregar a pantalla de inicio"</strong> → abre la app desde el ícono nuevo y vuelve a entrar a tu perfil.'
          : '🔕 Este navegador no soporta notificaciones push.') +
      '</div>';
    return;
  }

  var estado = Notification.permission;

  if (estado === 'granted') {
    // Ya autorizado → registrar el token MOSTRANDO el resultado. Antes era
    // silencioso y si getToken fallaba nadie se enteraba (dispositivos con
    // permiso concedido pero sin fila en PUSH_TOKENS).
    banner.innerHTML =
      '<div style="background:linear-gradient(180deg,#142340 0%,#0c1729 100%);border:1px solid rgba(80,150,220,0.2);' +
             'border-radius:12px;padding:12px 16px;font-size:13px;color:#94A3B8;">🔔 Vinculando este dispositivo...</div>';
    PushNotifications.solicitarYRegistrar(sesion.pin).then(function(r) {
      if (!banner) return;
      // ⭐ Si el dispositivo ya tiene token guardado, está vinculado aunque
      // esta llamada haya fallado (p.ej. iOS respondiendo raro al revalidar).
      var yaTieneToken = (typeof PushNotifications.tokenActual === 'function') &&
                         !!PushNotifications.tokenActual();
      var ok = r === true || (r && r.ok) || yaTieneToken;
      window._pushUltimoError = (r && r.error) || '';
      if (ok) {
        banner.innerHTML =
          '<div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.4);border-radius:12px;' +
                 'padding:12px 16px;font-size:13px;color:#6EE7B7;font-weight:600;">✅ Este dispositivo está vinculado a tus alertas</div>';
        setTimeout(function() { if (banner) banner.innerHTML = ''; }, 3500);
      } else {
        banner.innerHTML =
          '<div style="background:linear-gradient(180deg,#142340 0%,#0c1729 100%);border:1px solid rgba(245,158,11,0.4);' +
                 'border-radius:12px;padding:14px 16px;">' +
            '<div style="font-size:13px;color:#FCD34D;line-height:1.5;margin-bottom:10px;">' +
              '⚠️ El permiso está concedido pero <strong>no se pudo vincular este dispositivo</strong>.' +
              (window._pushUltimoError
                ? '<br><span style="font-size:11px;color:#F59E0B;">Motivo: ' + window._pushUltimoError + '</span>'
                : '') +
            '</div>' +
            '<button onclick="_perfilInicializarPush(_perfilLeerSesion())" ' +
                    'style="width:100%;padding:11px;background:linear-gradient(135deg,#2456a8,#1e90ff);color:#fff;border:none;' +
                           'border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;">Reintentar vinculación</button>' +
          '</div>';
      }
    });
    return;
  }

  if (estado === 'denied') {
    var esIOSd = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    banner.innerHTML =
      '<div style="background:linear-gradient(180deg,#142340 0%,#0c1729 100%);border:1px solid rgba(239,68,68,0.35);' +
             'border-radius:12px;padding:14px 16px;font-size:13px;color:#FCA5A5;line-height:1.6;">' +
        '🔕 Las notificaciones quedaron <strong>bloqueadas</strong> en este dispositivo (iOS/Android lo graba aunque haya sido sin querer).<br>' +
        (esIOSd
          ? '<strong>iPhone:</strong> Ajustes → Notificaciones → busca esta app en la lista → Permitir. ' +
            'Si no aparece: borra el ícono, luego Ajustes → Safari → Avanzado → Datos de sitios web → elimina este sitio, ' +
            'reinstala el ícono desde Safari y acepta el permiso.'
          : '<strong>Android:</strong> toca el 🔒 junto a la dirección (o ⋮ → Información del sitio) → Notificaciones → Permitir → recarga.') +
      '</div>';
    return;
  }

  // estado === 'default' → botón para pedir el permiso DENTRO de un gesto
  banner.innerHTML =
    '<div style="background:linear-gradient(180deg,#142340 0%,#0c1729 100%);border:1px solid rgba(59,130,246,0.4);' +
           'border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px;">' +
      '<div style="font-size:14px;font-weight:700;color:var(--text-primary,#F1F5F9);">🔔 Activa tus alertas</div>' +
      '<div style="font-size:13px;color:#94A3B8;line-height:1.5;">' +
        'Recibe avisos de entrada, desayuno, comida y salida directo en este dispositivo, aunque la app esté cerrada.' +
      '</div>' +
      '<button id="perfil-btn-activar-push" ' +
              'style="padding:13px;background:linear-gradient(135deg,#2456a8,#1e90ff);color:#fff;border:none;' +
                     'border-radius:10px;font-size:15px;font-weight:800;cursor:pointer;">' +
        'Activar notificaciones' +
      '</button>' +
    '</div>';

  var btn = document.getElementById('perfil-btn-activar-push');
  if (btn) {
    btn.onclick = function() {
      btn.disabled = true;
      btn.textContent = 'Solicitando permiso...';
      PushNotifications.solicitarYRegistrar(sesion.pin).then(function(r) {
        var ok = r === true || (r && r.ok);
        window._pushUltimoError = (r && r.error) || '';
        if (ok) {
          banner.innerHTML =
            '<div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.4);border-radius:12px;' +
                   'padding:13px 16px;font-size:13px;color:#6EE7B7;font-weight:600;">✅ Notificaciones activadas en este dispositivo</div>';
          setTimeout(function() { if (banner) banner.innerHTML = ''; }, 4000);
        } else {
          // Volver a evaluar el estado (pudo negar el permiso)
          _perfilInicializarPush(sesion);
        }
      });
    };
  }
}

// ── Utilidades compartidas de desglose (Hoy e Historial) ───────────────────
var _EXC_INFO = {
  VACACIONES: { emoji: '🏖️', label: 'Vacaciones' },
  ENFERMEDAD: { emoji: '🤒', label: 'Incapacidad' },
  EVENTO:     { emoji: '🎉', label: 'Evento' },
  FESTIVO:    { emoji: '📅', label: 'Día festivo' }
};
var _DIAS_SEM = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
var _MESES_AB = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function _hhmm(h) { return (h || '').substring(0, 5); }
function _aMin(h) {
  var p = (h || '').match(/(\d{1,2}):(\d{2})/);
  return p ? parseInt(p[1], 10) * 60 + parseInt(p[2], 10) : null;
}
function _primeraDe(items, tipo) {
  for (var i = 0; i < items.length; i++) if (items[i].tipo === tipo) return items[i];
  return null;
}
function _filaDesglose(emoji, etiqueta, valor, extra, color) {
  return '<div style="display:flex;align-items:baseline;gap:8px;padding:5px 0;">' +
    '<span style="width:20px;flex-shrink:0;font-size:14px;">' + emoji + '</span>' +
    '<span style="width:74px;flex-shrink:0;font-size:12px;color:#64748B;">' + etiqueta + '</span>' +
    '<span style="font-size:14px;font-weight:700;color:' + (color || '#E2E8F0') + ';font-variant-numeric:tabular-nums;">' + valor + '</span>' +
    (extra ? '<span style="font-size:12px;color:' + (color || '#64748B') + ';">' + extra + '</span>' : '') +
  '</div>';
}

// Construye las filas (entrada / desayuno / comida / salida) de un día
function _filasDelDia(items, sesion) {
  items = (items || []).slice().sort(function(a, b) { return (_aMin(a.hora) || 0) - (_aMin(b.hora) || 0); });
  var durDes = (typeof _durDesayunoDe === 'function') ? _durDesayunoDe(sesion.idUsuario) : 20;
  var durCom = (typeof _durComidaDe === 'function') ? _durComidaDe(sesion.idUsuario) : 60;

  var ent = _primeraDe(items, 'ENTRADA'), sal = _primeraDe(items, 'SALIDA');
  var sd = _primeraDe(items, 'SALIDA_DESAYUNO'), rd = _primeraDe(items, 'REGRESO_DESAYUNO');
  var sc = _primeraDe(items, 'SALIDA_COMIDA'),   rc = _primeraDe(items, 'REGRESO_COMIDA');
  var html = '';

  if (ent) html += _filaDesglose('🏢', 'Entrada', _hhmm(ent.hora), '', '#E2E8F0');
  if (sd) {
    var dD = (rd && _aMin(rd.hora) != null) ? (_aMin(rd.hora) - _aMin(sd.hora)) : null;
    html += _filaDesglose('🥐', 'Desayuno', _hhmm(sd.hora) + (rd ? ' → ' + _hhmm(rd.hora) : ' → …'),
      dD != null ? dD + ' min' : 'en curso', dD != null && dD > durDes ? '#F87171' : '#94A3B8');
  }
  if (sc) {
    var dC = (rc && _aMin(rc.hora) != null) ? (_aMin(rc.hora) - _aMin(sc.hora)) : null;
    html += _filaDesglose('🍽️', 'Comida', _hhmm(sc.hora) + (rc ? ' → ' + _hhmm(rc.hora) : ' → …'),
      dC != null ? dC + ' min' : 'en curso', dC != null && dC > durCom ? '#F87171' : '#94A3B8');
  }
  if (sal) html += _filaDesglose('🏠', 'Salida', _hhmm(sal.hora), '', '#E2E8F0');

  var jornada = '';
  if (ent && sal && _aMin(ent.hora) != null && _aMin(sal.hora) != null) {
    jornada = ((_aMin(sal.hora) - _aMin(ent.hora)) / 60).toFixed(1) + ' h';
  }
  return { html: html, jornada: jornada, vacio: !html };
}

// ── HOY con el mismo desglose que el historial ─────────────────────────────
function _perfilPintarHoyLocal(sesion) {
  var cont = document.getElementById('perfil-hoy');
  if (!cont) return;
  var items = _checadasHoyDe(sesion.idUsuario).map(function(c) {
    var d = new Date(c.ts);
    return { tipo: c.tipo, hora: String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') };
  }).sort(function(a, b) { return (_aMin(a.hora) || 0) - (_aMin(b.hora) || 0); });

  if (!items.length) {
    cont.innerHTML = '<div style="padding:16px;background:linear-gradient(180deg,#142340 0%,#0c1729 100%);' +
      'border-radius:14px;border:1px solid rgba(80,150,220,0.12);color:#64748B;font-size:13px;font-style:italic;text-align:center;">' +
      'Sin checadas hoy</div>';
    return;
  }

  var durDes = (typeof _durDesayunoDe === 'function') ? _durDesayunoDe(sesion.idUsuario) : 20;
  var durCom = (typeof _durComidaDe === 'function') ? _durComidaDe(sesion.idUsuario) : 60;
  var ent = _primeraDe(items, 'ENTRADA'), sal = _primeraDe(items, 'SALIDA');
  var sd = _primeraDe(items, 'SALIDA_DESAYUNO'), rd = _primeraDe(items, 'REGRESO_DESAYUNO');
  var sc = _primeraDe(items, 'SALIDA_COMIDA'),   rc = _primeraDe(items, 'REGRESO_COMIDA');

  function evento(emoji, etiqueta, horas, chip, chipColor) {
    return '<div style="display:flex;align-items:center;gap:14px;padding:11px 0;">' +
      '<div style="width:42px;height:42px;border-radius:12px;background:rgba(80,150,220,0.1);' +
             'border:1px solid rgba(127,223,255,0.18);display:flex;align-items:center;justify-content:center;' +
             'font-size:19px;flex-shrink:0;">' + emoji + '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:10.5px;color:#64748B;text-transform:uppercase;letter-spacing:1.4px;font-weight:800;">' + etiqueta + '</div>' +
        '<div style="font-size:19px;font-weight:800;color:#E2E8F0;font-variant-numeric:tabular-nums;letter-spacing:0.3px;">' + horas + '</div>' +
      '</div>' +
      (chip ? '<span style="padding:4px 11px;border-radius:999px;font-size:11.5px;font-weight:800;flex-shrink:0;' +
              'background:' + chipColor + '1d;color:' + chipColor + ';border:1px solid ' + chipColor + '3d;">' + chip + '</span>' : '') +
    '</div>';
  }
  var sep = '<div style="height:1px;background:rgba(148,163,184,0.09);margin:0 0 0 56px;"></div>';

  var filas = [];
  if (ent) filas.push(evento('🏢', 'Entrada', ent.hora, '', ''));
  if (sd) {
    var dD = (rd && _aMin(rd.hora) != null) ? (_aMin(rd.hora) - _aMin(sd.hora)) : null;
    filas.push(evento('🥐', 'Desayuno', sd.hora + '  →  ' + (rd ? rd.hora : '…'),
      dD != null ? dD + ' min' : 'en curso',
      dD == null ? '#3B82F6' : (dD > durDes ? '#F87171' : '#10B981')));
  }
  if (sc) {
    var dC = (rc && _aMin(rc.hora) != null) ? (_aMin(rc.hora) - _aMin(sc.hora)) : null;
    filas.push(evento('🍽️', 'Comida', sc.hora + '  →  ' + (rc ? rc.hora : '…'),
      dC != null ? dC + ' min' : 'en curso',
      dC == null ? '#3B82F6' : (dC > durCom ? '#F87171' : '#10B981')));
  }
  if (sal) filas.push(evento('🏠', 'Salida', sal.hora, '', ''));

  var jornada = '';
  if (ent && sal && _aMin(ent.hora) != null && _aMin(sal.hora) != null) {
    jornada = ((_aMin(sal.hora) - _aMin(ent.hora)) / 60).toFixed(1);
  }

  cont.innerHTML =
    '<div style="background:linear-gradient(165deg,#16264a 0%,#0d1a33 45%,#0a1426 100%);border-radius:16px;' +
           'border:1px solid rgba(127,223,255,0.22);padding:6px 18px 8px;box-shadow:0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(127,223,255,0.08);">' +
      (jornada
        ? '<div style="display:flex;justify-content:flex-end;padding-top:10px;">' +
            '<div style="text-align:right;"><span style="font-size:22px;font-weight:800;color:#7fdfff;">' + jornada + '</span>' +
            '<span style="font-size:12px;color:#64748B;font-weight:700;"> h de jornada</span></div>' +
          '</div>'
        : '<div style="padding-top:6px;"></div>') +
      filas.join(sep) +
    '</div>';
}

// ── HISTORIAL POR QUINCENA (con navegación) ────────────────────────────────
var _perfilQuincenaOffset = 0;

function _perfilCargarQuincena(sesion, offset) {
  _perfilQuincenaOffset = offset || 0;
  var cont = document.getElementById('perfil-historial');
  if (cont) cont.innerHTML = '<div style="color:#64748B;font-size:13px;font-style:italic;padding:8px 0;">Cargando quincena...</div>';
  if (navigator.onLine === false) {
    if (cont) cont.innerHTML = '<div style="color:#64748B;font-size:13px;font-style:italic;">📡 Sin internet</div>';
    return;
  }
  google.script.run
    .withSuccessHandler(function(r) {
      if (r && r.ok) _perfilPintarQuincena(r, sesion);
      else if (cont) cont.innerHTML = '<div style="color:#64748B;font-size:13px;">No se pudo cargar</div>';
    })
    .withFailureHandler(function() {
      if (cont) cont.innerHTML = '<div style="color:#64748B;font-size:13px;">No se pudo cargar</div>';
    })
    .getHistorialQuincena(sesion.pin, _perfilQuincenaOffset);
}

function _perfilPintarQuincena(data, sesion) {
  var head = document.getElementById('perfil-quincena-header');
  var cont = document.getElementById('perfil-historial');
  if (!cont) return;
  window._qDatos = data;   // para expandir/colapsar sin recargar

  // Encabezado con navegación ‹ ›
  if (head) {
    var pi = data.inicio.split('-'), pf = data.fin.split('-');
    var rango = (+pi[2]) + '–' + (+pf[2]) + ' ' + _MESES_AB[+pf[1] - 1];
    head.innerHTML =
      '<button onclick="_perfilCargarQuincena(_perfilLeerSesion(), ' + (data.offset - 1) + ')" ' +
              'style="padding:7px 12px;background:transparent;color:#A5B4FC;border:1px solid rgba(165,180,252,0.3);' +
                     'border-radius:8px;font-size:14px;cursor:pointer;font-weight:700;">‹</button>' +
      '<div style="text-align:center;">' +
        '<div style="font-size:12px;color:var(--text-secondary,#94A3B8);text-transform:uppercase;letter-spacing:2px;font-weight:800;">Quincena ' + rango + '</div>' +
        (data.esActual ? '<div style="font-size:11px;color:#64748B;">en curso</div>' : '') +
      '</div>' +
      (data.offset < 0
        ? '<button onclick="_perfilCargarQuincena(_perfilLeerSesion(), ' + (data.offset + 1) + ')" ' +
                  'style="padding:7px 12px;background:transparent;color:#A5B4FC;border:1px solid rgba(165,180,252,0.3);' +
                         'border-radius:8px;font-size:14px;cursor:pointer;font-weight:700;">›</button>'
        : '<span style="width:38px;"></span>');
  }

  // Chips de resumen + botón expandir todo
  var res = data.resumen || {};
  function chip(txt, color) {
    return '<span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;' +
           'background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44;margin:0 5px 5px 0;">' + txt + '</span>';
  }
  var chips = res.bonoPerdido ? chip('💸 Bono perdido', '#F87171') : chip('🎯 Bono a salvo', '#10B981');
  if (res.retardos) chips += chip('⏰ ' + res.retardos + ' retardo(s)' + (res.descuento ? ' · ' + res.descuento : ''), '#F59E0B');
  if (res.faltas) chips += chip('🚫 ' + res.faltas + ' falta(s)', '#F87171');

  var html =
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:12px;flex-wrap:wrap;">' +
      '<div>' + chips + '</div>' +
      '<button id="q-exp-btn" onclick="_perfilExpandirTodo()" ' +
              'style="padding:5px 12px;background:transparent;color:#64748B;border:1px solid rgba(255,255,255,0.12);' +
                     'border-radius:999px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">⊞ Expandir todo</button>' +
    '</div>';

  var hoyStr = _fechaHoyLocal();
  (data.dias || []).forEach(function(d, idx) {
    if (d.fecha === hoyStr) return;
    if (d.finde && !d.checadas.length && !d.excepcion) return;

    var p = d.fecha.split('-');
    var fd = new Date(+p[0], +p[1] - 1, +p[2]);
    var titulo = _DIAS_SEM[fd.getDay()] + ' ' + (+p[2]) + ' ' + _MESES_AB[+p[1] - 1];

    var marcas = '';
    if (d.perdioBono) marcas += ' 💸';
    if (d.retardo)    marcas += ' ⏰';

    var borde = 'rgba(80,150,220,0.1)', fondo = 'linear-gradient(180deg,#142340 0%,#0c1729 100%)';
    if (d.retardo || d.falta) { borde = 'rgba(248,113,113,0.3)'; fondo = 'linear-gradient(180deg,#231320 0%,#160b12 100%)'; }
    else if (d.perdioBono)    { borde = 'rgba(245,158,11,0.28)'; fondo = 'linear-gradient(180deg,#221b12 0%,#140f09 100%)'; }
    else if (d.excepcion)     { borde = 'rgba(165,180,252,0.28)'; }

    // Resumen del renglón colapsado: entrada → salida (o excepción / falta)
    var resumenLinea, expandible = false;
    if (d.excepcion) {
      var e = _EXC_INFO[d.excepcion] || { emoji: '•', label: d.excepcion };
      resumenLinea = '<span style="color:#A5B4FC;font-weight:700;">' + e.emoji + ' ' + e.label + '</span>';
    } else if (d.falta) {
      resumenLinea = '<span style="color:#F87171;font-weight:700;">🚫 Sin registros</span>';
    } else {
      var ent = _primeraDe(d.checadas, 'ENTRADA'), sal = _primeraDe(d.checadas, 'SALIDA');
      resumenLinea =
        '<span style="font-variant-numeric:tabular-nums;color:#CBD5E1;font-weight:700;">' +
          '🏢 ' + (ent ? _hhmm(ent.hora) : '—') +
          ' <span style="color:#475569;">→</span> 🏠 ' + (sal ? _hhmm(sal.hora) : '—') +
        '</span>';
      expandible = true;
    }

    var idDia = 'qdia-' + d.fecha;
    html +=
      '<div style="background:' + fondo + ';border-radius:12px;margin-bottom:7px;border:1px solid ' + borde + ';overflow:hidden;">' +
        '<div ' + (expandible ? 'onclick="_perfilToggleDia(\'' + idDia + '\')" style="cursor:pointer;"' : 'style="cursor:default;"') + '>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 14px;">' +
            '<span style="font-size:12px;color:#A5B4FC;font-weight:800;text-transform:capitalize;white-space:nowrap;">' + titulo + marcas + '</span>' +
            '<span style="font-size:12.5px;flex:1;text-align:right;">' + resumenLinea + '</span>' +
            (expandible ? '<span id="' + idDia + '-flecha" style="color:#475569;font-size:11px;transition:transform 0.2s;">▼</span>' : '') +
          '</div>' +
        '</div>' +
        (expandible
          ? '<div id="' + idDia + '" style="display:none;padding:2px 14px 12px;border-top:1px solid rgba(148,163,184,0.08);">' +
              _filasDelDia(d.checadas, sesion).html +
              (function() { var j = _filasDelDia(d.checadas, sesion).jornada;
                return j ? '<div style="text-align:right;font-size:11.5px;color:#64748B;font-weight:700;">' + j + ' de jornada</div>' : ''; })() +
            '</div>'
          : '') +
      '</div>';
  });

  cont.innerHTML = html || '<div style="color:#475569;font-size:13px;font-style:italic;">Sin registros en esta quincena</div>';
}

// Toggle de un día del acordeón
function _perfilToggleDia(id) {
  var body = document.getElementById(id);
  var fl = document.getElementById(id + '-flecha');
  if (!body) return;
  var abierto = body.style.display !== 'none';
  body.style.display = abierto ? 'none' : 'block';
  if (fl) fl.style.transform = abierto ? '' : 'rotate(180deg)';
}

// Expandir / colapsar todos los días
var _qTodoExpandido = false;
function _perfilExpandirTodo() {
  _qTodoExpandido = !_qTodoExpandido;
  var bodies = document.querySelectorAll('[id^="qdia-"]:not([id$="-flecha"])');
  bodies.forEach(function(b) {
    if (b.id.indexOf('-flecha') !== -1) return;
    b.style.display = _qTodoExpandido ? 'block' : 'none';
    var fl = document.getElementById(b.id + '-flecha');
    if (fl) fl.style.transform = _qTodoExpandido ? 'rotate(180deg)' : '';
  });
  var btn = document.getElementById('q-exp-btn');
  if (btn) btn.textContent = _qTodoExpandido ? '⊟ Colapsar todo' : '⊞ Expandir todo';
}

// ── EXCEPCIONES DEL DÍA ────────────────────────────────────────────────────
function _perfilCargarExcepciones(sesion) {
  var cont = document.getElementById('perfil-excepciones');
  if (!cont) return;
  if (navigator.onLine === false) {
    cont.innerHTML = '<div style="color:#64748B;font-size:13px;font-style:italic;">📡 Sin internet</div>';
    return;
  }
  google.script.run
    .withSuccessHandler(function(r) { _perfilPintarExcepciones(sesion, (r && r.tipo) || ''); })
    .withFailureHandler(function() { _perfilPintarExcepciones(sesion, ''); })
    .getExcepcionHoy(sesion.pin);
}

function _perfilPintarExcepciones(sesion, activa) {
  var cont = document.getElementById('perfil-excepciones');
  if (!cont) return;

  if (activa) {
    var e = _EXC_INFO[activa] || { emoji: '•', label: activa };
    cont.innerHTML =
      '<div style="background:linear-gradient(180deg,#142340 0%,#0c1729 100%);border:1px solid rgba(165,180,252,0.4);' +
             'border-radius:12px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;">' +
        '<div>' +
          '<div style="font-size:15px;font-weight:800;color:#C7D2FE;">' + e.emoji + ' ' + e.label + '</div>' +
          '<div style="font-size:12px;color:#64748B;margin-top:2px;">Hoy no recibirás alertas.</div>' +
        '</div>' +
        '<button onclick="_perfilQuitarExcepcion()" ' +
                'style="padding:9px 14px;background:transparent;color:#94A3B8;border:1px solid rgba(255,255,255,0.15);' +
                       'border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Quitar</button>' +
      '</div>' +
      '<div id="perfil-exc-status" style="font-size:12px;color:#64748B;padding:6px 2px 0;min-height:14px;"></div>';
    return;
  }

  var tipos = [
    { k: 'VACACIONES', e: '🏖️', l: 'Vacaciones' },
    { k: 'ENFERMEDAD', e: '🤒', l: 'Incapacidad' },
    { k: 'EVENTO',     e: '🎉', l: 'Evento' },
    { k: 'FESTIVO',    e: '📅', l: 'Festivo' }
  ];
  cont.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">' +
      tipos.map(function(t) {
        return '<button onclick="_perfilMarcarExcepcion(\'' + t.k + '\')" ' +
               'onpointerdown="this.style.transform=\'scale(0.94)\'" onpointerup="this.style.transform=\'\'" ' +
               'style="padding:9px 4px;background:linear-gradient(180deg,#142340 0%,#0c1729 100%);' +
                      'border:1px solid rgba(165,180,252,0.2);border-radius:10px;cursor:pointer;color:#CBD5E1;transition:transform 0.12s;">' +
                 '<span style="font-size:15px;">' + t.e + '</span>' +
                 '<div style="font-size:10.5px;font-weight:700;margin-top:3px;letter-spacing:0.2px;">' + t.l + '</div>' +
               '</button>';
      }).join('') +
    '</div>' +

    '<div id="perfil-exc-status" style="font-size:12px;color:#64748B;padding:6px 2px 0;min-height:14px;"></div>';
}

function _perfilMarcarExcepcion(tipo) {
  var sesion = _perfilLeerSesion();
  if (!sesion) return;
  var st = document.getElementById('perfil-exc-status');
  if (st) { st.style.color = '#64748B'; st.textContent = 'Guardando...'; }
  google.script.run
    .withSuccessHandler(function(r) {
      var s = document.getElementById('perfil-exc-status');
      if (r && r.ok) {
        _perfilPintarExcepciones(sesion, tipo);
        var s2 = document.getElementById('perfil-exc-status');
        if (s2) { s2.style.color = '#10B981'; s2.textContent = r.message; }
      } else if (s) { s.style.color = '#F87171'; s.textContent = (r && r.message) || 'No se pudo guardar'; }
    })
    .withFailureHandler(function() {
      var s = document.getElementById('perfil-exc-status');
      if (s) { s.style.color = '#F87171'; s.textContent = 'Sin conexión'; }
    })
    .guardarExcepcionDia(sesion.pin, tipo);
}

function _perfilQuitarExcepcion() {
  var sesion = _perfilLeerSesion();
  if (!sesion) return;
  google.script.run
    .withSuccessHandler(function(r) {
      _perfilPintarExcepciones(sesion, '');
      var s = document.getElementById('perfil-exc-status');
      if (s && r) { s.style.color = '#94A3B8'; s.textContent = r.message || ''; }
    })
    .withFailureHandler(function() {})
    .quitarExcepcionDia(sesion.pin);
}


// ── Diagnóstico de alertas: revisa eslabón por eslabón y dice qué bloquea ──
function _perfilDiagAlertas() {
  var sesion = _perfilLeerSesion();
  if (!sesion) return;
  var box = document.getElementById('perfil-diag-alertas');
  if (box) box.innerHTML = '<div style="font-size:12px;color:#64748B;padding:8px 0;">Revisando...</div>';
  google.script.run
    .withSuccessHandler(function(r) {
      var b = document.getElementById('perfil-diag-alertas');
      if (!b) return;
      if (!r || !r.ok) { b.innerHTML = '<div style="font-size:12px;color:#F87171;">' + ((r && r.message) || 'Error') + '</div>'; return; }
      b.innerHTML =
        '<div style="background:linear-gradient(180deg,#142340 0%,#0c1729 100%);border:1px solid rgba(80,150,220,0.16);' +
               'border-radius:12px;padding:12px 14px;font-size:12px;color:#CBD5E1;line-height:1.85;">' +
          r.lineas.join('<br>') +
        '</div>';
    })
    .withFailureHandler(function() {
      var b = document.getElementById('perfil-diag-alertas');
      if (b) b.innerHTML = '<div style="font-size:12px;color:#F87171;">El backend no tiene diagnosticoAlertas — re-despliega el Code-Simple.gs.</div>';
    })
    .diagnosticoAlertas(sesion.pin);
}


// ── Recargar app y cache (turnos/horarios nuevos) ──────────────────────────
// En iOS la PWA instalada no tiene "deslizar para recargar": este botón hace
// el trabajo — borra el cache de usuarios, las checadas locales del día y el
// cache del service worker, y vuelve a cargar.
function _perfilRecargarTodo() {
  var btn = document.getElementById('perfil-btn-recargar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  try { localStorage.removeItem('em_usuarios_cache'); } catch(e) {}
  try { localStorage.removeItem(_LS_KEY_CHECADAS_DIA); } catch(e) {}
  if (typeof _usuariosCache !== 'undefined') _usuariosCache = null;

  var tareas = [];
  // Vaciar los caches del service worker (para jalar archivos nuevos)
  if (window.caches && caches.keys) {
    tareas.push(caches.keys().then(function(ks) {
      return Promise.all(ks.map(function(k) { return caches.delete(k); }));
    }).catch(function() {}));
  }
  // Actualizar el service worker registrado
  if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    tareas.push(navigator.serviceWorker.getRegistrations().then(function(rs) {
      return Promise.all(rs.map(function(r) { return r.update().catch(function() {}); }));
    }).catch(function() {}));
  }

  Promise.all(tareas).then(function() {
    setTimeout(function() {
      // Cache-bust duro: recargar con parámetro de tiempo
      var u = location.origin + location.pathname + '?r=' + Date.now();
      location.replace(u);
    }, 350);
  });
}


// ── Secciones colapsables del perfil (cerradas de inicio) ──────────────────
function _secColapsable(id, titulo, innerHtml) {
  return '<div style="background:linear-gradient(180deg,#101d38 0%,#0b1526 100%);border:1px solid rgba(80,150,220,0.14);' +
                'border-radius:14px;margin-bottom:14px;overflow:hidden;">' +
    '<div onclick="_perfilToggleSec(\'' + id + '\')" ' +
         'style="display:flex;justify-content:space-between;align-items:center;padding:15px 16px;cursor:pointer;">' +
      '<span style="font-size:13px;font-weight:800;color:#CBD5E1;letter-spacing:0.4px;">' + titulo + '</span>' +
      '<span id="' + id + '-flecha" style="color:#475569;font-size:12px;transition:transform 0.2s;">▼</span>' +
    '</div>' +
    '<div id="' + id + '" style="display:none;padding:0 16px 16px;">' + innerHtml + '</div>' +
  '</div>';
}
function _perfilToggleSec(id) {
  var body = document.getElementById(id);
  var fl = document.getElementById(id + '-flecha');
  if (!body) return;
  var abierto = body.style.display !== 'none';
  body.style.display = abierto ? 'none' : 'block';
  if (fl) fl.style.transform = abierto ? '' : 'rotate(180deg)';
}
