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
function _perfilGuardarSesion(usuario, persistente) {
  try {
    localStorage.setItem(_PERFIL_LS_SESION, JSON.stringify({
      pin: usuario.pin,
      idUsuario: usuario.idUsuario,
      nombre: usuario.nombre,
      turnoHorario: usuario.turnoHorario || '',
      persistente: !!persistente,
      ts: Date.now()
    }));
  } catch(e) {}
}

function _perfilLeerSesion() {
  try {
    var raw = localStorage.getItem(_PERFIL_LS_SESION);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}

function _perfilCerrarSesion() {
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
  // Si ya hay sesión guardada en este dispositivo, entrar directo
  var sesion = _perfilLeerSesion();
  if (sesion && sesion.pin) {
    abrirPerfil(sesion);
    return;
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
      'radial-gradient(circle at 50% 38%, #312e81 0%, #1e1b4b 48%, #0c0821 100%)';
  }
  if (box) {
    box.style.transition = 'filter 0.45s ease';
    box.style.filter = 'hue-rotate(55deg) saturate(1.15)'; // anillo azul → violeta
  }
  if (btn) {
    btn.innerHTML = '✕ Cancelar';
    btn.style.color = '#C4B5FD';
    btn.style.borderColor = 'rgba(167,139,250,0.45)';
  }

  // Etiqueta "MODO PERFIL" arriba del anillo
  var tag = document.getElementById('perfil-mode-tag');
  if (!tag && overlay) {
    tag = document.createElement('div');
    tag.id = 'perfil-mode-tag';
    tag.innerHTML = '👤 MODO PERFIL — entra con tu PIN y contraseña';
    tag.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:100000;' +
      'padding:9px 20px;border-radius:999px;background:rgba(76,29,149,0.4);color:#DDD6FE;' +
      'border:1px solid rgba(167,139,250,0.4);font-size:13px;font-weight:700;letter-spacing:1px;' +
      'backdrop-filter:blur(8px);white-space:nowrap;';
    overlay.appendChild(tag);
  }

  // Checkbox "mantener sesión" abajo, centrado
  var keep = document.getElementById('perfil-keep-wrap');
  if (!keep && overlay) {
    keep = document.createElement('label');
    keep.id = 'perfil-keep-wrap';
    keep.innerHTML =
      '<input id="perfil-keep" type="checkbox" style="width:17px;height:17px;accent-color:#8B5CF6;vertical-align:middle;"> ' +
      '<span style="vertical-align:middle;">Mantener mi sesión en este dispositivo</span>';
    keep.style.cssText =
      'position:fixed;bottom:66px;left:50%;transform:translateX(-50%);z-index:100000;' +
      'color:#A5B4FC;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;' +
      'background:rgba(15,23,42,0.55);padding:8px 16px;border-radius:999px;backdrop-filter:blur(6px);';
    overlay.appendChild(keep);
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
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:100001;overflow-y:auto;' +
    'background:radial-gradient(circle at 50% -10%, #1e1b4b 0%, #0B1120 55%);' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

  var inicial = (sesion.nombre || '?').trim().charAt(0).toUpperCase();

  overlay.innerHTML =
    '<div style="max-width:640px;margin:0 auto;padding:24px 18px 70px;">' +

      // Header con avatar
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">' +
        '<div style="display:flex;align-items:center;gap:14px;">' +
          '<div style="width:54px;height:54px;border-radius:50%;flex-shrink:0;' +
                 'background:linear-gradient(135deg,#7C3AED,#3B82F6);display:flex;align-items:center;justify-content:center;' +
                 'font-size:24px;font-weight:800;color:#fff;box-shadow:0 4px 18px rgba(124,58,237,0.35);">' +
            inicial +
          '</div>' +
          '<div>' +
            '<div style="font-size:21px;font-weight:800;color:#F1F5F9;letter-spacing:-0.3px;line-height:1.2;">' + sesion.nombre + '</div>' +
            '<div style="font-size:14px;color:#A5B4FC;margin-top:3px;font-weight:600;">' +
              (sesion.turnoHorario ? '🕐 ' + sesion.turnoHorario : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button onclick="_perfilCerrarSesion()" ' +
                'style="padding:10px 18px;background:transparent;color:#F87171;border:1px solid rgba(248,113,113,0.35);' +
                       'border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">' +
          'Cerrar sesión' +
        '</button>' +
      '</div>' +

      // Cronómetro activo (se llena dinámicamente)
      '<div id="perfil-crono" style="display:none;margin-bottom:18px;"></div>' +

      // Veredicto de la última checada desde el perfil
      '<div id="perfil-veredicto" style="display:none;margin-bottom:18px;"></div>' +

      // Botones de checada
      '<div style="font-size:12px;color:#A5B4FC;text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:12px;">Registrar checada</div>' +
      '<div id="perfil-botones" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:28px;"></div>' +

      // Estado del día
      '<div style="font-size:12px;color:#A5B4FC;text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:12px;">Hoy</div>' +
      '<div id="perfil-hoy" style="margin-bottom:28px;">' +
        '<div style="color:#64748B;font-size:14px;font-style:italic;padding:8px 0;">Cargando...</div>' +
      '</div>' +

      // Historial
      '<div style="font-size:12px;color:#A5B4FC;text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:12px;">Últimos 7 días</div>' +
      '<div id="perfil-historial">' +
        '<div style="color:#64748B;font-size:14px;font-style:italic;padding:8px 0;">Cargando...</div>' +
      '</div>' +

    '</div>';
  document.body.appendChild(overlay);

  _perfilPintarBotones(sesion);
  _perfilCargarDatos(sesion);
  _perfilIniciarCrono(sesion);

  // Auto-cierre por inactividad SOLO si la sesión no es persistente
  if (!sesion.persistente) {
    _perfilResetInactividad();
    overlay.addEventListener('click', _perfilResetInactividad);
    overlay.addEventListener('touchstart', _perfilResetInactividad);
    overlay.addEventListener('scroll', _perfilResetInactividad, true);
  }
}

function _perfilResetInactividad() {
  if (_perfilTimerInactividad) clearTimeout(_perfilTimerInactividad);
  _perfilTimerInactividad = setTimeout(function() {
    console.log('⏲️ Perfil cerrado por inactividad');
    _perfilCerrarSesion();
  }, 60000);
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
              'style="padding:22px 12px;background:rgba(255,255,255,0.045);border:1.5px solid ' + b.color + '55;' +
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

  // Veredicto ANTES de registrar local (usa las checadas previas para calcular duraciones)
  var veredicto = _calcularVeredicto(tipo, sesion.idUsuario, ahora);
  var etiqueta  = _ETIQUETAS_TIPO[tipo] || _ETIQUETAS_TIPO['EXTRA'];

  _registrarChecadaLocal(sesion.idUsuario, tipo, ahora.getTime());

  var uuid = (window.OfflineQueue && OfflineQueue.generarUuid)
    ? OfflineQueue.generarUuid()
    : (Date.now() + '-' + Math.random().toString(36).substr(2, 9));

  _enviarOEncolarChecada({
    uuid: uuid,
    idUsuario: sesion.idUsuario,
    nombre: sesion.nombre,
    fecha: fecha,
    hora: hora,
    timestampCompleto: timestamp,
    clienteTimestamp: ahora.toISOString(),
    tipo: tipo,
    lat: '', lng: '', accuracy: '',
    estadoZona: 'VÁLIDA', zonaCercana: '', distancia: 0
  });

  // Mostrar veredicto en banner dentro del perfil
  var box = document.getElementById('perfil-veredicto');
  if (box) {
    box.style.display = 'block';
    box.innerHTML =
      '<div style="background:rgba(255,255,255,0.04);border:1px solid ' + veredicto.color + '55;border-left:5px solid ' + veredicto.color + ';' +
             'border-radius:12px;padding:16px 18px;">' +
        '<div style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;font-weight:700;">' +
          etiqueta.emoji + ' ' + etiqueta.label + ' · ' + hora.substring(0, 5) +
        '</div>' +
        '<div style="font-size:17px;font-weight:800;color:' + veredicto.color + ';margin-top:4px;">' + veredicto.texto + '</div>' +
        (veredicto.detalle ? '<div style="font-size:13px;color:#CBD5E1;margin-top:4px;">' + veredicto.detalle + '</div>' : '') +
      '</div>';
  }

  _perfilPintarHoyLocal(sesion);
  _perfilIniciarCrono(sesion);
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

      // Sincronizar registro local con lo del backend (fuente de verdad):
      // así los cronómetros funcionan aunque haya checado en otro dispositivo.
      try {
        var data = _leerChecadasDia();
        var key = (sesion.idUsuario || '').toString();
        var delBackend = (result.checadasHoy || []).map(function(c) {
          var ts = new Date(c.fecha + 'T' + c.hora).getTime();
          return { tipo: c.tipo, ts: isNaN(ts) ? Date.now() : ts };
        });
        if (delBackend.length >= (data.porUsuario[key] || []).length) {
          data.porUsuario[key] = delBackend;
          localStorage.setItem(_LS_KEY_CHECADAS_DIA, JSON.stringify(data));
        }
      } catch(e) {}

      _perfilPintarHoyLocal(sesion);
      _perfilIniciarCrono(sesion);
      _perfilPintarHistorial(result.historial || {});
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
             'background:rgba(255,255,255,0.03);border-radius:10px;margin-bottom:6px;border:1px solid rgba(255,255,255,0.05);">' +
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
  var html = '';
  fechas.forEach(function(f) {
    if (f === hoy) return; // hoy ya se muestra arriba
    var items = historial[f].map(function(c) {
      var et = _ETIQUETAS_TIPO[c.tipo] || _ETIQUETAS_TIPO['EXTRA'];
      return et.emoji + ' ' + (c.hora || '').substring(0, 5);
    }).join(' · ');
    html += (
      '<div style="padding:10px 15px;background:rgba(255,255,255,0.02);border-radius:10px;margin-bottom:6px;border:1px solid rgba(255,255,255,0.04);">' +
        '<div style="font-size:12px;color:#94A3B8;font-weight:700;margin-bottom:3px;">' + f + '</div>' +
        '<div style="font-size:13px;color:#CBD5E1;">' + (items || '—') + '</div>' +
      '</div>'
    );
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
    var limMin = esDes ? _DURACION_DESAYUNO_MIN : _DURACION_COMIDA_MIN;
    var trans = Math.floor((ahora.getTime() - ultima.ts) / 1000);
    var limSeg = limMin * 60;
    var excedido = trans > limSeg;
    var color = excedido ? '#EF4444' : (trans > limSeg - 300 ? '#F59E0B' : '#3B82F6');
    var titulo = esDes ? '🥐 Desayuno en curso' : '🍽️ Comida en curso';

    box.style.display = 'block';
    box.innerHTML =
      '<div style="background:rgba(255,255,255,0.04);border:1px solid ' + color + '55;border-radius:14px;padding:18px;text-align:center;">' +
        '<div style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">' + titulo + '</div>' +
        '<div style="font-size:38px;font-weight:800;color:' + color + ';font-variant-numeric:tabular-nums;margin:6px 0 2px;">' + fmt(trans) + '</div>' +
        '<div style="font-size:13px;color:#CBD5E1;">' +
          (excedido
            ? '❌ Exceso de ' + Math.floor((trans - limSeg) / 60) + ' min — ¡CORRE! Por UN minuto te descuentan UNA HORA. Aquí no perdonan ni una.'
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
          '<div style="font-size:13px;color:#CBD5E1;">Tiempo trabajado de más que nadie te va a pagar. Tu salida era a las ' +
            String(turno.fin.h).padStart(2, '0') + ':' + String(turno.fin.m).padStart(2, '0') + '. Checa tu salida y vete a descansar.</div>' +
        '</div>';
      return;
    }
  }

  // 3) Nada activo → ocultar
  box.style.display = 'none';
}

console.log('✅ Perfil módulo cargado');
