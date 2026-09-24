// ============================================================================
// CHECADOR ELECTRONICS MÉXICO — VERSIÓN SIMPLE (Registro en Vivo)
// ============================================================================
// Backend reducido: SOLO lo que necesita el flujo de empleados.
//   - Login (usuarios, PINs, contraseñas)
//   - Checadas con tipo (ENTRADA / DESAYUNO / COMIDA / SALIDA...)
//   - Perfil del empleado (checadas del día, turno, resumen)
//   - Alertas push (Firebase)
//
// ============================================================================
// CAMBIOS DE ESTA VERSIÓN (v624)
// ============================================================================
//
// 1. LA LLAVE DE FIREBASE YA NO VIVE EN EL CÓDIGO.
//    Antes el private_key completo del service account estaba escrito aquí.
//    Cualquiera con acceso al proyecto —o a una copia del archivo— podía
//    mandar notificaciones haciéndose pasar por la empresa y entrar al
//    proyecto de Firebase. Ahora vive en PropertiesService, cifrada.
//    Se configura UNA vez: ejecuta configurarFirebase() desde el editor.
//
//    ⚠️ La llave anterior quedó expuesta: hay que REVOCARLA en la consola
//    de Firebase (⚙️ → Cuentas de servicio → borrar la vieja, generar otra).
//    Borrarla del código no la invalida.
//
// 2. EL MOTOR YA NO CORRE DE MADRUGADA.
//    revisarAlertas() se disparaba 1,440 veces al día, incluidas las horas
//    en que nadie checa. Ahora sale de inmediato fuera de 6:00–22:00: un
//    tercio menos de ejecuciones sin perder una sola alerta.
//
// 3. FUERA EL eval() DEL DISPATCHER.
//    doPost resolvía la función con eval(nombre). Estaba acotado por lista
//    blanca, pero eval abre la puerta a que un cambio futuro en esa lista se
//    vuelva ejecución de código. Ahora hay un mapa explícito nombre → función.
//
// 4. FUNCIONES DUPLICADAS ELIMINADAS.
//    _quincenaPorOffset y getHistorialQuincena estaban definidas DOS veces.
//    En Apps Script gana la última, así que la primera versión de cada una
//    era código muerto que igual confundía al leer. Se conservó la que de
//    verdad estaba corriendo (la que reporta faltas y fines de semana).
//
// 5. La lista de funciones permitidas tenía 'getHistorialQuincena' repetida.
// ============================================================================

const TIMEZONE = 'America/Mexico_City';

const BACKEND_VERSION = 'v700';  // ← debe coincidir con el frontend desplegado

// Ventana en que el motor de alertas tiene algo que hacer. Fuera de aquí
// no hay turnos activos, así que revisar cuesta y no sirve.
const ALERTAS_HORA_INICIO = 6;

const ALERTAS_HORA_FIN    = 22;

// ⭐ NORMALIZADOR DE PIN/ID — Google Sheets convierte "0055" a número 55 al
// guardar, pero el frontend manda "0055". Sin normalizar, "0055" ≠ "55" y
// nada coincide (tokens, prefs, checadas). SIEMPRE comparar con _normId.
function _normId(v) {
  v = (v === null || v === undefined) ? '' : v.toString().trim();
  const n = parseInt(v, 10);
  return (isNaN(n) || !/^\d+$/.test(v)) ? v : String(n);
}

function _minAHora(totalMin) {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

function _hhmmAMin(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
  const m = v.toString().match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

// ============================================================================
// CONFIG_TURNOS — ventanas y duraciones POR TURNO
// ============================================================================

var _cacheCfgTurnos = null;

function _leerConfigTurnos() {
  if (_cacheCfgTurnos) return _cacheCfgTurnos;
  const mapa = {};
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG_TURNOS');
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      const h = data[0].map(function(x) { return (x || '').toString().trim(); });
      const col = {};
      ['Turno','Días','Entrada Min','Entrada Max','Tolerancia','Desayuno Min','Desayuno Max','Desayuno Regreso Min',
       'Comida Min','Comida Max','Comida Regreso Min','Salida Min'].forEach(function(c) { col[c] = h.indexOf(c); });
      for (let i = 1; i < data.length; i++) {
        const nombre = (data[i][col['Turno']] || '').toString().trim();
        if (!nombre) continue;
        mapa[nombre] = {
          dias:       _diasDeTurno_(col['Días'] !== -1 ? data[i][col['Días']] : ''),
          entradaMin: _hhmmAMin(data[i][col['Entrada Min']]),
          entradaMax: _hhmmAMin(data[i][col['Entrada Max']]),
          tolerancia: parseFloat(data[i][col['Tolerancia']]) || 15,
          desMin:     _hhmmAMin(data[i][col['Desayuno Min']]),
          desMax:     _hhmmAMin(data[i][col['Desayuno Max']]),
          desDur:     parseFloat(data[i][col['Desayuno Regreso Min']]) || 20,
          comMin:     _hhmmAMin(data[i][col['Comida Min']]),
          comMax:     _hhmmAMin(data[i][col['Comida Max']]),
          comDur:     parseFloat(data[i][col['Comida Regreso Min']]) || 60,
          salidaMin:  _hhmmAMin(data[i][col['Salida Min']])
        };
      }
    }
  } catch (e) { Logger.log('⚠️ _leerConfigTurnos: ' + e.message); }
  _cacheCfgTurnos = mapa;
  return mapa;
}

