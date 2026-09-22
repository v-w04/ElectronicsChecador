/**
 * ============================================================================
 *  Juegos.gs — TABLERO DE JUEGOS INTERNOS
 * ============================================================================
 *
 *  Marcadores de los juegos que se echan en la oficina (Mario Kart, Smash,
 *  lo que se agregue). Vive en el mismo Sheet del checador pero no lo toca:
 *  usa sus propias hojas y no lee ni escribe CHECADOR_CHOFERES.
 *
 *  HOJAS QUE USA
 *
 *  JUEGOS            Catálogo. Una fila por juego.
 *    Juego · Icono · Modo · Activo
 *    Modo = POSICION (gana el 1er lugar) o PUNTOS (gana el puntaje más alto).
 *
 *  JUEGOS_PARTIDAS   El histórico. Una fila POR JUGADOR, no por partida:
 *    ID Partida · Fecha · Hora · Juego · Nota · ID Jugador · Jugador ·
 *    Posición · Puntos · Registrado
 *
 *    Se guarda así a propósito. Una fila por partida con los jugadores
 *    apretados en una celda se ve bien y no se puede filtrar; así, ordenar
 *    por jugador o sacar cuántas ganó cada quien es un filtro de Sheets.
 *
 *  El ranking NO se calcula aquí: se manda el histórico y la página lo arma.
 *  Son partidas de oficina, no millones de filas, y así cambiar la forma de
 *  contar puntos no obliga a tocar el backend.
 * ============================================================================
 */

var JUEGOS_HOJA_CAT = 'JUEGOS';
var JUEGOS_HOJA_PAR = 'JUEGOS_PARTIDAS';

var JUEGOS_CAT_HEADERS = ['Juego', 'Icono', 'Modo', 'Activo'];
var JUEGOS_PAR_HEADERS = ['ID Partida', 'Fecha', 'Hora', 'Juego', 'Nota',
                          'ID Jugador', 'Jugador', 'Posición', 'Puntos', 'Registrado'];

// Juegos con los que arranca el catálogo si la hoja no existe.
var JUEGOS_SEMILLA = [
  ['Mario Kart', '🏁', 'POSICION', 'SÍ'],
  ['Smash Bros', '🥊', 'POSICION', 'SÍ']
];

/** El Sheet. Se prefiere openById: en triggers y en un web app standalone
 *  getActiveSpreadsheet() devuelve null. Mientras el resto del backend no
 *  tenga la constante SHEET_ID, se cae al activo para no romper nada. */
function _juegosSS_() {
  try {
    if (typeof SHEET_ID !== 'undefined' && SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  } catch (e) {}
  return SpreadsheetApp.getActiveSpreadsheet();
}

function crearHojaJuegos() {
  var ss = _juegosSS_();
  var sheet = ss.getSheetByName(JUEGOS_HOJA_CAT);
  if (!sheet) {
    sheet = ss.insertSheet(JUEGOS_HOJA_CAT);
    sheet.getRange(1, 1, 1, JUEGOS_CAT_HEADERS.length).setValues([JUEGOS_CAT_HEADERS]);
    sheet.getRange(2, 1, JUEGOS_SEMILLA.length, 4).setValues(JUEGOS_SEMILLA);
  }
  return sheet;
}

function crearHojaPartidas() {
  var ss = _juegosSS_();
  var sheet = ss.getSheetByName(JUEGOS_HOJA_PAR);
  if (!sheet) {
    sheet = ss.insertSheet(JUEGOS_HOJA_PAR);
    sheet.getRange(1, 1, 1, JUEGOS_PAR_HEADERS.length).setValues([JUEGOS_PAR_HEADERS]);
    // Fecha, hora e ID como texto: si Sheets los reinterpreta, el histórico
    // se desordena y los IDs pierden ceros.
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, 3).setNumberFormat('@');
  }
  return sheet;
}

// ============================================================================
// LECTURA
// ============================================================================

