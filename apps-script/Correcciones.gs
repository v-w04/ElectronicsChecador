/**
 * ============================================================================
 *  Correcciones.gs — BORRAR UNA CHECADA MAL REGISTRADA
 * ============================================================================
 *  Pasa: alguien le da dos veces al botón, o marca "salida a comer" cuando
 *  quería marcar el regreso. Antes había que entrar al Sheet a borrar el
 *  renglón a mano.
 *
 *  Reglas:
 *    · Solo se puede borrar una checada DE HOY. Lo de días pasados se
 *      corrige en el Sheet, no desde la app.
 *    · Solo las propias: la función recibe el PIN y solo toca los renglones
 *      de esa persona.
 *    · Nada se pierde: antes de borrar, el renglón se copia a la hoja
 *      CHECADAS_BORRADAS con quién y cuándo lo borró.
 *
 *  También se puede CAMBIAR LA HORA de una checada (corregirHoraChecadaPropia,
 *  al final de este archivo), con las mismas reglas.
 *
 *  Ojo: esto le da a cada quien la posibilidad de quitar su propia entrada
 *  tarde. Por eso queda el rastro en CHECADAS_BORRADAS — conviene revisarla
 *  de vez en cuando.
 * ============================================================================
 */

var CHECADAS_BORRADAS_HOJA = 'CHECADAS_BORRADAS';

function crearHojaChecadasBorradas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CHECADAS_BORRADAS_HOJA);
  if (sheet) return sheet;

  sheet = ss.insertSheet(CHECADAS_BORRADAS_HOJA);
  sheet.getRange(1, 1, 1, 6)
    .setValues([ENC_CHECADAS_BORRADAS])
    .setBackground('#8c2b26').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(3, 220);
  sheet.setFrozenRows(1);
  return sheet;
}

/**
 * Borra UNA checada de hoy.
 *   pin   — de quién es
 *   hora  — la que muestra la app ("14:05:33" o "14:05")
 *   tipo  — ENTRADA, SALIDA_COMIDA, etc.
 */