// Cache de TURNOS_DEFAULT mientras dura la ejecucion.
//
// revisarAlertas corre CADA MINUTO y llamaba a esta funcion una vez por
// empleado, dentro del bucle: una lectura completa de la hoja por persona.
// Con 40 empleados eran 40 lecturas por minuto, 38 mil al dia, y es de las
// cosas que acaban tumbando el motor por cuota sin decir por que.
var _CACHE_TURNOS_DEF = null;

function _cfgEmpleadoServ(idUsuario) {
  try {
    if (_CACHE_TURNOS_DEF === null) {
      const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TURNOS_DEFAULT');
      _CACHE_TURNOS_DEF = sh ? sh.getDataRange().getValues() : false;
    }
    if (_CACHE_TURNOS_DEF === false) return null;
    const data = _CACHE_TURNOS_DEF;
    const h = data[0];
    const iId = h.indexOf('Admin');
    const iTurnoNombre = h.indexOf('Turno');
    const iHorario = h.indexOf('TURNO');
    for (let i = 1; i < data.length; i++) {
      if (_normId(data[i][iId]) !== _normId(idUsuario)) continue;
      const nombreTurno = iTurnoNombre !== -1 ? (data[i][iTurnoNombre] || '').toString().trim() : '';
      const horario = iHorario !== -1 ? (data[i][iHorario] || '').toString() : '';
      const m = horario.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      const cfgT = _leerConfigTurnos()[nombreTurno] || {};
      return {
        turnoNombre: nombreTurno,
        inicioMin: (m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : cfgT.entradaMin),
        finMin:    (m ? parseInt(m[3], 10) * 60 + parseInt(m[4], 10) : cfgT.salidaMin),
        tolerancia: cfgT.tolerancia || 15,
        desMin: cfgT.desMin, desMax: cfgT.desMax, desDur: cfgT.desDur || 20,
        comMin: cfgT.comMin, comMax: cfgT.comMax, comDur: cfgT.comDur || 60,
        dias: cfgT.dias || null
      };
    }
  } catch (e) {
    Logger.log('⚠️ _cfgEmpleadoServ(' + idUsuario + '): ' + e.message);
  }
  return null;
}


// ── Días laborables de cada turno ───────────────────────────────────────────
//
// La columna Días de CONFIG_TURNOS existía pero nadie la leía, y el motor de
// alertas tenía el fin de semana escrito a mano. Resultado: Jairo, que trabaja
// de lunes a jueves, recibía "es tu hora de entrada" los viernes a las 13:00.

var _DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

/** Quita acentos y deja minúsculas: "Miércoles" y "miercoles" son el mismo día. */
function _sinAcentos_(t) {
  return (t || '').toString().toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u');
}

/** "Lunes, martes, miércoles" → ['lunes','martes','miercoles'].
 *  Vacío devuelve null, que significa "no está definido": se asume lun–vie. */
function _diasDeTurno_(texto) {
  var t = _sinAcentos_(texto).trim();
  if (!t) return null;
  var lista = t.split(/[,;/]+/).map(function (x) { return x.trim(); })
               .filter(function (x) { return _DIAS_SEMANA.indexOf(x) !== -1; });
  return lista.length ? lista : null;
}

/** ¿Hoy le toca trabajar a este turno? */
function _turnoTrabajaHoy_(cfg, fecha) {
  var dia = _DIAS_SEMANA[(fecha || new Date()).getDay()];
  var dias = (cfg && cfg.dias) ? cfg.dias
           : ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
  return dias.indexOf(dia) !== -1;
}