/**
 * Todo lo que la página necesita para pintarse, en UNA sola llamada:
 * catálogo de juegos, quién puede jugar y el histórico completo.
 *
 * @param {number} [limite] Máximo de filas del histórico, las más recientes.
 */
function getJuegosTablero(limite) {
  try {
    var cat = crearHojaJuegos();
    var par = crearHojaPartidas();

    // ── Catálogo ──────────────────────────────────────────────────────────
    var juegos = [];
    if (cat.getLastRow() > 1) {
      cat.getRange(2, 1, cat.getLastRow() - 1, 4).getValues().forEach(function (r) {
        var nombre = (r[0] || '').toString().trim();
        if (!nombre) return;
        var activo = (r[3] || 'SÍ').toString().trim().toUpperCase();
        juegos.push({
          juego:  nombre,
          icono:  (r[1] || '🎮').toString().trim(),
          modo:   (r[2] || 'POSICION').toString().trim().toUpperCase(),
          activo: activo !== 'NO'
        });
      });
    }

    // ── Jugadores: SOLO los que están en SÍ en la hoja APP_EMPLEADOS ──────
    // No tiene caso mostrar cuarenta nombres para elegir a cuatro que juegan.
    // Va el área, que es la que le da color al avatar.
    var jugadores = [];
    var avatares = {};
    try {
      var e2 = getEmpleadosApp();
      (e2.empleados || []).forEach(function (x) {
        jugadores.push({ id: _normId(x.id), nombre: x.nombre, area: x.area || '' });
      });
      avatares = e2.avatares || {};
    } catch (e) { /* si falla, la página deja escribir el nombre a mano */ }

    // ── Histórico ─────────────────────────────────────────────────────────
    var partidas = [];
    var ultima = par.getLastRow();
    if (ultima > 1) {
      var total = ultima - 1;
      var tope = (limite && limite > 0 && limite < total) ? limite : total;
      var desde = ultima - tope + 1;
      par.getRange(desde, 1, tope, 10).getValues().forEach(function (r) {
        if (!r[0]) return;
        partidas.push({
          id:       (r[0] || '').toString(),
          fecha:    (r[1] || '').toString(),
          hora:     (r[2] || '').toString(),
          juego:    (r[3] || '').toString(),
          nota:     (r[4] || '').toString(),
          idJugador:(r[5] || '').toString(),
          jugador:  (r[6] || '').toString(),
          posicion: r[7] === '' || r[7] === null ? null : Number(r[7]),
          puntos:   r[8] === '' || r[8] === null ? null : Number(r[8])
        });
      });
    }

    return { ok: true, juegos: juegos, jugadores: jugadores, partidas: partidas,
             avatares: avatares, tableroDesde: _tableroDesde_() };

  } catch (e) {
    Logger.log('❌ getJuegosTablero: ' + e.message);
    return { ok: false, message: e.message, juegos: [], jugadores: [], partidas: [],
             tableroDesde: '' };
  }
}

// ============================================================================
// ESCRITURA
// ============================================================================

/**
 * Guarda una partida completa.
 *
 * @param {Object} p
 *   p.juego      nombre tal como está en el catálogo
 *   p.nota       texto libre: "torneo", "revancha", lo que sea
 *   p.fecha      'yyyy-MM-dd'; si no viene, hoy
 *   p.jugadores  [{ id, nombre, posicion, puntos }]
 */
