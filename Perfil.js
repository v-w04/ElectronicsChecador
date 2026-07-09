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
  var overlay = document.getElementById('pin-overlay');
  var box = document.getElementById('pin-box');
  var btn = document.getElementById('btn-mi-perfil');

  if (overlay) {
    overlay.style.transition = 'background 0.45s ease';
    overlay.style.background =
      'radial-gradient(circle at 50% 38%, #6b1220 0%, #3f0a12 48%, #16050a 100%)';
  }
  if (box) {
    box.style.transition = 'filter 0.45s ease';
    box.style.filter = 'hue-rotate(140deg) saturate(1.25)'; // anillo azul → rojo
  }
  if (btn) {
    btn.innerHTML = '✕ Cancelar';
    btn.style.color = '#FCA5A5';
    btn.style.borderColor = 'rgba(248,113,113,0.5)';
  }

  // Etiqueta "MODO PERFIL" arriba del anillo
  var tag = document.getElementById('perfil-mode-tag');
  if (!tag && overlay) {
    tag = document.createElement('div');
    tag.id = 'perfil-mode-tag';
    tag.innerHTML = '👤 MODO PERFIL — entra con tu PIN y contraseña';
    tag.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:100000;' +
      'padding:9px 20px;border-radius:999px;background:rgba(127,29,29,0.45);color:#FECACA;' +
      'border:1px solid rgba(248,113,113,0.45);font-size:13px;font-weight:700;letter-spacing:1px;' +
      'backdrop-filter:blur(8px);white-space:nowrap;';
    overlay.appendChild(tag);
  }

  // Checkbox "mantener sesión" abajo, centrado
  var keep = document.getElementById('perfil-keep-wrap');
  if (!keep && overlay) {
    keep = document.createElement('label');
    keep.id = 'perfil-keep-wrap';
    keep.innerHTML =
      '<input id="perfil-keep" type="checkbox" style="width:17px;height:17px;accent-color:#EF4444;vertical-align:middle;"> ' +
      '<span style="vertical-align:middle;">Mantener mi sesión en este dispositivo</span>';
    keep.style.cssText =
      'position:fixed;bottom:66px;left:50%;transform:translateX(-50%);z-index:100000;' +
      'color:#FCA5A5;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;' +
      'background:rgba(22,5,10,0.6);padding:8px 16px;border-radius:999px;backdrop-filter:blur(6px);';
    overlay.appendChild(keep);
  }

  // ⭐ Mostrar el campo de contraseña (invisible en el flujo rápido de solo PIN)
  var campoPass = document.getElementById('campo-contrasena-wrap');
  if (campoPass) campoPass.style.visibility = 'visible';

  // ⭐ Focus INMEDIATO en el input del PIN — sin toques extra. Como esto corre
  // dentro del gesto del usuario (click del botón), el teclado móvil se
  // despliega de una vez.
  var inputPin = document.getElementById('input-pin');
  if (inputPin) {
    inputPin.value = '';
    inputPin.focus();
  }
}