function borrarChecadaPropia(pin, hora, tipo) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (!pin) return { ok: false, message: 'Falta el PIN' };

    var usuarios = getTodosLosUsuarios();
    var emp = null;
    (usuarios.usuarios || []).forEach(function (u) {
      if (_normId(u.pin) === _normId(pin)) emp = u;
    });
    if (!emp) return { ok: false, message: 'No te encontré en la lista' };

    var idN = _normId(emp.idUsuario);
    var hoy = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
    var hhmm = (hora || '').toString().match(/(\d{1,2}):(\d{2})/);
    if (!hhmm) return { ok: false, message: 'Hora inválida' };
    var buscada = hhmm[0];
    var tipoN = (tipo || '').toString().trim().toUpperCase();

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CHECADOR_CHOFERES');
    if (!sheet || sheet.getLastRow() < 3) return { ok: false, message: 'No hay checadas' };

    var datos = _leerOrdenado_(sheet, 2, 3, ENC_CHECADAS);

    // De abajo hacia arriba: se borra la más reciente que coincida y se
    // evita que los índices se recorran a media pasada.
    for (var i = datos.length - 1; i >= 0; i--) {
      var r = datos[i];
      if (_normId(r[0]) !== idN) continue;
      if ((r[2] || '').toString() !== hoy) continue;
      if ((r[9] || '').toString().trim().toUpperCase() !== tipoN) continue;

      var hFila = (r[3] || '').toString().match(/(\d{1,2}):(\d{2})/);
      if (!hFila || hFila[0] !== buscada) continue;

      _agregarFila_(crearHojaChecadasBorradas(), 1, ENC_CHECADAS_BORRADAS, [
        Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm'),
        r[0], r[1], r[2], r[3], r[9]
      ]);

      sheet.deleteRow(i + 3);   // los datos empiezan en el renglón 3
      return { ok: true, message: 'Checada borrada', sello: _marcarCambio_(pin) };
    }

    return { ok: false, message: 'No encontré esa checada' };

  } catch (e) {
    Logger.log('❌ borrarChecadaPropia: ' + e.message);
    return { ok: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}


/* ===========================================================================
   CORREGIR LA HORA DE UNA CHECADA
   ===========================================================================
   Para cuando la checada es la correcta pero la hora no: se marcó tarde, se
   olvidó marcar la salida a comer y se hizo hasta el regreso, etc. En vez de
   borrar y volver a checar (que pone la hora de AHORA), se le pone la hora
   que de verdad fue.

   Mismas reglas que borrar: solo de HOY, solo las propias, y queda rastro en
   CHECADAS_BORRADAS (la hora vieja, en Hora, y la nueva dentro de Tipo).

   Reglas de la hora nueva:
     · No puede ser mayor que la hora de ahora.
     · Tiene que quedar entre la checada de antes y la de después, para que
       el día siga en orden (entrada, desayuno, comida... no se cruzan).

   QUÉ SE RECALCULA — nada se guarda calculado, así que cambiar la hora en la
   hoja ya mueve todo lo que se lee de ella:
     · Retardos, bono y la quincena (se leen del Sheet cada vez).
     · El tiempo de desayuno / comida y su exceso (salen de salida → regreso).
     · El motor de alertas (lee las checadas en cada corrida). Solo se limpian
       las marcas anti-duplicado del descanso con la hora vieja.
   Y aquí se devuelve el veredicto nuevo de la checada corregida (y de su
   regreso, si la que se movió fue una salida) y las checadas de hoy según el
   Sheet, para que la app se pinte con eso mismo.
   =========================================================================== */

function _ixChecadas_() {
  return {
    id:     ENC_CHECADAS.indexOf('ID Usuario'),
    nombre: ENC_CHECADAS.indexOf('Nombre'),
    fecha:  ENC_CHECADAS.indexOf('Fecha'),
    hora:   ENC_CHECADAS.indexOf('Hora'),
    ts:     ENC_CHECADAS.indexOf('Timestamp Completo'),
    tipo:   ENC_CHECADAS.indexOf('Tipo Checada')
  };
}

/** '' si la hora nueva es válida; si no, el motivo en una frase.
 *  mins = minutos de las checadas de hoy en orden; pos = la que se corrige. */
function _horaNuevaValida_(mins, pos, nuevaMin, ahoraMin) {
  if (nuevaMin > ahoraMin) return 'Esa hora todavía no llega.';
  var ant = pos > 0 ? mins[pos - 1] : null;
  var sig = pos < mins.length - 1 ? mins[pos + 1] : null;
  if ((ant !== null && nuevaMin < ant) || (sig !== null && nuevaMin > sig)) {
    return 'Tiene que quedar entre ' + (ant !== null ? _minAHora(ant) : '00:00') +
           ' y ' + _minAHora(sig !== null ? sig : ahoraMin) + '.';
  }
  return '';
}

/** Quita las marcas anti-duplicado del descanso con la hora vieja. La hora
 *  nueva trae marcas nuevas, así que las alertas se vuelven a calcular. */
function _limpiarMarcasDescanso_(hoy, idN, tipo, minViejo) {
  var nom = tipo === 'SALIDA_DESAYUNO' ? 'desayuno' : (tipo === 'SALIDA_COMIDA' ? 'comida' : '');
  if (!nom) return;
  var prefijo = 'alerta_' + hoy + '|' + idN + '|' + nom + '@' + minViejo + '|';
  var props = PropertiesService.getScriptProperties();
  var todas = props.getProperties();
  for (var k in todas) if (k.indexOf(prefijo) === 0) props.deleteProperty(k);
}

/**
 * Cambia la hora de UNA checada de hoy.
 *   pin       — de quién es
 *   hora      — la que muestra la app hoy ("14:05:33" o "14:05")
 *   tipo      — ENTRADA, SALIDA_COMIDA, etc.
 *   horaNueva — "HH:MM"
 */
function corregirHoraChecadaPropia(pin, hora, tipo, horaNueva) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); }
  catch (e) { return { ok: false, message: 'El sistema esta ocupado, intenta otra vez.' }; }

  try {
    if (!pin) return { ok: false, message: 'Falta el PIN' };

    var emp = null;
    (getTodosLosUsuarios().usuarios || []).forEach(function (u) {
      if (_normId(u.pin) === _normId(pin)) emp = u;
    });
    if (!emp) return { ok: false, message: 'No te encontré en la lista' };

    var idN = _normId(emp.idUsuario);
    var ahora = new Date();
    var hoy = Utilities.formatDate(ahora, TIMEZONE, 'yyyy-MM-dd');
    var ahoraMin = parseInt(Utilities.formatDate(ahora, TIMEZONE, 'H'), 10) * 60 +
                   parseInt(Utilities.formatDate(ahora, TIMEZONE, 'm'), 10);

    var hv = (hora || '').toString().match(/(\d{1,2}):(\d{2})/);
    var hn = (horaNueva || '').toString().match(/^\s*(\d{1,2}):(\d{2})/);
    if (!hv || !hn || +hn[1] > 23 || +hn[2] > 59) return { ok: false, message: 'Hora inválida' };
    var viejaMin = parseInt(hv[1], 10) * 60 + parseInt(hv[2], 10);
    var nuevaMin = parseInt(hn[1], 10) * 60 + parseInt(hn[2], 10);
    var tipoN = (tipo || '').toString().trim().toUpperCase();
    if (viejaMin === nuevaMin) return { ok: false, message: 'Esa ya es la hora de la checada' };

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CHECADOR_CHOFERES');
    if (!sheet || sheet.getLastRow() < 3) return { ok: false, message: 'No hay checadas' };

    var X = _ixChecadas_();
    var datos = _leerOrdenado_(sheet, 2, 3, ENC_CHECADAS);

    // Las checadas de HOY de esta persona, en orden de reloj.
    var hoyLista = [];
    for (var i = 0; i < datos.length; i++) {
      var r = datos[i];
      if (_normId(r[X.id]) !== idN) continue;
      if ((r[X.fecha] || '').toString() !== hoy) continue;
      var t = (r[X.tipo] || '').toString().trim().toUpperCase();
      if (!t) continue;                                   // legacy sin tipo
      var hm = (r[X.hora] || '').toString().match(/(\d{1,2}):(\d{2})/);
      if (!hm) continue;
      hoyLista.push({ i: i, tipo: t, min: parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10),
                      nombre: r[X.nombre], fecha: r[X.fecha], horaTxt: (r[X.hora] || '').toString() });
    }
    hoyLista.sort(function (a, b) { return a.min - b.min || a.i - b.i; });

    // La más reciente que coincida en tipo y hora.
    var pos = -1;
    for (var p = hoyLista.length - 1; p >= 0; p--) {
      if (hoyLista[p].tipo === tipoN && hoyLista[p].min === viejaMin) { pos = p; break; }
    }
    if (pos === -1) return { ok: false, message: 'No encontré esa checada' };

    var motivo = _horaNuevaValida_(hoyLista.map(function (c) { return c.min; }), pos, nuevaMin, ahoraMin);
    if (motivo) return { ok: false, message: motivo };

    var blanco = hoyLista[pos];
    var hhmmNueva = _minAHora(nuevaMin);
    var horaTxt = hhmmNueva + ':00';
    var fechaTxt = blanco.fecha.toString();
    var tsTxt = fechaTxt.substring(8, 10) + '/' + fechaTxt.substring(5, 7) + '/' +
                fechaTxt.substring(0, 4) + ' ' + horaTxt;

    // 1) Rastro, antes de tocar nada.
    _agregarFila_(crearHojaChecadasBorradas(), 1, ENC_CHECADAS_BORRADAS, [
      Utilities.formatDate(ahora, TIMEZONE, 'dd/MM/yyyy HH:mm'),
      idN, blanco.nombre, blanco.fecha, blanco.horaTxt,
      tipoN + ' (hora corregida a ' + hhmmNueva + ')'
    ]);

    // 2) Escribir SOLO Hora y Timestamp, donde estén esas columnas.
    var ix = _colsPorNombre_(sheet, 2, ENC_CHECADAS).idx;
    var fila = blanco.i + 3;                              // los datos empiezan en el renglón 3
    sheet.getRange(fila, ix[X.hora] + 1).setNumberFormat('@').setValue(horaTxt);
    sheet.getRange(fila, ix[X.ts] + 1).setNumberFormat('@').setValue(tsTxt);

    // 3) Recalcular: alertas del descanso y veredictos con la hora nueva.
    _limpiarMarcasDescanso_(hoy, idN, tipoN, viejaMin);

    blanco.min = nuevaMin;
    blanco.horaTxt = horaTxt;
    hoyLista.sort(function (a, b) { return a.min - b.min || a.i - b.i; });

    var cfg = _cfgEmpleadoServ(idN) || {};
    function veredictoDe(k) {
      var previas = hoyLista.slice(0, k).map(function (c) { return { tipo: c.tipo, min: c.min }; });
      return _calcularVeredictoServ(hoyLista[k].tipo, idN, hoyLista[k].horaTxt, previas, cfg);
    }
    var kBlanco = hoyLista.indexOf(blanco);
    var veredicto = veredictoDe(kBlanco);
    var partes = [veredicto.texto + (veredicto.detalle ? ' · ' + veredicto.detalle : '')];

    // Si se movió una SALIDA a desayunar/comer, el que cambia es su REGRESO.
    var regresoDe = { SALIDA_DESAYUNO: 'REGRESO_DESAYUNO', SALIDA_COMIDA: 'REGRESO_COMIDA' }[tipoN];
    if (regresoDe) {
      for (var k = kBlanco + 1; k < hoyLista.length; k++) {
        if (hoyLista[k].tipo === regresoDe) {
          var vR = veredictoDe(k);
          partes.push('Regreso: ' + vR.texto + (vR.detalle ? ' · ' + vR.detalle : ''));
          break;
        }
      }
    }

    var sello = _marcarCambio_(pin);
    if (emp.idUsuario) _marcarCambio_(emp.idUsuario);

    return {
      ok: true,
      message: 'Hora corregida',
      tipo: tipoN, hora: horaTxt,
      veredicto: veredicto,
      resumen: partes.join(' | '),
      checadasHoy: hoyLista.map(function (c) { return { tipo: c.tipo, hora: c.horaTxt }; }),
      sello: sello
    };

  } catch (e) {
    Logger.log('❌ corregirHoraChecadaPropia: ' + e.message);
    return { ok: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}
