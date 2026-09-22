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
    .setValues([['Borrado el', 'ID Usuario', 'Nombre', 'Fecha', 'Hora', 'Tipo']])
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

    var datos = sheet.getRange(3, 1, sheet.getLastRow() - 2, 10).getValues();

    // De abajo hacia arriba: se borra la más reciente que coincida y se
    // evita que los índices se recorran a media pasada.
    for (var i = datos.length - 1; i >= 0; i--) {
      var r = datos[i];
      if (_normId(r[0]) !== idN) continue;
      if ((r[2] || '').toString() !== hoy) continue;
      if ((r[9] || '').toString().trim().toUpperCase() !== tipoN) continue;

      var hFila = (r[3] || '').toString().match(/(\d{1,2}):(\d{2})/);
      if (!hFila || hFila[0] !== buscada) continue;

      crearHojaChecadasBorradas().appendRow([
        Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm'),
        r[0], r[1], r[2], r[3], r[9]
      ]);

      sheet.deleteRow(i + 3);   // los datos empiezan en el renglón 3
      return { ok: true, message: 'Checada borrada' };
    }

    return { ok: false, message: 'No encontré esa checada' };

  } catch (e) {
    Logger.log('❌ borrarChecadaPropia: ' + e.message);
    return { ok: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}
