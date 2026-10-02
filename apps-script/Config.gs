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

const BACKEND_VERSION = 'v759';  // ← súbelo junto con la versión del frontend

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

/**
 * LA COLUMNA DEL ID EN TURNOS_DEFAULT.
 *
 * Se buscaba con indexOf('Admin') a secas, y el 24-sep esa celda amanecio
 * vacia. indexOf devolvio -1... y JavaScript no se queja: data[i][-1] vale
 * undefined y ya. Resultado: el mapa de empleados salio vacio, NINGUN pin
 * se encontro, nadie pudo registrar su celular ni recibir alertas, y en el
 * log no aparecio un solo error. Un encabezado borrado tumbo la app en
 * silencio.
 *
 * Ahora se busca por nombre; si no esta, se usa la columna A, que es donde
 * el ID ha vivido siempre; y se deja dicho en el log para que la proxima
 * vez se sepa en un minuto y no en media tarde.
 */
function _colIdTurnos_(encabezados) {
  encabezados = encabezados || [];
  var i = encabezados.indexOf('Admin');
  if (i !== -1) return i;
  for (var j = 0; j < encabezados.length; j++) {
    var h = (encabezados[j] || '').toString().trim().toLowerCase();
    if (h === 'admin' || h === 'id' || h === 'id usuario' || h === 'idusuario') return j;
  }
  Logger.log('\u26a0\ufe0f TURNOS_DEFAULT no trae el encabezado "Admin". Se usa la columna A. ' +
             'Revisa la celda A1 de esa hoja.');
  return 0;
}

/**
 * LAS 4 COLUMNAS DE TURNOS_DEFAULT, BUSCADAS POR NOMBRE.
 *
 * Esta hoja es la mas delicada del libro: de aqui sale el horario de cada
 * quien, y de ahi salen TODAS las alertas. Tiene dos trampas:
 *
 *   1. 'Turno' (el nombre, "T2") y 'TURNO' (el horario, "10:00 - 19:00") solo
 *      se diferencian por las mayusculas. Por eso primero se busca exacto.
 *   2. La columna 'TURNO' la genera una formula ARRAYFORMULA que tambien
 *      escribe su propio encabezado. Si la formula se cae, el encabezado
 *      desaparece con ella.
 *
 * Antes esto era h.indexOf('TURNO') a secas: si el encabezado traia un
 * espacio de mas o lo escribian distinto, devolvia -1 y la app se iba
 * callada a los horarios de CONFIG_TURNOS. Ahora avisa en el log.
 *
 * Admin y Empleado SI tienen respaldo por posicion (A y B, donde han vivido
 * siempre) porque sin ellos no hay empleados y no pasa nada en toda la app.
 * Turno y TURNO NO lo tienen a proposito: leer la columna equivocada como
 * horario manda alertas a la hora equivocada, y eso es peor que no leerla —
 * sin ellas se cae a CONFIG_TURNOS, que es un respaldo honesto.
 *
 * @return {{id:number, empleado:number, turno:number, horario:number, faltan:string[]}}
 */
function _ixTurnos_(encabezados) {
  var crudo = (encabezados || []).map(function (v) {
    return (v === null || v === undefined ? '' : v).toString().trim();
  });
  var norm = crudo.map(_normEnc_);
  var usada = {}, faltan = [];

  function buscar(nombre, respaldo) {
    var c;
    for (c = 0; c < crudo.length; c++) {                 // exacto
      if (!usada[c] && crudo[c] === nombre) { usada[c] = true; return c; }
    }
    var b = _normEnc_(nombre);
    for (c = 0; c < norm.length; c++) {                  // normalizado
      if (!usada[c] && norm[c] === b) { usada[c] = true; return c; }
    }
    faltan.push(nombre);
    if (respaldo !== null && !usada[respaldo]) { usada[respaldo] = true; return respaldo; }
    return -1;
  }

  // El ID conserva su buscador de siempre (aguanta 'Admin', 'ID', 'ID Usuario').
  var id = _colIdTurnos_(crudo);
  usada[id] = true;

  // El orden importa: 'Turno' se pide ANTES que 'TURNO' para que cada uno se
  // quede con su columna exacta y no se roben la del otro.
  var empleado = buscar(ENC_TURNOS_DEFAULT[1], 1);
  var turno    = buscar(ENC_TURNOS_DEFAULT[2], null);
  var horario  = buscar(ENC_TURNOS_DEFAULT[3], null);

  if (faltan.length) {
    Logger.log('⚠️ TURNOS_DEFAULT: no encontre el encabezado ' + faltan.join(', ') +
               ' en la fila 1. Revisa esa fila — las alertas dependen de ella.');
  }
  return { id: id, empleado: empleado, turno: turno, horario: horario, faltan: faltan };
}

