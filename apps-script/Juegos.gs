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
    //
    // OJO CON LO QUE SE QUITÓ AQUÍ. Antes esto llamaba a getEmpleadosApp(),
    // que a su vez llama a getTodosLosUsuarios() para traer el PIN y el turno
    // "vivos". Eso son CUATRO hojas más — USUARIOS, CONTRASENAS_CHOFERES,
    // TURNOS_DEFAULT y CONFIG_TURNOS, dos de ellas con getDataRange() — que
    // se leían, se cruzaban y se tiraban a la basura: el tablero de juegos
    // solo usa id, nombre y área, y los tres viven en APP_EMPLEADOS.
    //
    // Pasamos de 7 lecturas de hoja a 3. Era lo que más tardaba.
    var jugadores = [];
    var avatares = {};
    try {
      var hojaEmp = crearHojaAppEmpleados();
      if (hojaEmp.getLastRow() > 1) {
        hojaEmp.getRange(2, 1, hojaEmp.getLastRow() - 1, 5).getValues().forEach(function (r) {
          var marca = (r[3] || '').toString().trim().toUpperCase();
          if (marca !== 'SÍ' && marca !== 'SI') return;
          var id = _normId(r[0]);
          var nombre = (r[1] || '').toString().trim();
          if (!id || !nombre) return;
          jugadores.push({ id: id, nombre: nombre, area: (r[4] || '').toString().trim().toUpperCase() });
        });
        jugadores.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
      }
      avatares = getAvatarOverrides();
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

/**
 * VARIAS PARTIDAS DE UN JALON.
 *
 * Un Grand Prix de 12 carreras se guardaba con DOCE llamadas al servidor,
 * una tras otra, y cada una pedia el candado por su cuenta. Doce idas y
 * vueltas en fila es lo que hacia que "guardar" se sintiera eterno.
 *
 * Aqui se escribe todo con un solo setValues y un solo candado. Las horas
 * siguen saliendo en orden porque el orden se respeta en el arreglo.
 *
 * @param {Array} lista partidas, cada una como las recibe registrarPartida
 */
function registrarPartidas(lista) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); }
  catch (e) { return { ok: false, message: 'El sistema esta ocupado, intenta otra vez.' }; }
  try {
    lista = lista || [];
    if (!lista.length) return { ok: false, message: 'No llego ninguna partida' };

    var sheet = crearHojaPartidas();
    var ahora = new Date();
    var hora  = Utilities.formatDate(ahora, TIMEZONE, 'HH:mm');
    var sello = Utilities.formatDate(ahora, TIMEZONE, 'dd/MM/yyyy HH:mm');
    var base  = Utilities.formatDate(ahora, TIMEZONE, 'yyyyMMdd-HHmmss');

    var filas = [], ids = [];
    for (var n = 0; n < lista.length; n++) {
      var p = lista[n];
      if (!p || !p.juego) return { ok: false, message: 'Falta el juego en la ronda ' + (n + 1) };
      var jug = p.jugadores || [];
      if (jug.length < 2) return { ok: false, message: 'La ronda ' + (n + 1) + ' necesita al menos 2 jugadores' };

      var fecha = (p.fecha || '').toString().trim() ||
                  Utilities.formatDate(ahora, TIMEZONE, 'yyyy-MM-dd');
      // El sufijo mantiene separadas las rondas guardadas en el mismo segundo.
      var idPartida = 'P' + base + (lista.length > 1 ? '-' + (n + 1) : '');
      ids.push(idPartida);

      for (var k = 0; k < jug.length; k++) {
        var j = jug[k];
        filas.push([
          idPartida, fecha, hora, p.juego, (p.nota || '').toString(),
          (j.id || '').toString(), (j.nombre || '').toString(),
          (j.posicion === '' || j.posicion === null || j.posicion === undefined) ? '' : Number(j.posicion),
          (j.puntos   === '' || j.puntos   === null || j.puntos   === undefined) ? '' : Number(j.puntos),
          sello
        ]);
      }
    }

    var fila = sheet.getLastRow() + 1;
    sheet.getRange(fila, 1, filas.length, 10).setValues(filas);
    sheet.getRange(fila, 1, filas.length, 3).setNumberFormat('@');

    Logger.log('\ud83c\udfae ' + ids.length + ' partida(s), ' + filas.length + ' filas');
    return { ok: true, idPartidas: ids, partidas: ids.length,
             jugadores: filas.length, message: 'Guardado' };

  } catch (e) {
    Logger.log('\u274c registrarPartidas: ' + e.message);
    return { ok: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/** Borra una partida completa (todas sus filas). Para corregir un dedazo. */
/**
 * PONERLE LUGARES A UNA PARTIDA YA GUARDADA.
 *
 * La partida se registra primero con los oponentes y sin lugares: en el
 * momento nadie quiere estar tecleando posiciones. Despues se entra y se
 * llenan. Esto escribe la columna Posicion de las filas de esa partida.
 *
 * SIEMPRE se ofrecen 12 lugares aunque jueguen tres: en Mario Kart corren
 * doce y los que no aparecen aqui eran computadora o gente por internet.
 *
 * @param {string} idPartida  el ID que amarra las filas
 * @param {Array}  lugares    [{id:'55', posicion:3}, ...]. Un jugador sin
 *                            posicion, o con posicion nula, deja su celda
 *                            vacia: la partida puede llenarse a medias.
 */
function actualizarPosiciones(idPartida, lugares) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); }
  catch (e) { return { ok: false, message: 'El sistema esta ocupado, intenta otra vez.' }; }
  try {
    if (!idPartida) return { ok: false, message: 'Falta el ID de la partida' };
    var sheet = crearHojaPartidas();
    if (sheet.getLastRow() < 2) return { ok: false, message: 'No hay partidas' };

    var mapa = {};
    (lugares || []).forEach(function (x) {
      if (!x) return;
      var pos = (x.posicion === '' || x.posicion === null || x.posicion === undefined)
                ? '' : Number(x.posicion);
      if (pos !== '' && (isNaN(pos) || pos < 1 || pos > 12)) pos = '';
      mapa[_normId(x.id)] = pos;
    });

    // Se leen las columnas 1 (ID Partida) y 6 (ID Jugador) de un jalon, y se
    // escribe solo la 8. Nada de una llamada por fila.
    var n = sheet.getLastRow() - 1;
    var ids   = sheet.getRange(2, 1, n, 1).getValues();
    var quien = sheet.getRange(2, 6, n, 1).getValues();
    var pos   = sheet.getRange(2, 8, n, 1).getValues();

    var tocadas = 0;
    for (var i = 0; i < n; i++) {
      if ((ids[i][0] || '').toString() !== idPartida) continue;
      var k = _normId(quien[i][0]);
      if (!(k in mapa)) continue;
      pos[i][0] = mapa[k];
      tocadas++;
    }
    if (!tocadas) return { ok: false, message: 'Esa partida ya no existe' };

    sheet.getRange(2, 8, n, 1).setValues(pos);
    Logger.log('\ud83c\udfc1 Lugares de ' + idPartida + ': ' + tocadas + ' filas');
    return { ok: true, filas: tocadas, message: 'Lugares guardados' };

  } catch (e) {
    Logger.log('\u274c actualizarPosiciones: ' + e.message);
    return { ok: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

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