function desactivarModoPerfil() {
  window._modoPerfil = false;
  var overlay = document.getElementById('pin-overlay');
  var box = document.getElementById('pin-box');
  var btn = document.getElementById('btn-mi-perfil');
  if (overlay) overlay.style.background = '';
  if (box) box.style.filter = '';
  if (btn) {
    btn.innerHTML = '👤 Mi Perfil';
    btn.style.color = '#94A3B8';
    btn.style.borderColor = 'rgba(255,255,255,0.1)';
  }
  // ⭐ Ocultar y limpiar el campo de contraseña (el flujo rápido es solo PIN)
  var campoPass = document.getElementById('campo-contrasena-wrap');
  if (campoPass) campoPass.style.visibility = 'hidden';
  var inputPass = document.getElementById('input-contrasena');
  if (inputPass) inputPass.value = '';
  var tag = document.getElementById('perfil-mode-tag');
  if (tag) tag.remove();
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
        '<button onclick="_perfilCerrarSesion()" ' +
                'style="padding:10px 18px;background:transparent;color:var(--danger,#EF4444);border:1px solid rgba(239,68,68,0.35);' +
                       'border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">' +
          'Cerrar sesión' +
        '</button>' +
      '</div>' +

      // Banner de notificaciones (activar / estado)
      '<div id="perfil-push-banner" style="margin-bottom:18px;"></div>' +

      // Cronómetro activo (se llena dinámicamente)
      '<div id="perfil-crono" style="display:none;margin-bottom:18px;"></div>' +

      // Veredicto de la última checada desde el perfil
      '<div id="perfil-veredicto" style="display:none;margin-bottom:18px;"></div>' +

      // Estado del día
      '<div style="font-size:12px;color:var(--text-secondary,#94A3B8);text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:12px;">Hoy</div>' +
      '<div id="perfil-hoy" style="margin-bottom:28px;">' +
        '<div style="color:#64748B;font-size:14px;font-style:italic;padding:8px 0;">Cargando...</div>' +
      '</div>' +

      // Historial
      '<div style="font-size:12px;color:var(--text-secondary,#94A3B8);text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:12px;">Últimos 7 días</div>' +
      '<div id="perfil-historial" style="margin-bottom:28px;">' +
        '<div style="color:#64748B;font-size:14px;font-style:italic;padding:8px 0;">Cargando...</div>' +
      '</div>' +

      // ⭐ Mis alertas — preferencias por empleado
      '<div style="font-size:12px;color:var(--text-secondary,#94A3B8);text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:12px;">🔔 Mis alertas</div>' +
      '<div id="perfil-alertas" style="margin-bottom:28px;">' +
        '<div style="color:#64748B;font-size:14px;font-style:italic;padding:8px 0;">Cargando...</div>' +
      '</div>' +

      // ⭐ Botones de checada MANUAL — hasta el fondo a propósito: la checada
      // normal es desde la tablet con PIN. Esto es para emergencias/pruebas.
      '<div style="font-size:12px;color:var(--text-secondary,#94A3B8);text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:6px;">Checada manual</div>' +
      '<div style="font-size:12px;color:#64748B;margin-bottom:12px;">Solo para emergencias o pruebas — la checada normal es en la tablet con tu PIN.</div>' +
      '<div id="perfil-botones" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:28px;"></div>' +

      // Limpieza local (pruebas): borra SOLO el registro del día en este
      // dispositivo. No toca el sheet ni la cola offline.
      '<div style="text-align:center;margin-top:32px;">' +
        '<button onclick="_perfilLimpiarLocalHoy()" ' +
                'style="padding:8px 16px;background:transparent;color:#475569;border:1px solid rgba(255,255,255,0.08);' +
                       'border-radius:999px;font-size:12px;cursor:pointer;">' +
          '🧹 Limpiar registros de hoy en este dispositivo' +
        '</button>' +
      '</div>' +

    '</div>';
  document.body.appendChild(overlay);

  _perfilPintarBotones(sesion);
  _perfilCargarDatos(sesion);
  _perfilCargarAlertas(sesion);

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
        _perfilPintarHistorial(result.historial || {});
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
function _perfilPintarHoyLocal(sesion) {
  var cont = document.getElementById('perfil-hoy');
  if (!cont) return;
  var checadas = _checadasHoyDe(sesion.idUsuario);
  if (checadas.length === 0) {
    cont.innerHTML = '<div style="color:#475569;font-size:13px;font-style:italic;padding:8px 0;">Sin checadas todavía</div>';
    return;
  }
  cont.innerHTML = checadas.map(function(c) {
    var et = _ETIQUETAS_TIPO[c.tipo] || _ETIQUETAS_TIPO['EXTRA'];
    var d = new Date(c.ts);
    var hora = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return (
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 15px;' +
             'background:linear-gradient(180deg,#142340 0%,#0c1729 100%);border-radius:10px;margin-bottom:6px;border:1px solid rgba(80,150,220,0.12);">' +
        '<span style="font-size:14px;color:#E2E8F0;">' + et.emoji + ' ' + et.label + '</span>' +
        '<span style="font-size:14px;color:#94A3B8;font-weight:700;font-variant-numeric:tabular-nums;">' + hora + '</span>' +
      '</div>'
    );
  }).join('');
}

// ── Historial de 7 días ─────────────────────────────────────────────────────
function _perfilPintarHistorial(historial) {
  var cont = document.getElementById('perfil-historial');
  if (!cont) return;
  var fechas = Object.keys(historial).sort().reverse();
  var hoy = _fechaHoyLocal();

  var DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  var MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

  function hhmm(h) { return (h || '').substring(0, 5); }
  function aMin(h) {
    var p = (h || '').match(/(\d{1,2}):(\d{2})/);
    return p ? parseInt(p[1], 10) * 60 + parseInt(p[2], 10) : null;
  }
  function primera(items, tipo) {
    for (var i = 0; i < items.length; i++) if (items[i].tipo === tipo) return items[i];
    return null;
  }
  function fila(emoji, etiqueta, valor, extra, color) {
    return '<div style="display:flex;align-items:baseline;gap:8px;padding:5px 0;">' +
      '<span style="width:20px;flex-shrink:0;font-size:14px;">' + emoji + '</span>' +
      '<span style="width:74px;flex-shrink:0;font-size:12px;color:#64748B;">' + etiqueta + '</span>' +
      '<span style="font-size:14px;font-weight:700;color:' + (color || '#E2E8F0') + ';font-variant-numeric:tabular-nums;">' + valor + '</span>' +
      (extra ? '<span style="font-size:12px;color:' + (color || '#64748B') + ';">' + extra + '</span>' : '') +
    '</div>';
  }

  var html = '';
  fechas.forEach(function(f) {
    if (f === hoy) return; // hoy se muestra arriba
    var items = (historial[f] || []).slice().sort(function(a, b) {
      return (aMin(a.hora) || 0) - (aMin(b.hora) || 0);
    });
    if (!items.length) return;

    // Encabezado legible: "miércoles 8 jul"
    var p = f.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var titulo = DIAS[d.getDay()] + ' ' + (+p[2]) + ' ' + MESES[+p[1] - 1];

    var ent = primera(items, 'ENTRADA');
    var sal = primera(items, 'SALIDA');
    var sd = primera(items, 'SALIDA_DESAYUNO'), rd = primera(items, 'REGRESO_DESAYUNO');
    var sc = primera(items, 'SALIDA_COMIDA'),   rc = primera(items, 'REGRESO_COMIDA');

    var filas = '';
    if (ent) filas += fila('🏢', 'Entrada', hhmm(ent.hora), '', '#E2E8F0');

    if (sd) {
      var durD = (rd && aMin(rd.hora) != null) ? (aMin(rd.hora) - aMin(sd.hora)) : null;
      var valD = hhmm(sd.hora) + (rd ? ' → ' + hhmm(rd.hora) : ' → …');
      filas += fila('🥐', 'Desayuno', valD, durD != null ? durD + ' min' : 'sin regreso',
                    durD != null && durD > 25 ? '#F87171' : '#94A3B8');
    }
    if (sc) {
      var durC = (rc && aMin(rc.hora) != null) ? (aMin(rc.hora) - aMin(sc.hora)) : null;
      var valC = hhmm(sc.hora) + (rc ? ' → ' + hhmm(rc.hora) : ' → …');
      filas += fila('🍽️', 'Comida', valC, durC != null ? durC + ' min' : 'sin regreso',
                    durC != null && durC > 60 ? '#F87171' : '#94A3B8');
    }
    if (sal) filas += fila('🏠', 'Salida', hhmm(sal.hora), '', '#E2E8F0');

    // Jornada total (entrada → salida)
    var jornada = '';
    if (ent && sal && aMin(ent.hora) != null && aMin(sal.hora) != null) {
      var tot = aMin(sal.hora) - aMin(ent.hora);
      jornada = (tot / 60).toFixed(1) + ' h';
    }

    html +=
      '<div style="background:linear-gradient(180deg,#142340 0%,#0c1729 100%);border-radius:12px;' +
             'margin-bottom:8px;border:1px solid rgba(80,150,220,0.1);padding:12px 14px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
          '<span style="font-size:12px;color:#A5B4FC;font-weight:800;text-transform:capitalize;letter-spacing:0.3px;">' + titulo + '</span>' +
          (jornada ? '<span style="font-size:12px;color:#64748B;font-weight:700;">' + jornada + '</span>' : '') +
        '</div>' +
        filas +
      '</div>';
  });

  cont.innerHTML = html || '<div style="color:#475569;font-size:13px;font-style:italic;">Sin registros previos</div>';
}

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

  // 1) ¿En desayuno o comida sin regresar?
  if (ultima && (ultima.tipo === 'SALIDA_DESAYUNO' || ultima.tipo === 'SALIDA_COMIDA')) {
    var esDes = ultima.tipo === 'SALIDA_DESAYUNO';
    var limMin = esDes ? _durDesayunoDe(sesion.idUsuario) : _durComidaDe(sesion.idUsuario);
    var trans = Math.floor((ahora.getTime() - ultima.ts) / 1000);
    var limSeg = limMin * 60;
    var excedido = trans > limSeg;
    var color = excedido ? '#EF4444' : (trans > limSeg - 300 ? '#F59E0B' : '#3B82F6');
    var titulo = esDes ? '🥐 Desayuno en curso' : '🍽️ Comida en curso';

    box.style.display = 'block';
    box.innerHTML =
      '<div style="background:linear-gradient(180deg,#142340 0%,#0c1729 100%);border:1px solid ' + color + '55;border-radius:14px;padding:18px;text-align:center;">' +
        '<div style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">' + titulo + '</div>' +
        '<div style="font-size:38px;font-weight:800;color:' + color + ';font-variant-numeric:tabular-nums;margin:6px 0 2px;">' + fmt(trans) + '</div>' +
        '<div style="font-size:13px;color:#CBD5E1;">' +
          (excedido
            ? '❌ Exceso de ' + Math.floor((trans - limSeg) / 60) + ' min — ¡CORRE! Por UN minuto te descuentan UNA HORA. '
            : 'de ' + limMin + ':00 permitidos · te quedan ' + Math.ceil((limSeg - trans) / 60) + ' min') +
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
          '<div style="font-size:12px;color:#FBBF24;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">⏱️ Tiempo regalado</div>' +
          '<div style="font-size:38px;font-weight:800;color:#FBBF24;font-variant-numeric:tabular-nums;margin:6px 0 2px;">' + fmt(reg) + '</div>' +
          '<div style="font-size:13px;color:#CBD5E1;">Nadie paga este tiempo. Checa tu salida.</div>' +
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
  { key: 'salida',   emoji: '🏠', label: 'Salida',   desc: 'Aviso antes de tu hora y tiempo regalado' }
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
  html += '<div id="perfil-alertas-status" style="font-size:12px;color:#64748B;text-align:right;padding:4px 4px 0;min-height:16px;"></div>';
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
