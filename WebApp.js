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

      // ⭐ AUTO-MIGRACIÓN: si el cache es de una versión vieja que no incluye
      // turnoHorario (necesario para los veredictos), resincronizar solo.
      // Así ningún dispositivo necesita pasos manuales tras actualizar.
      if (navigator.onLine !== false && !_cacheTieneTurnos(_usuariosCache)) {
        console.log('🔄 Cache sin turnos detectado — auto-resincronizando...');
        _usuariosCache = null;
        try { localStorage.removeItem('em_usuarios_cache'); } catch(e) {}
        _sincronizarUsuarios(callback);
        return;
      }

      if (callback) callback(_usuariosCache);
      _chequearVersionEnBackground();
      return;
    }
  } catch(e) {}
  _sincronizarUsuarios(callback);
}

// ¿El cache incluye turnoHorario en al menos un usuario CHOFER?
function _cacheTieneTurnos(cache) {
  try {
    for (var pin in cache) {
      var u = cache[pin];
      if (u && u.tipo === 'CHOFER') {
        return typeof u.turnoHorario !== 'undefined' && typeof u.cfgTurno !== 'undefined';
      }
    }
  } catch(e) {}
  return true; // sin choferes en cache → no hay nada que migrar
}

// Chequea en background si el servidor tiene una versión más nueva del cache.
// Si la versión cambió (ADMIN sincronizó desde Sheets), invalida el cache local
// y vuelve a sincronizar sin bloquear nada. El usuario actual sigue viendo el
// PIN normalmente; la próxima carga de la app ya tendrá los datos nuevos.
function _chequearVersionEnBackground() {
  // Sin internet → omitir (evita esperar timeout). Cuando vuelva internet
  // se llamará otra vez al recargar la app.
  if (navigator.onLine === false) return;
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
  // ⭐ Sin internet → no llamar al backend (evita esperar timeout de ~10s)
  // y usar lo que haya en localStorage. Si no hay nada, callback con mapa vacío.
  if (navigator.onLine === false) {
    console.log('📡 Sin internet — usando usuarios del cache local');
    if (!_usuariosCache) {
      try {
        var guardado = localStorage.getItem('em_usuarios_cache');
        if (guardado) _usuariosCache = JSON.parse(guardado);
      } catch(e) {}
      if (!_usuariosCache) _usuariosCache = {};
    }
    if (callback) callback(_usuariosCache);
    return;
  }

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
      try {
        localStorage.setItem('em_usuarios_cache', JSON.stringify(mapa));
        localStorage.setItem('em_usuarios_cache_timestamp', Date.now().toString());
      } catch(e) {}

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
// REGISTRO EN VIVO — Tipos de checada + veredictos (Fase 1)
// ─────────────────────────────────────────────────────────────────────────────
// El día de cada empleado tiene 6 eventos en orden fijo:
//   1. ENTRADA → 2. SALIDA_DESAYUNO → 3. REGRESO_DESAYUNO →
//   4. SALIDA_COMIDA → 5. REGRESO_COMIDA → 6. SALIDA  (7+ = EXTRA)
// El flujo rápido de PIN detecta el tipo automáticamente contando cuántas
// checadas lleva HOY (registro local en localStorage, funciona offline).
// El perfil (Fase 2) permitirá elegir el tipo manualmente.
//
// Reglas de veredicto (SIN tolerancia, orden de Electronics):
//   ENTRADA: vs hora inicio del turno → puntual o retardo de X min
//   DESAYUNO: 20 min máx → al regresar se calcula si hubo exceso
//   COMIDA:   60 min máx → igual
//   SALIDA:   vs hora fin del turno → a tiempo, antes, o X min extra

var _LS_KEY_CHECADAS_DIA = 'em_checadas_dia';
// Fallbacks — los valores reales vienen POR TURNO de CONFIG_TURNOS vía el
// cache de usuarios (cfgTurno). Usa _durDesayunoDe/_durComidaDe.
var _DURACION_DESAYUNO_MIN = 20;
var _DURACION_COMIDA_MIN   = 60;

// Config del turno del empleado desde el cache de usuarios (CONFIG_TURNOS)
function _cfgTurnoDe(idUsuario) {
  try {
    if (!_usuariosCache) return null;
    for (var pin in _usuariosCache) {
      var u = _usuariosCache[pin];
      if (u && _normId(u.idUsuario) === _normId(idUsuario)) {
        return u.cfgTurno || null;
      }
    }
  } catch(e) {}
  return null;
}
function _durDesayunoDe(idUsuario) {
  var c = _cfgTurnoDe(idUsuario);
  return (c && c.desDur) ? c.desDur : _DURACION_DESAYUNO_MIN;
}
function _durComidaDe(idUsuario) {
  var c = _cfgTurnoDe(idUsuario);
  return (c && c.comDur) ? c.comDur : _DURACION_COMIDA_MIN;
}

var _ORDEN_TIPOS = ['ENTRADA', 'SALIDA_DESAYUNO', 'REGRESO_DESAYUNO',
                    'SALIDA_COMIDA', 'REGRESO_COMIDA', 'SALIDA'];

var _ETIQUETAS_TIPO = {
  'ENTRADA':          { emoji: '🏢', label: 'Entrada' },
  'SALIDA_DESAYUNO':  { emoji: '🥐', label: 'Salida a desayuno' },
  'REGRESO_DESAYUNO': { emoji: '🥐', label: 'Regreso de desayuno' },
  'SALIDA_COMIDA':    { emoji: '🍽️', label: 'Salida a comida' },
  'REGRESO_COMIDA':   { emoji: '🍽️', label: 'Regreso de comida' },
  'SALIDA':           { emoji: '🏠', label: 'Salida' },
  'EXTRA':            { emoji: '➕', label: 'Registro extra' },
  'FUERA_HORARIO':    { emoji: '⛔', label: 'Fuera de horario' }
};

// ── Registro local de checadas del día (persiste offline) ──────────────────
function _leerChecadasDia() {
  var hoy = _fechaHoyLocal();
  try {
    var raw = localStorage.getItem(_LS_KEY_CHECADAS_DIA);
    if (raw) {
      var data = JSON.parse(raw);
      if (data && data.fecha === hoy && data.porUsuario) return data;
    }
  } catch(e) {}
  return { fecha: hoy, porUsuario: {} };
}

function _fechaHoyLocal() {
  var d = new Date();
  return d.getFullYear() + '-' +
         String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

function _registrarChecadaLocal(idUsuario, tipo, ts) {
  var data = _leerChecadasDia();
  var key = _normId(idUsuario);
  if (!data.porUsuario[key]) data.porUsuario[key] = [];
  data.porUsuario[key].push({ tipo: tipo, ts: ts });
  try { localStorage.setItem(_LS_KEY_CHECADAS_DIA, JSON.stringify(data)); } catch(e) {}
}

function _checadasHoyDe(idUsuario) {
  var data = _leerChecadasDia();
  return data.porUsuario[_normId(idUsuario)] || [];
}

// ── Detección automática del tipo por ESTADO del día ───────────────────────
// Antes se detectaba por conteo (1ª checada=ENTRADA, 2ª=DESAYUNO...), pero al
// mezclar checadas manuales del perfil (que pueden ir en cualquier orden) con
// el flujo del PIN, el conteo se desalineaba. Ahora se deduce por el estado
// real del día — tolera cualquier combinación de PIN + botones manuales:
//   1. ¿La última checada fue salida a desayuno/comida? → toca el REGRESO
//   2. ¿No hay entrada aún? → ENTRADA
//   3. ¿Falta el desayuno? → SALIDA_DESAYUNO; ¿falta comida? → SALIDA_COMIDA
//   4. ¿Falta la salida? → SALIDA; todo hecho → EXTRA
function _detectarTipoChecada(idUsuario) {
  // Espejo de la lógica del backend: POR HORA contra las ventanas de
  // CONFIG_TURNOS (solo se usa OFFLINE — online el sheet decide).
  var checadas = _checadasHoyDe(idUsuario).filter(function(c) { return c && c.tipo; });
  function tiene(t) { return checadas.some(function(c) { return c.tipo === t; }); }
  var ult = checadas.length ? checadas[checadas.length - 1] : null;
  if (ult && ult.tipo === 'SALIDA_DESAYUNO') return 'REGRESO_DESAYUNO';
  if (ult && ult.tipo === 'SALIDA_COMIDA')   return 'REGRESO_COMIDA';

  var ahora = new Date();
  var minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  var c = _cfgTurnoDe(idUsuario) || {};
  var turno = _turnoDe(idUsuario);
  var finMin = turno ? (turno.fin.h * 60 + turno.fin.m) : (c.salidaMin != null ? c.salidaMin : null);
  var inicioMin = turno ? (turno.inicio.h * 60 + turno.inicio.m) : (c.entradaMin != null ? c.entradaMin : null);
  function enVentana(a, b) { return a != null && b != null && minAhora >= a && minAhora <= b; }

  // ⛔ Fuera de horario: entrada solo desde 2h antes; tras la salida, nada
  var entradaDesde = (inicioMin != null) ? inicioMin - 120 : null;
  if (!tiene('ENTRADA')) {
    if (finMin != null && minAhora > finMin) return 'FUERA_HORARIO';
    if (entradaDesde != null && minAhora < entradaDesde) return 'FUERA_HORARIO';
  }

  if (!tiene('SALIDA_COMIDA') && enVentana(c.comMin, c.comMax)) return 'SALIDA_COMIDA';
  if (!tiene('ENTRADA') && (c.comMin == null || minAhora < c.comMin)) return 'ENTRADA';
  if (!tiene('SALIDA_DESAYUNO') && enVentana(c.desMin, c.desMax)) return 'SALIDA_DESAYUNO';
  if (!tiene('SALIDA') && finMin != null && minAhora >= finMin - 90) return 'SALIDA';

  if (!tiene('ENTRADA'))          return 'ENTRADA';
  if (!tiene('SALIDA_DESAYUNO') && (c.desMax == null || minAhora <= c.desMax)) return 'SALIDA_DESAYUNO';
  if (!tiene('SALIDA_COMIDA')   && (c.comMax == null || minAhora <= c.comMax)) return 'SALIDA_COMIDA';
  if (!tiene('SALIDA'))           return 'SALIDA';
  return 'EXTRA';
}

// ── Turno del empleado desde el cache de usuarios ──────────────────────────
// turnoHorario viene del backend con formato "10:00 - 19:00".
// Devuelve { inicio: {h, m}, fin: {h, m} } o null si no está disponible.
function _turnoDe(idUsuario) {
  try {
    if (!_usuariosCache) return null;
    for (var pin in _usuariosCache) {
      var u = _usuariosCache[pin];
      if (u && (u.idUsuario || '').toString() === (idUsuario || '').toString() && u.turnoHorario) {
        var m = u.turnoHorario.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
        if (m) {
          return {
            inicio: { h: parseInt(m[1], 10), m: parseInt(m[2], 10) },
            fin:    { h: parseInt(m[3], 10), m: parseInt(m[4], 10) }
          };
        }
      }
    }
  } catch(e) {}
  return null;
}

function _minutosDesdeMedianoche(d) {
  return d.getHours() * 60 + d.getMinutes();
}

function _formatearHora(totalMin) {
  var h = Math.floor(totalMin / 60) % 24;
  var m = totalMin % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// ── Cálculo del VEREDICTO de una checada ───────────────────────────────────
// Devuelve { texto, color, detalle } listo para pintar en la pantalla verde.
//   color: '#3ddc84' ok · '#fbbf24' aviso · '#ef4444' malo
function _calcularVeredicto(tipo, idUsuario, ahora) {
  var minAhora = _minutosDesdeMedianoche(ahora);
  var turno = _turnoDe(idUsuario);
  var checadas = _checadasHoyDe(idUsuario);

  function ultima(tipoBuscado) {
    for (var i = checadas.length - 1; i >= 0; i--) {
      if (checadas[i].tipo === tipoBuscado) return checadas[i];
    }
    return null;
  }

  switch (tipo) {
    case 'ENTRADA': {
      var t = _turnoDe(idUsuario);
      if (!t) return { texto: 'Entrada registrada', color: '#3ddc84', detalle: '' };
      var iniM = t.inicio.h * 60 + t.inicio.m;
      var cfgT = _cfgTurnoDe(idUsuario) || {};
      var tol = cfgT.tolerancia || 15;
      var limTol = iniM + tol, limRet = iniM + 30;
      var ret = minAhora - iniM;
      if (ret <= tol) return { texto: '✅ Entrada a tiempo', color: '#3ddc84',
                               detalle: 'Apto para el bono de puntualidad.' };
      if (ret <= 30) return { texto: '❌ Perdiste el bono', color: '#ef4444',
                              detalle: (minAhora - limTol) + ' min pasado el límite de las ' + _formatearHora(limTol) +
                                       '. Aún no es retardo (' + _formatearHora(limRet + 1) + ').' };
      return { texto: '❌ Retardo', color: '#ef4444',
               detalle: (minAhora - limRet) + ' min pasado el límite de las ' + _formatearHora(limRet) +
                        '. 3 retardos = MEDIO DÍA.' };
    }

    case 'SALIDA_DESAYUNO': {
      var _dd1 = _durDesayunoDe(idUsuario);
      var limite = minAhora + _dd1;
      return { texto: '¡Provecho!', color: '#3ddc84',
               detalle: 'Tienes ' + _dd1 + ' min · Regresa antes de las ' + _formatearHora(limite) };
    }

    case 'REGRESO_DESAYUNO': {
      var salidaD = ultima('SALIDA_DESAYUNO');
      if (!salidaD) return { texto: '🥐 Regreso de desayuno', color: '#3ddc84', detalle: '' };
      var durD = Math.round((ahora.getTime() - salidaD.ts) / 60000);
      var _dd2 = _durDesayunoDe(idUsuario);
      if (durD <= _dd2) {
        return { texto: '✅ Regreso a tiempo', color: '#3ddc84',
                 detalle: 'Desayuno de ' + durD + ' min (límite ' + _dd2 + ')' };
      }
      var excD = durD - _dd2;
      return { texto: '❌ Exceso de ' + excD + ' min en desayuno', color: '#ef4444',
               detalle: durD + ' min de ' + _dd2 + '. Se descuenta UNA HORA.' };
    }

    case 'SALIDA_COMIDA': {
      var _dc1 = _durComidaDe(idUsuario);
      var limiteC = minAhora + _dc1;
      return { texto: '¡Provecho!', color: '#3ddc84',
               detalle: 'Tienes ' + _dc1 + ' min · Regresa antes de las ' + _formatearHora(limiteC) };
    }

    case 'REGRESO_COMIDA': {
      var salidaC = ultima('SALIDA_COMIDA');
      if (!salidaC) return { texto: '🍽️ Regreso de comida', color: '#3ddc84', detalle: '' };
      var durC = Math.round((ahora.getTime() - salidaC.ts) / 60000);
      var _dc2 = _durComidaDe(idUsuario);
      if (durC <= _dc2) {
        return { texto: '✅ Regreso a tiempo', color: '#3ddc84',
                 detalle: 'Comida de ' + durC + ' min (límite ' + _dc2 + ')' };
      }
      var excC = durC - _dc2;
      return { texto: '❌ Exceso de ' + excC + ' min en comida', color: '#ef4444',
               detalle: durC + ' min de ' + _dc2 + '. Se descuenta UNA HORA.' };
    }

    case 'SALIDA': {
      if (!turno) return { texto: '🏠 Salida registrada', color: '#3ddc84', detalle: '' };
      var minFin = turno.fin.h * 60 + turno.fin.m;
      if (minAhora > minFin) {
        var extra = minAhora - minFin;
        return { texto: '⏱️ ' + extra + ' minutos regalados', color: '#fbbf24',
                 detalle: 'Nadie paga este tiempo. ' +
                          'Tu salida era a las ' + _formatearHora(minFin) + '.' };
      }
      if (minAhora < minFin) {
        var antes = minFin - minAhora;
        return { texto: '🏃 Saliste ' + antes + ' min antes', color: '#fbbf24',
                 detalle: 'Tu salida es a las ' + _formatearHora(minFin) };
      }
      return { texto: '✅ Salida a tiempo', color: '#3ddc84',
               detalle: 'Justo a las ' + _formatearHora(minFin) + '. Perfecto.' };
    }

    case 'FUERA_HORARIO': {
      var t = _turnoDe(idUsuario);
      if (t) {
        var finM = t.fin.h * 60 + t.fin.m;
        var iniM = t.inicio.h * 60 + t.inicio.m;
        if (minAhora > finM) {
          return { texto: '⛔ Ya pasó tu hora de salida', color: '#ef4444',
                   detalle: 'Tu horario terminó a las ' + _formatearHora(finM) + '. Ya vete a descansar.' };
        }
        return { texto: '🌙 Aún no es hora de checar', color: '#fbbf24',
                 detalle: 'Puedes checar desde las ' + _formatearHora(Math.max(0, iniM - 120)) + '.' };
      }
      return { texto: '⛔ Fuera de horario', color: '#fbbf24', detalle: 'Vuelve más cerca de tu horario.' };
    }
    default:
      return { texto: '➕ Registro extra', color: '#3ddc84', detalle: 'Checada adicional del día' };
  }
}

// Regla solicitada por Electronics:
//   < 24h    → confiar 100%, sin aviso
//   24h–7d   → permitir checar pero avisar al usuario
//   > 7d     → rechazar, forzar reconexión
// Devuelve: { ok, edadMs, edadDias, mensaje } — mensaje vacío si no hay nada que mostrar
function _verificarEdadCacheUsuarios() {
  var resultado = { ok: true, edadMs: 0, edadDias: 0, mensaje: '' };
  try {
    var ts = parseInt(localStorage.getItem('em_usuarios_cache_timestamp') || '0', 10);
    if (!ts || isNaN(ts)) {
      // Sin timestamp registrado → cache podría ser anterior a esta feature.
      // No bloqueamos pero avisamos.
      resultado.mensaje = '';
      return resultado;
    }
    var ahora = Date.now();
    var edadMs = ahora - ts;
    var edadHoras = edadMs / (1000 * 60 * 60);
    var edadDias  = edadMs / (1000 * 60 * 60 * 24);
    resultado.edadMs   = edadMs;
    resultado.edadDias = edadDias;

    if (edadHoras < 24) {
      // Todo bien
      return resultado;
    }
    if (edadDias <= 7) {
      resultado.mensaje = '⚠️ Datos de hace ' + Math.floor(edadDias) + ' día(s). Conéctate pronto.';
      return resultado;
    }
    // > 7 días
    resultado.ok = false;
    resultado.mensaje = '❌ Datos muy viejos (>' + Math.floor(edadDias) +
                       ' días). Conéctate a internet para usar el checador.';
    return resultado;
  } catch(e) {
    return resultado;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVIAR O ENCOLAR CHECADA — decide según conexión
// ─────────────────────────────────────────────────────────────────────────────
// Si hay internet → manda directo a GAS (con uuid + clienteTimestamp).
// Si NO hay internet → encola en IndexedDB, se mandará al volver internet.
// El backend acepta uuid para deduplicación (si la PWA crash a mitad del envío
// y vuelve a mandar, no se duplica la fila en CHECADOR_CHOFERES).
function _enviarOEncolarChecada(datos) {
  var hayInternet = navigator.onLine !== false;
  var tieneCola = window.OfflineQueue && typeof OfflineQueue.encolar === 'function';

  if (!hayInternet && tieneCola) {
    // Sin internet → encolar
    OfflineQueue.encolar(datos).then(function() {
      console.log('📥 Checada encolada offline:', datos.uuid);
    }).catch(function(err) {
      console.error('❌ Error encolando offline:', err);
      // Fallback: intentar enviar directo aunque sea sin internet (probablemente falle)
      _enviarDirecto(datos);
    });
    return;
  }

  // Con internet → mandar directo
  _enviarDirecto(datos);
}

function _enviarDirecto(datos) {
  google.script.run
    .withSuccessHandler(function(result) {
      if (!result || !result.ok) {
        console.warn('⚠️ guardarChecadaChofer respondió error:', result && result.message);
        // Si falla por timeout / red intermitente, encolar como fallback
        if (window.OfflineQueue) {
          OfflineQueue.encolar(datos).catch(function() {});
        }
        return;
      }
      // ⭐ AUTO-CORRECCIÓN: el servidor devuelve las checadas de HOY según el
      // sheet. Sobrescribimos el registro local con eso — si el local estaba
      // desincronizado (pruebas borradas, otro dispositivo), la SIGUIENTE
      // checada ya detecta el tipo correcto.
      if (result.checadasHoyServidor && window.OfflineQueue) {
        OfflineQueue.contar().then(function(n) {
          if (n > 0) return; // hay checadas pendientes de enviar — no tocar
          try {
            var data = _leerChecadasDia();
            var key = _normId(datos.idUsuario);
            data.porUsuario[key] = result.checadasHoyServidor.map(function(c) {
              var ts = new Date(c.fecha + 'T' + c.hora).getTime();
              return { tipo: c.tipo, ts: isNaN(ts) ? Date.now() : ts };
            });
            localStorage.setItem(_LS_KEY_CHECADAS_DIA, JSON.stringify(data));
            console.log('🔄 Registro local del día sincronizado con servidor (' +
                        data.porUsuario[key].length + ' checadas)');
          } catch(e) {}
        }).catch(function() {});
      }
    })
    .withFailureHandler(function(err) {
      console.warn('⚠️ guardarChecadaChofer falló:', err && err.message);
      // Red caída a mitad de la llamada → encolar para reintento
      if (window.OfflineQueue) {
        OfflineQueue.encolar(datos).catch(function() {});
      }
    })
    .guardarChecadaChofer(datos);
}

// ─────────────────────────────────────────────────────────────────────────────
// PANTALLA DE ACCESO
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// SITIO ELECTRONICS — abre electronicsmexico.site/checador en pestaña real
// ─────────────────────────────────────────────────────────────────────────────
// El sitio NO permite iframes (bloqueado por su hosting), así que se abre en
// una pestaña/Custom Tab de Chrome con window.open(). La PWA conserva la
// referencia y a los 15 segundos CIERRA esa pestaña automáticamente → el
// empleado cae de vuelta al checador. Mientras tanto, la PWA muestra una
// pantalla de espera con el contador grande.
var _SITIO_AUTOREGRESO_SEG = 7;
var _sitioTimerRegreso = null;
var _sitioVentana = null;

function abrirSitioElectronics() {
  var viejo = document.getElementById('sitio-electronics-overlay');
  if (viejo) viejo.remove();
  if (_sitioTimerRegreso) { clearInterval(_sitioTimerRegreso); _sitioTimerRegreso = null; }

  // Abrir la pestaña DENTRO del gesto del usuario (para que Chrome no la bloquee)
  _sitioVentana = window.open('https://electronicsmexico.site/checador', '_blank');

  // Pantalla de espera en la PWA con contador grande
  var ov = document.createElement('div');
  ov.id = 'sitio-electronics-overlay';
  ov.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;z-index:100005;' +
    'background:radial-gradient(circle at 50% 50%, #0e1d3a 0%, #050b18 100%);' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:24px;';

  if (_sitioVentana) {
    ov.innerHTML =
      '<div style="font-size:17px;color:#94A3B8;font-weight:600;text-align:center;">🌐 Sitio Electronics abierto</div>' +
      '<div style="font-size:15px;color:#64748B;text-align:center;max-width:340px;line-height:1.5;">' +
        'Haz tu registro con el QR. La pestaña se cerrará sola y regresarás aquí.' +
      '</div>' +
      '<div style="width:130px;height:130px;border-radius:50%;background:rgba(15,23,42,0.9);' +
             'border:4px solid #7fdfff;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
             'box-shadow:0 0 34px rgba(127,223,255,0.4);">' +
        '<div id="sitio-contador-num" style="font-size:52px;font-weight:800;color:#7fdfff;line-height:1;font-variant-numeric:tabular-nums;">' +
          _SITIO_AUTOREGRESO_SEG +
        '</div>' +
        '<div style="font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:2px;margin-top:4px;">regreso</div>' +
      '</div>' +
      '<div style="display:flex;gap:12px;">' +
        '<button onclick="_sitioMasTiempo()" ' +
                'style="padding:12px 22px;border-radius:999px;background:rgba(30,41,59,0.8);color:#94A3B8;' +
                       'border:1px solid rgba(255,255,255,0.15);font-size:14px;font-weight:700;cursor:pointer;">+30s</button>' +
        '<button onclick="cerrarSitioElectronics()" ' +
                'style="padding:12px 22px;border-radius:999px;background:rgba(15,23,42,0.9);color:#7fdfff;' +
                       'border:1px solid rgba(127,223,255,0.4);font-size:14px;font-weight:700;cursor:pointer;">← Volver ya</button>' +
      '</div>';
  } else {
    // Popup bloqueado por el navegador → botón manual (el click directo siempre pasa)
    ov.innerHTML =
      '<div style="font-size:16px;color:#F59E0B;font-weight:700;text-align:center;">El navegador bloqueó la apertura automática</div>' +
      '<a href="https://electronicsmexico.site/checador" target="_blank" rel="noopener" ' +
         'onclick="setTimeout(function(){ cerrarSitioElectronics(); }, ' + (_SITIO_AUTOREGRESO_SEG * 1000) + ');" ' +
         'style="padding:16px 30px;border-radius:14px;background:linear-gradient(135deg,#2456a8,#1e90ff);color:#fff;' +
                'font-size:17px;font-weight:800;text-decoration:none;">🌐 Abrir sitio Electronics</a>' +
      '<button onclick="cerrarSitioElectronics()" ' +
              'style="padding:10px 20px;border-radius:999px;background:transparent;color:#64748B;' +
                     'border:1px solid rgba(255,255,255,0.12);font-size:13px;cursor:pointer;">← Volver al checador</button>';
  }
  document.body.appendChild(ov);

  // Cuenta regresiva → al llegar a 0 cierra la pestaña del sitio y limpia
  if (_sitioVentana) {
    window._sitioSegundosRestantes = _SITIO_AUTOREGRESO_SEG;
    _sitioTimerRegreso = setInterval(function() {
      window._sitioSegundosRestantes--;
      var num = document.getElementById('sitio-contador-num');
      if (num) num.textContent = window._sitioSegundosRestantes;
      if (window._sitioSegundosRestantes <= 0) cerrarSitioElectronics();

      // ⭐ Si el empleado cerró la pestaña él mismo → limpiar de inmediato
      try { if (_sitioVentana && _sitioVentana.closed) cerrarSitioElectronics(); } catch(e) {}
    }, 1000);

    // ⭐ Si el empleado REGRESA a la PWA por su cuenta (cambia de pestaña/app),
    // el contador ya no tiene sentido: cerrar la pestaña externa y limpiar YA.
    window._sitioOnVisible = function() {
      if (document.visibilityState === 'visible' &&
          document.getElementById('sitio-electronics-overlay')) {
        cerrarSitioElectronics();
      }
    };
    document.addEventListener('visibilitychange', window._sitioOnVisible);
  }
}

function _sitioMasTiempo() {
  window._sitioSegundosRestantes = (window._sitioSegundosRestantes || 0) + 30;
  var num = document.getElementById('sitio-contador-num');
  if (num) num.textContent = window._sitioSegundosRestantes;
}

function cerrarSitioElectronics() {
  if (_sitioTimerRegreso) { clearInterval(_sitioTimerRegreso); _sitioTimerRegreso = null; }
  if (window._sitioOnVisible) {
    document.removeEventListener('visibilitychange', window._sitioOnVisible);
    window._sitioOnVisible = null;
  }
  // ⭐ Cerrar la pestaña del sitio externo (permitido porque la abrió este script)
  try { if (_sitioVentana && !_sitioVentana.closed) _sitioVentana.close(); } catch(e) {}
  _sitioVentana = null;
  var ov = document.getElementById('sitio-electronics-overlay');
  if (ov) ov.remove();
  // La pantalla del PIN sigue intacta debajo
}

function mostrarPantallaPIN() {
  // ⭐ En celulares personales con sesión persistente, la primera carga de la
  // app abre directo el perfil del empleado (una sola vez por carga; después
  // de cerrar sesión o checar, el PIN se muestra normal).
  if (!window._perfilAutoAbierto) {
    window._perfilAutoAbierto = true;
    try {
      var ses = (typeof _perfilLeerSesion === 'function') ? _perfilLeerSesion() : null;
      if (ses && ses.persistente && typeof abrirPerfil === 'function') {
        setTimeout(function() { abrirPerfil(ses); }, 100);
      }
    } catch(e) {}
  }

  var viejo = document.getElementById('pin-overlay');
  if (viejo) viejo.remove();

  // Pre-cargar usuarios en background (si no están en localStorage, llama GAS)
  _cargarUsuariosCache(function() {});

  var overlay = document.createElement('div');
  overlay.id = 'pin-overlay';
  overlay.className = 'pin-overlay';

  // ⭐ Botón discreto de SINCRONIZAR (esquina inferior derecha del overlay).
  // Accesible desde cualquier dispositivo sin ser admin — fuerza la descarga
  // fresca de usuarios/turnos del backend. Útil tras actualizaciones.
  var btnSync = document.createElement('button');
  btnSync.id = 'btn-sync-usuarios';
  btnSync.title = 'Sincronizar usuarios y turnos';
  btnSync.innerHTML = '↻';
  btnSync.style.cssText =
    'position:fixed;bottom:16px;right:16px;z-index:100000;width:40px;height:40px;' +
    'border-radius:50%;background:rgba(30,41,59,0.75);color:#64748B;border:1px solid rgba(255,255,255,0.08);' +
    'font-size:18px;cursor:pointer;backdrop-filter:blur(6px);transition:all 0.2s;line-height:1;';
  btnSync.onclick = function() {
    if (navigator.onLine === false) {
      btnSync.innerHTML = '📡';
      setTimeout(function() { btnSync.innerHTML = '↻'; }, 1500);
      return;
    }
    btnSync.innerHTML = '⏳';
    btnSync.disabled = true;
    _usuariosCache = null;
    try { localStorage.removeItem('em_usuarios_cache'); } catch(e) {}
    // ⭐ También resetear el registro LOCAL de checadas del día. Si el admin
    // borró filas de CHECADOR_CHOFERES (pruebas), este botón limpia el
    // dispositivo y la detección de tipos reinicia desde ENTRADA.
    try { localStorage.removeItem(_LS_KEY_CHECADAS_DIA); } catch(e) {}
    _sincronizarUsuarios(function() {
      btnSync.innerHTML = '✓';
      btnSync.style.color = '#10B981';
      setTimeout(function() {
        btnSync.innerHTML = '↻';
        btnSync.style.color = '#64748B';
        btnSync.disabled = false;
      }, 2000);
    });
  };
  overlay.appendChild(btnSync);

  // ⭐ Botonera inferior CENTRADA: "Mi Perfil" + "Electronics" lado a lado
  var botonera = document.createElement('div');
  botonera.id = 'botonera-inferior';
  botonera.style.cssText =
    'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:100000;' +
    'display:flex;gap:12px;align-items:center;';

  var estiloBtn =
    'padding:11px 20px;border-radius:999px;background:rgba(30,41,59,0.75);color:#94A3B8;' +
    'border:1px solid rgba(255,255,255,0.1);font-size:13px;font-weight:600;cursor:pointer;' +
    'backdrop-filter:blur(6px);transition:all 0.2s;white-space:nowrap;';

  var btnPerfil = document.createElement('button');
  btnPerfil.id = 'btn-mi-perfil';
  btnPerfil.innerHTML = '👤 Mi Perfil';
  btnPerfil.style.cssText = estiloBtn;
  btnPerfil.onclick = function() {
    if (typeof abrirLoginPerfil === 'function') abrirLoginPerfil();
  };
  botonera.appendChild(btnPerfil);

  var btnSitio = document.createElement('button');
  btnSitio.id = 'btn-sitio-electronics';
  btnSitio.innerHTML = '🌐 Electronics';
  btnSitio.style.cssText = estiloBtn;
  btnSitio.onclick = function() { abrirSitioElectronics(); };
  botonera.appendChild(btnSitio);

  overlay.appendChild(botonera);

  // ⭐ Versión del frontend SIEMPRE visible (abajo izquierda, discreta)
  var verTag = document.createElement('div');
  verTag.id = 'frontend-version-tag';
  verTag.textContent = FRONTEND_VERSION;
  verTag.style.cssText =
    'position:fixed;bottom:calc(18px + env(safe-area-inset-bottom, 0px));left:14px;z-index:100000;' +
    'font-size:11px;color:rgba(148,163,184,0.55);font-family:monospace;letter-spacing:0.5px;pointer-events:none;';
  overlay.appendChild(verTag);

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

      // Campo Contraseña (mitad inferior) — OCULTO por default.
      // El flujo rápido de checada usa SOLO PIN; la contraseña únicamente
      // aparece en MODO PERFIL (activarModoPerfil la muestra).
      '<div id="campo-contrasena-wrap" class="ring-field ring-field--bottom" style="visibility:hidden;">' +
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
      if (ip.value.length >= 4) {
        if (window._modoPerfil && ic) {
          // Modo perfil: saltar al campo de contraseña
          setTimeout(function() { ic.focus(); }, 80);
        } else {
          // ⭐ Flujo rápido: SOLO PIN → checar directo (sin contraseña)
          ip.blur();
          if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
          }
          setTimeout(function() { procesarAcceso(); }, 100);
        }
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
    // ⭐ Focus automático al cargar (doble intento — a veces el primero llega
    // antes de que el overlay termine de pintar)
    setTimeout(function() { ip.focus(); }, 100);
    setTimeout(function() { if (document.activeElement !== ip) ip.focus(); }, 450);
    // ⭐ Tocar cualquier área vacía de la pantalla regresa el cursor al PIN
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay || (e.target && e.target.id === 'pin-box')) {
        var campo = window._modoPerfil ? document.getElementById('input-contrasena') : ip;
        if (campo) campo.focus();
      }
    });
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

  // ⭐ PIN 9999 = PANEL DE DIAGNÓSTICO (si no pertenece a un usuario real)
  if (pin === '9999' && !(_usuariosCache && _usuariosCache['9999'])) {
    _mostrarDiagnostico();
    return;
  }
  // ⭐ La contraseña solo se exige en MODO PERFIL; la checada rápida es solo PIN
  if (window._modoPerfil && !contrasena) { mostrarErrorAcceso('Ingresa tu contraseña'); return; }

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

    // CHOFER: la contraseña SOLO se valida en modo perfil
    if (window._modoPerfil && contrasena !== (usuario.contrasena || '').toString().trim()) {
      mostrarErrorAcceso('Contraseña incorrecta');
      if (btn) { btn.disabled = false; _setBtnLabel(btn, 'Entrar'); }
      var ic2 = document.getElementById('input-contrasena');
      if (ic2) { ic2.value = ''; ic2.focus(); }
      return;
    }

    // ⭐ MODO PERFIL activo → entrar al perfil en lugar de checar
    if (window._modoPerfil && typeof abrirPerfil === 'function') {
      var keepBtn = document.getElementById('perfil-keep-btn');
      var keepEl = document.getElementById('perfil-keep');
      var persistente = !!(keepBtn && keepBtn.dataset.on === '1') || !!(keepEl && keepEl.checked);
      _perfilGuardarSesion(usuario, persistente);
      desactivarModoPerfil();
      _setRingState('success');
      setTimeout(function() { abrirPerfil(_perfilLeerSesion()); }, 300);
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
      '<div id="flujo-status" class="ring-flow__status">Registrando checada...</div>' +
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

  // ⭐ CHECADA INMEDIATA — ya no hay validación de zona (decisión de
  // Electronics). El GPS se captura en background sin bloquear: si el
  // navegador tiene una ubicación cacheada (_gpsData) se registra como dato
  // informativo, pero la checada NO espera al GPS ni valida nada.
  solicitarUbicacion(3000); // fire-and-forget: refresca _gpsData para la próxima
  _registrarChecada(nombre, idUsuario, _gpsData, setStatus);
}

function _registrarChecada(nombre, idUsuario, gpsData, setStatus) {
  // ══════════════════════════════════════════════════════════════════════
  // ⭐ EL SHEET ES LA LEY: con internet, el TIPO y el VEREDICTO los decide
  // el BACKEND leyendo CHECADOR_CHOFERES en ese instante. El registro local
  // del dispositivo solo se usa como fallback cuando no hay conexión.
  // ══════════════════════════════════════════════════════════════════════
  var ahora = new Date();
  var TZ_MEX = 'America/Mexico_City';
  var fecha = ahora.toLocaleDateString('en-CA', { timeZone: TZ_MEX });
  var hora  = ahora.toLocaleTimeString('es-MX', {
    timeZone: TZ_MEX,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  var timestamp = ahora.toLocaleString('es-MX', { timeZone: TZ_MEX });

  var uuid = (window.OfflineQueue && OfflineQueue.generarUuid)
    ? OfflineQueue.generarUuid()
    : (Date.now() + '-' + Math.random().toString(36).substr(2, 9));

  var datos = {
    uuid: uuid,
    idUsuario: idUsuario,
    nombre: nombre,
    fecha: fecha,
    hora: hora,
    timestampCompleto: timestamp,
    clienteTimestamp: ahora.toISOString(),
    tipo: '',
    autoDetect: true, // el backend deduce el tipo con el SHEET
    lat: gpsData ? gpsData.lat : '',
    lng: gpsData ? gpsData.lng : '',
    accuracy: gpsData ? gpsData.accuracy : '',
    estadoZona: 'VÁLIDA', zonaCercana: '', distancia: 0
  };

  var online = navigator.onLine !== false;

  if (online && window.google && google.script && google.script.run) {
    // ── ONLINE: el backend decide con el sheet ──
    setStatus('Registrando...');
    var respondio = false;

    // Red de seguridad: si GAS no responde en 12s, caer al flujo local
    var timeoutLocal = setTimeout(function() {
      if (respondio) return;
      respondio = true;
      _flujoLocalChecada(nombre, idUsuario, datos);
    }, 12000);

    google.script.run
      .withSuccessHandler(function(result) {
        if (respondio) return;
        respondio = true;
        clearTimeout(timeoutLocal);
        if (result && result.ok && result.tipo && result.veredicto) {
          // Sincronizar el registro local con la verdad del servidor
          try {
            var data = _leerChecadasDia();
            var key = _normId(idUsuario);
            data.porUsuario[key] = (result.checadasHoyServidor || []).map(function(c) {
              var ts = new Date(c.fecha + 'T' + c.hora).getTime();
              return { tipo: c.tipo, ts: isNaN(ts) ? Date.now() : ts };
            });
            localStorage.setItem(_LS_KEY_CHECADAS_DIA, JSON.stringify(data));
          } catch(e) {}
          var horaMostrar = (result.horaServidor || hora).substring(0, 8);
          _pintarPantallaChecada(result.tipo, result.veredicto, nombre, horaMostrar, false);
        } else {
          _flujoLocalChecada(nombre, idUsuario, datos);
        }
      })
      .withFailureHandler(function() {
        if (respondio) return;
        respondio = true;
        clearTimeout(timeoutLocal);
        _flujoLocalChecada(nombre, idUsuario, datos);
      })
      .guardarChecadaChofer(datos);
  } else {
    // ── OFFLINE: único caso donde el registro local manda ──
    _flujoLocalChecada(nombre, idUsuario, datos);
  }
}

// ── Fallback local (offline o backend caído): detecta y evalúa con el
//    registro del dispositivo, y encola la checada para sincronizar después ──
function _flujoLocalChecada(nombre, idUsuario, datos) {
  var ahora = new Date();
  var tipoChecada = _detectarTipoChecada(idUsuario);
  var veredicto = _calcularVeredicto(tipoChecada, idUsuario, ahora);

  // ⛔ Fuera de horario: solo el mensaje — no se registra ni se encola
  if (tipoChecada === 'FUERA_HORARIO') {
    _pintarPantallaChecada(tipoChecada, veredicto, nombre, datos.hora, false);
    return;
  }

  _registrarChecadaLocal(idUsuario, tipoChecada, ahora.getTime());
  datos.tipo = tipoChecada;
  datos.autoDetect = false;
  _enviarOEncolarChecada(datos);

  _pintarPantallaChecada(tipoChecada, veredicto, nombre, datos.hora, true);
}

// ── Pantalla verde con tipo + veredicto (del servidor o del fallback) ──────
function _pintarPantallaChecada(tipoChecada, veredicto, nombre, hora, esOfflineFallback) {
  var box = document.getElementById('pin-box');
  if (!box) return;

  var etiqueta = _ETIQUETAS_TIPO[tipoChecada] || _ETIQUETAS_TIPO['EXTRA'];

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
    '<div class="ring-panel ring-panel--flow" style="max-width:88%;overflow-wrap:break-word;">' +
      '<div class="ring-flow__check" style="font-size:clamp(42px,11vw,58px);line-height:1;">' + etiqueta.emoji + '</div>' +
      '<div style="font-size:clamp(12px,3.4vw,16px);color:#a7ffc4;text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-top:8px;">' +
        etiqueta.label +
      '</div>' +
      '<div class="ring-flow__title" style="color:' + veredicto.color + ';font-size:clamp(24px,6.5vw,36px);font-weight:800;line-height:1.15;margin-top:8px;overflow-wrap:break-word;">' +
        veredicto.texto +
      '</div>' +
      (veredicto.detalle
        ? '<div style="margin-top:10px;font-size:clamp(14px,4vw,19px);font-weight:600;color:#F1F5F9;max-width:min(400px,92%);margin-left:auto;margin-right:auto;line-height:1.45;overflow-wrap:break-word;">' + veredicto.detalle + '</div>'
        : '') +
      '<div style="margin-top:10px;font-size:clamp(12px,3.5vw,15px);color:#94A3B8;max-width:92%;margin-left:auto;margin-right:auto;overflow-wrap:break-word;">' + nombre + ' · ' + hora + '</div>' +
      (esOfflineFallback && navigator.onLine === false
        ? '<div style="margin-top:8px;font-size:13px;color:#fbbf24;">📡 Se sincronizará al recuperar conexión</div>'
        : '') +
    '</div>';

  void box.offsetWidth;
  box.setAttribute('data-state', 'success');

  // 5 segundos para leer el veredicto y regreso al PIN
  setTimeout(function() { mostrarPantallaPIN(); }, 5000);
}

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
      // Mostrar "Sin Datos" SOLO si no se generó ninguna métrica.
      // Caso típico: aunque RAW esté vacío, el PASO 4B puede haber generado
      // faltas/vacaciones/inhábiles que SÍ son métricas válidas — eso NO es
      // "sin datos", es un proceso exitoso normal.
      const sinChecadas = (result.registros || 0) === 0;
      const sinMetricas = (result.metricas  || 0) === 0;
      if (sinChecadas && sinMetricas) {
        clearInterval(progressInterval);
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        modalHTML.innerHTML = '<div style="font-size:72px;margin-bottom:24px;"><i class="fas fa-info-circle" style="color:#F59E0B;"></i></div><h2 style="color:#F59E0B;margin-bottom:12px;font-size:28px;font-weight:700;">Sin Datos para Procesar</h2><p style="color:var(--text-secondary);margin-bottom:28px;font-size:15px;">No se encontraron registros ni se generaron métricas.</p><button id="btn-cerrar-info" style="padding:14px 32px;background:#F59E0B;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Cerrar y Refrescar</button>';
        document.getElementById('btn-cerrar-info').onclick = function() {
          overlay.remove();
          if (typeof _invalidarCache === 'function') _invalidarCache();
          loadDashboard(true);
        };
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
      document.getElementById('btn-cerrar-exito').onclick = function() {
        overlay.remove();
        // El procesamiento cambió los datos en GAS — invalidar TODO el cache
        // para que se recarguen del servidor
        if (typeof _invalidarCache === 'function') _invalidarCache();
        if (!window.currentModule) loadDashboard(true);
        else openModule(window.currentModule);
      };
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
  // ⭐ Cargar zonas válidas al inicio (CONFIG_CHOFERES → _zonasValidas).
  // Si falla queda como [] y todas las checadas saldrán 'SIN_ZONAS' (rojo).
  if (typeof cargarZonasValidas === 'function') cargarZonasValidas();
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

// ─────────────────────────────────────────────────────────────────────────────
// PANEL DE DIAGNÓSTICO — PIN 9999
// ─────────────────────────────────────────────────────────────────────────────
// Verifica de un jalón: versión del frontend cargado, versión del backend
// desplegado, spreadsheet real al que pega, service account, trigger, y los
// datos de HOY que el backend está viendo. Si frontend y backend no son la
// misma versión, aquí se ve inmediatamente.
var FRONTEND_VERSION = 'v604';

// ⭐ Normalizador de PIN/ID (espejo del backend): "0055" y 55 son el mismo
function _normId(v) {
  v = (v === null || v === undefined) ? '' : v.toString().trim();
  var n = parseInt(v, 10);
  return (isNaN(n) || !/^\d+$/.test(v)) ? v : String(n);
}

function _mostrarDiagnostico() {
  var viejo = document.getElementById('diag-overlay');
  if (viejo) viejo.remove();

  var ov = document.createElement('div');
  ov.id = 'diag-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:100010;overflow-y:auto;' +
    'background:#0B1120;font-family:monospace;padding:calc(20px + env(safe-area-inset-top,0px)) 16px 40px;';
  ov.innerHTML =
    '<div style="max-width:560px;margin:0 auto;color:#E2E8F0;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<div style="font-size:17px;font-weight:800;">🩺 Diagnóstico</div>' +
        '<button onclick="document.getElementById(\'diag-overlay\').remove()" ' +
                'style="padding:8px 16px;background:transparent;color:#94A3B8;border:1px solid rgba(255,255,255,0.2);border-radius:8px;cursor:pointer;">Cerrar</button>' +
      '</div>' +
      '<div id="diag-body" style="font-size:13px;line-height:1.9;">' +
        '<div>Frontend cargado: <strong style="color:#7fdfff;">' + FRONTEND_VERSION + '</strong></div>' +
        '<div>Consultando backend...</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);

  var body = function() { return document.getElementById('diag-body'); };

  if (navigator.onLine === false) {
    if (body()) body().innerHTML += '<div style="color:#F87171;">❌ Sin internet — no puedo consultar el backend</div>';
    return;
  }

  google.script.run
    .withSuccessHandler(function(d) {
      var b = body();
      if (!b || !d) return;
      var match = (d.backendVersion === FRONTEND_VERSION);
      b.innerHTML =
        '<div>Frontend cargado: <strong style="color:#7fdfff;">' + FRONTEND_VERSION + '</strong></div>' +
        '<div>Backend desplegado: <strong style="color:' + (match ? '#10B981' : '#F87171') + ';">' + (d.backendVersion || '?') + '</strong>' +
          (match ? ' ✅ coinciden' : ' ❌ NO COINCIDEN — pega el último Code-Simple.gs y RE-DESPLIEGA') + '</div>' +
        '<div style="margin-top:10px;">📊 Spreadsheet: <strong>' + (d.spreadsheetNombre || '?') + '</strong></div>' +
        '<div style="font-size:11px;color:#64748B;">ID: ' + (d.spreadsheetId || '?') + '</div>' +
        '<div style="margin-top:10px;">🔥 Firebase: ' + (d.firebase || '?') + '</div>' +
        '<div>⏰ Trigger alertas: ' + (d.trigger || '?') + '</div>' +
        '<div>🔔 Dispositivos push: <strong>' + d.dispositivosPush + '</strong></div>' +
        '<div>⏱️ Duraciones T2 vigentes: ' + (d.duracionesT2 || '?') + '</div>' +
        '<div style="margin-top:10px;">📋 Checadas HOY según el backend: <strong>' + d.checadasHoy + '</strong></div>' +
        ((d.ultimasHoy && d.ultimasHoy.length)
          ? '<div style="font-size:11px;color:#94A3B8;">' + d.ultimasHoy.join('<br>') + '</div>'
          : '') +
        '<div style="margin-top:10px;color:#64748B;font-size:11px;">Hora del servidor: ' + (d.horaServidor || '?') + '</div>' +
        '<div style="font-size:11px;color:#64748B;word-break:break-all;">Deployment: ' + (d.deploymentUrl || '?') + '</div>' +
        '<button onclick="_diagLimpiarTodo()" ' +
                'style="margin-top:18px;width:100%;padding:14px;background:transparent;color:#F87171;' +
                       'border:1.5px solid rgba(248,113,113,0.5);border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;">' +
          '🧹 LIMPIAR TODO (checadas + registros)' +
        '</button>' +
        '<div style="font-size:11px;color:#64748B;margin-top:6px;">Borra TODAS las checadas del sheet y las marcas de alertas. Conserva dispositivos push y preferencias. También limpia este dispositivo.</div>' +
        '<div id="diag-limpiar-status" style="font-size:12px;margin-top:6px;min-height:16px;"></div>';
    })
    .withFailureHandler(function(err) {
      var b = body();
      if (b) b.innerHTML +=
        '<div style="color:#F87171;margin-top:8px;">❌ El backend NO tiene diagnosticoCompleto → ' +
        '<strong>estás corriendo un Code-Simple.gs VIEJO</strong>. Pega el último y RE-DESPLIEGA (Versión nueva).<br>' +
        '<span style="font-size:11px;">' + (err && err.message ? err.message : err) + '</span></div>';
    })
    .diagnosticoCompleto();
}


// Limpieza total desde el panel: backend (sheet) + este dispositivo (local)
function _diagLimpiarTodo() {
  if (!window.confirm('¿Borrar TODAS las checadas del sheet y los registros locales?\n\nSe conservan: dispositivos push y preferencias de alertas.')) return;
  var st = document.getElementById('diag-limpiar-status');
  if (st) { st.style.color = '#94A3B8'; st.textContent = 'Limpiando...'; }

  // Local primero (esto siempre funciona)
  try { localStorage.removeItem(_LS_KEY_CHECADAS_DIA); } catch(e) {}
  try { localStorage.removeItem('em_usuarios_cache'); } catch(e) {}
  _usuariosCache = null;

  google.script.run
    .withSuccessHandler(function(r) {
      var s = document.getElementById('diag-limpiar-status');
      if (s) {
        s.style.color = (r && r.ok) ? '#10B981' : '#F87171';
        s.textContent = (r && r.message) || 'Sin respuesta';
      }
    })
    .withFailureHandler(function(err) {
      var s = document.getElementById('diag-limpiar-status');
      if (s) {
        s.style.color = '#F87171';
        s.textContent = '❌ ' + (err && err.message ? err.message : err) + ' (¿backend viejo sin limpiarTodoChecador?)';
      }
    })
    .limpiarTodoChecador();
}