function registrarPartida(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (!p || !p.juego) return { ok: false, message: 'Falta el juego' };
    var lista = p.jugadores || [];
    if (lista.length < 2) return { ok: false, message: 'Una partida necesita al menos 2 jugadores' };

    var sheet = crearHojaPartidas();
    var ahora = new Date();
    var fecha = (p.fecha || '').toString().trim() ||
                Utilities.formatDate(ahora, TIMEZONE, 'yyyy-MM-dd');
    var hora  = Utilities.formatDate(ahora, TIMEZONE, 'HH:mm');
    var sello = Utilities.formatDate(ahora, TIMEZONE, 'dd/MM/yyyy HH:mm');

    // El ID amarra las filas de una misma partida. Lleva la hora para que
    // dos partidas del mismo juego el mismo día no se confundan.
    var idPartida = 'P' + Utilities.formatDate(ahora, TIMEZONE, 'yyyyMMdd-HHmmss');

    var filas = lista.map(function (j) {
      return [
        idPartida, fecha, hora, p.juego, (p.nota || '').toString(),
        (j.id || '').toString(), (j.nombre || '').toString(),
        (j.posicion === '' || j.posicion === null || j.posicion === undefined) ? '' : Number(j.posicion),
        (j.puntos   === '' || j.puntos   === null || j.puntos   === undefined) ? '' : Number(j.puntos),
        sello
      ];
    });

    var fila = sheet.getLastRow() + 1;
    sheet.getRange(fila, 1, filas.length, 10).setValues(filas);
    sheet.getRange(fila, 1, filas.length, 3).setNumberFormat('@');

    Logger.log('🎮 Partida ' + idPartida + ' · ' + p.juego + ' · ' + filas.length + ' jugadores');
    return { ok: true, idPartida: idPartida, jugadores: filas.length,
             message: 'Partida guardada' };

  } catch (e) {
    Logger.log('❌ registrarPartida: ' + e.message);
    return { ok: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

/** Borra una partida completa (todas sus filas). Para corregir un dedazo. */
function borrarPartida(idPartida) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (!idPartida) return { ok: false, message: 'Falta el ID de la partida' };
    var sheet = crearHojaPartidas();
    if (sheet.getLastRow() < 2) return { ok: true, borradas: 0 };

    var datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var borradas = 0;
    // De abajo hacia arriba: borrar filas de arriba recorre las de abajo.
    for (var i = datos.length - 1; i >= 0; i--) {
      if ((datos[i][0] || '').toString() === idPartida) {
        sheet.deleteRow(i + 2);
        borradas++;
      }
    }
    return { ok: true, borradas: borradas, message: borradas + ' filas borradas' };
  } catch (e) {
    return { ok: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

/** Agrega un juego al catálogo. */
function agregarJuego(nombre, icono, modo) {
  try {
    nombre = (nombre || '').toString().trim();
    if (!nombre) return { ok: false, message: 'Falta el nombre del juego' };

    var sheet = crearHojaJuegos();
    var existentes = sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(function (r) {
          return (r[0] || '').toString().trim().toLowerCase();
        })
      : [];
    if (existentes.indexOf(nombre.toLowerCase()) !== -1) {
      return { ok: false, message: 'Ese juego ya está en la lista' };
    }

    modo = (modo || 'POSICION').toString().toUpperCase();
    if (modo !== 'PUNTOS') modo = 'POSICION';

    sheet.appendRow([nombre, (icono || '🎮').toString(), modo, 'SÍ']);
    return { ok: true, message: nombre + ' agregado' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

/* ===========================================================================
   LIMPIAR EL TABLERO
   ===========================================================================
   El tablero es del día que va corriendo: al día siguiente arranca en cero
   solo. Y si quieren empezar de nuevo a media jornada, este corte lo hace.

   No se borra NADA: las partidas se quedan en JUEGOS_PARTIDAS y siguen
   saliendo en el histórico. Lo único que se guarda es la hora del corte, y
   el tablero cuenta a partir de ahí.
   =========================================================================== */

var _JUEGOS_CORTE = 'juegos_tablero_desde';

function _tableroDesde_() {
  return PropertiesService.getScriptProperties().getProperty(_JUEGOS_CORTE) || '';
}

function limpiarTableroJuegos() {
  try {
    var ahora = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    PropertiesService.getScriptProperties().setProperty(_JUEGOS_CORTE, ahora);
    return { ok: true, tableroDesde: ahora,
             message: 'Tablero limpio. Las partidas siguen en el histórico.' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

/** Deshace el corte: el tablero vuelve a contar todo el día. */
function reabrirTableroJuegos() {
  try {
    PropertiesService.getScriptProperties().deleteProperty(_JUEGOS_CORTE);
    return { ok: true, tableroDesde: '' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}