function _cfgEmpleadoServ(idUsuario) {
  try {
    if (_CACHE_TURNOS_DEF === null) {
      const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TURNOS_DEFAULT');
      _CACHE_TURNOS_DEF = sh ? sh.getDataRange().getValues() : false;
    }
    if (_CACHE_TURNOS_DEF === false) return null;
    const data = _CACHE_TURNOS_DEF;
    const ix = _ixTurnos_(data[0]);
    const iId = ix.id;
    const iTurnoNombre = ix.turno;
    const iHorario = ix.horario;
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

/* ===========================================================================
   COLUMNAS POR NOMBRE — que mover una columna no rompa nada
   ===========================================================================
   El problema: casi todo el código lee las filas por POSICIÓN (r[0] es el ID,
   r[2] la fecha…). Si alguien inserta, borra o reordena una columna en el
   Sheet —o una importación lo hace sola— todo se recorre y la app empieza a
   leer basura, sin un solo error en el log.

   La solución, sin tocar los cientos de r[0]/r[2] repartidos por el código:
   aquí se lee la fila de encabezados, se ubica cada columna POR SU NOMBRE y
   se devuelven las filas YA ACOMODADAS en el orden de siempre. Para el resto
   del código nada cambió; para el Sheet, las columnas pueden andar donde
   quieran.

   Si un encabezado no aparece (lo renombraron o lo borraron), se cae a la
   posición de toda la vida y se deja dicho en el log — nunca en silencio,
   que fue justo lo que tumbó la app el 24-sep con "Admin" en blanco.
   =========================================================================== */

/** Normaliza un encabezado para comparar: sin acentos, sin dobles espacios. */
function _normEnc_(v) {
  return (v === null || v === undefined ? '' : v).toString()
    .trim().toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u')
    .replace(/\s+/g, ' ');
}

/**
 * Dónde está cada columna, buscándola por nombre.
 * @param {Sheet}    sheet
 * @param {number}   filaEnc      fila donde viven los encabezados (1 o 2)
 * @param {string[]} encabezados  nombres en el ORDEN CANÓNICO que espera el código
 * @return {{idx:number[], identidad:boolean, faltan:string[]}}
 */
function _colsPorNombre_(sheet, filaEnc, encabezados) {
  var idx = new Array(encabezados.length), faltan = [], identidad = true;
  var usada = {};                 // columna ya apartada por otro encabezado
  var crudo = [], norm = [];
  try {
    var ancho = Math.max(sheet.getLastColumn(), encabezados.length);
    crudo = sheet.getRange(filaEnc, 1, 1, ancho).getValues()[0].map(function (v) {
      return (v === null || v === undefined ? '' : v).toString().trim();
    });
    norm = crudo.map(_normEnc_);
  } catch (e) { crudo = []; norm = []; }

  // Pasada 1: coincidencia EXACTA, respetando mayusculas.
  //
  // Es la que distingue "Turno" de "TURNO" en TURNOS_DEFAULT: dos encabezados
  // que al normalizar quedan IGUALES. Sin esta pasada los dos caerian en la
  // misma columna y el motor leeria el nombre del turno ("T2") donde espera
  // el horario ("10:00 - 19:00") — alertas a la hora equivocada, sin un error.
  for (var i = 0; i < encabezados.length; i++) {
    idx[i] = -1;
    for (var c = 0; c < crudo.length; c++) {
      if (!usada[c] && crudo[c] === encabezados[i]) { idx[i] = c; usada[c] = true; break; }
    }
  }

  // Pasada 2: coincidencia normalizada (sin acentos, sin mayusculas).
  for (var i2 = 0; i2 < encabezados.length; i2++) {
    if (idx[i2] !== -1) continue;
    var buscar = _normEnc_(encabezados[i2]);
    for (var c2 = 0; c2 < norm.length; c2++) {
      if (!usada[c2] && norm[c2] === buscar) { idx[i2] = c2; usada[c2] = true; break; }
    }
  }

  // Pasada 3: no aparecio. Respaldo a la posicion de siempre, y se avisa.
  for (var i3 = 0; i3 < encabezados.length; i3++) {
    if (idx[i3] !== -1) continue;
    idx[i3] = i3;
    faltan.push(encabezados[i3]);
  }

  // Una columna no se le puede asignar a dos encabezados distintos.
  for (var i4 = 0; i4 < idx.length; i4++) if (idx[i4] !== i4) identidad = false;
  if (faltan.length) {
    Logger.log('⚠️ ' + sheet.getName() + ': no encontre el encabezado ' +
               faltan.join(', ') + ' en la fila ' + filaEnc +
               '. Uso la posicion de siempre. Revisa esa fila.');
  }
  return { idx: idx, identidad: identidad, faltan: faltan };
}

/**
 * Lee la hoja y devuelve las filas SIEMPRE en el orden canónico de columnas,
 * esté donde esté cada una en el Sheet.
 * @param {Sheet}    sheet
 * @param {number}   filaEnc     fila de los encabezados
 * @param {number}   filaInicio  primera fila de datos
 * @param {string[]} encabezados orden canónico
 * @return {Array[]} filas acomodadas (vacío si no hay datos)
 */
function _leerOrdenado_(sheet, filaEnc, filaInicio, encabezados) {
  if (!sheet) return [];
  var ultima = sheet.getLastRow();
  if (ultima < filaInicio) return [];

  var c = _colsPorNombre_(sheet, filaEnc, encabezados);
  var ancho = Math.max(sheet.getLastColumn(), encabezados.length);
  var crudo = sheet.getRange(filaInicio, 1, ultima - filaInicio + 1, ancho).getValues();

  // Si las columnas están justo donde siempre, no hay nada que acomodar.
  if (c.identidad) {
    return (ancho === encabezados.length)
      ? crudo
      : crudo.map(function (r) { return r.slice(0, encabezados.length); });
  }
  return crudo.map(function (r) {
    var out = [];
    for (var i = 0; i < c.idx.length; i++) out.push(r[c.idx[i]]);
    return out;
  });
}

/**
 * Acomoda una fila del orden canónico al orden REAL de la hoja, para escribir.
 * Devuelve { fila: valores listos para setValues, ancho: cuántas columnas }.
 */
function _filaParaHoja_(sheet, filaEnc, encabezados, valores) {
  var c = _colsPorNombre_(sheet, filaEnc, encabezados);
  if (c.identidad) return { fila: valores.slice(), ancho: encabezados.length };
  var ancho = 0;
  for (var i = 0; i < c.idx.length; i++) ancho = Math.max(ancho, c.idx[i] + 1);
  var out = new Array(ancho);
  for (var j = 0; j < ancho; j++) out[j] = '';
  for (var k = 0; k < c.idx.length; k++) out[c.idx[k]] = valores[k];
  return { fila: out, ancho: ancho };
}

/**
 * Agrega UNA fila al final de la hoja, cada valor en la columna que le toca
 * SEGUN SU ENCABEZADO.
 *
 * Reemplaza a appendRow(), que siempre escribe en A, B, C... En v758 se
 * blindaron todas las LECTURAS, pero las escrituras seguian por posicion:
 * si alguien movia una columna, la app leia bien y escribia mal — se
 * ensuciaba la hoja en silencio, que es peor que leer mal.
 *
 * @return {number} la fila donde quedo
 */
function _agregarFila_(sheet, filaEnc, encabezados, valores) {
  var puesta = _filaParaHoja_(sheet, filaEnc, encabezados, valores);
  var fila = sheet.getLastRow() + 1;
  sheet.getRange(fila, 1, 1, puesta.ancho).setValues([puesta.fila]);
  return fila;
}

/**
 * Igual pero para VARIAS filas de un jalon: una sola lectura de encabezados
 * y una sola escritura.
 * @return {number} la primera fila donde quedaron (0 si no habia nada)
 */
function _agregarFilas_(sheet, filaEnc, encabezados, filasValores) {
  if (!filasValores || !filasValores.length) return 0;
  var c = _colsPorNombre_(sheet, filaEnc, encabezados);
  var ancho = encabezados.length;
  for (var i = 0; i < c.idx.length; i++) ancho = Math.max(ancho, c.idx[i] + 1);
  var salida = filasValores.map(function (v) {
    var out = new Array(ancho);
    for (var j = 0; j < ancho; j++) out[j] = '';
    for (var k = 0; k < c.idx.length; k++) out[c.idx[k]] = v[k];
    return out;
  });
  var fila = sheet.getLastRow() + 1;
  sheet.getRange(fila, 1, salida.length, ancho).setValues(salida);
  return fila;
}

/* --- Los encabezados canónicos de cada hoja, en un solo lugar ------------- */
var ENC_CHECADAS = ['ID Usuario', 'Nombre', 'Fecha', 'Hora', 'Timestamp Completo',
                    'Latitud', 'Longitud', 'Estado Zona', 'UUID Cliente', 'Tipo Checada'];
var ENC_APP_EMPLEADOS = ['ID', 'Empleado', 'Turno', 'En la app', 'Área'];
var ENC_USUARIOS      = ['PIN', 'ID Usuario'];
var ENC_EXCEPCIONES   = ['Fecha', 'PIN', 'ID Usuario', 'Nombre', 'Tipo', 'Registrado'];
var ENC_AUSENCIAS     = ['PIN', 'ID Usuario', 'Nombre', 'Fecha', 'Tipo', 'Registrado'];
var ENC_PUSH_TOKENS   = ['PIN', 'ID Usuario', 'Nombre', 'Token', 'Dispositivo',
                         'Registrado', 'Último uso'];
var ENC_JUEGOS_CAT    = ['Juego', 'Icono', 'Modo', 'Activo'];
var ENC_JUEGOS_PAR    = ['ID Partida', 'Fecha', 'Hora', 'Juego', 'Nota',
                         'ID Jugador', 'Jugador', 'Posición', 'Puntos', 'Registrado'];
var ENC_PREFS_ALERTAS = ['PIN', 'ID Usuario', 'Nombre', 'Entrada', 'Desayuno', 'Comida',
                         'Comida no tomada', 'Salida', 'Actualizado'];
var ENC_PUSH_LOG      = ['ID Envío', 'Fecha', 'Hora', 'ID Usuario', 'Empleado', 'Alerta',
                         'Título', 'Código FCM', 'Detalle', 'Entregada', 'Hora entrega', 'Token'];
var ENC_CONFIG_ALERTAS = ['Parámetro', 'Valor', 'Descripción'];
var ENC_CHECADAS_BORRADAS = ['Borrado el', 'ID Usuario', 'Nombre', 'Fecha', 'Hora', 'Tipo'];

// TURNOS_DEFAULT no pasa por _leerOrdenado_: 'Turno' y 'TURNO' son DOS
// columnas distintas que al normalizar quedan iguales, y ademas la hoja se
// lee en cache completo. Se resuelve con _ixTurnos_(), mas abajo.
var ENC_TURNOS_DEFAULT = ['Admin', 'Empleado', 'Turno', 'TURNO'];
