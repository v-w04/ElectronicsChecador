/**
 * ============================================================================
 *  Empleados.gs — QUIÉN APARECE EN LA APP
 * ============================================================================
 *  Una sola hoja manda: APP_EMPLEADOS.
 *
 *  Columna "En la app":  SÍ → sale en el tablero y puede elegirse en el
 *                             celular.
 *                        NO → no existe para la app.
 *
 *  La hoja se llena sola con todos los empleados de TURNOS_DEFAULT. Al correr
 *  "Empleados en la app" otra vez solo AGREGA a los nuevos: lo que ya está
 *  marcado no se toca nunca.
 *
 *  La columna Área es la que le da color al avatar (CHOFER, PACKING, PICKING,
 *  COMPRAS, DEVOLUCIONES, KAM, OPERACIONES, RRHH, SEGURIDAD).
 * ============================================================================
 */

var APP_EMPLEADOS_HOJA = 'APP_EMPLEADOS';

// Los que ya estaban en el tablero de la oficina: entran marcados en SÍ la
// primera vez que se crea la hoja.
var _APP_EMPLEADOS_INICIALES = ['55', '50', '25', '1', '51', '23', '54', '9', '53'];

var _APP_AREAS = ['CHOFER', 'COMPRAS', 'DEVOLUCIONES', 'KAM', 'OPERACIONES',
                  'PACKING', 'PICKING', 'RRHH', 'SEGURIDAD'];

/* ===========================================================================
   CREAR / SINCRONIZAR
   =========================================================================== */

/** Devuelve la hoja, creándola y llenándola la primera vez. */
function crearHojaAppEmpleados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(APP_EMPLEADOS_HOJA);
  if (sheet) return sheet;

  sheet = ss.insertSheet(APP_EMPLEADOS_HOJA);
  sheet.getRange(1, 1, 1, 5)
    .setValues([['ID', 'Empleado', 'Turno', 'En la app', 'Área']])
    .setBackground('#1f6feb').setFontColor('#ffffff').setFontWeight('bold');

  sheet.setColumnWidth(1, 60);
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidth(3, 130);
  sheet.setColumnWidth(4, 90);
  sheet.setColumnWidth(5, 140);
  sheet.setFrozenRows(1);

  _formatoAppEmpleados_(sheet);
  sincronizarAppEmpleados();
  return sheet;
}

/** Lista desplegable, colores y la nota de la columna Área. */
function _formatoAppEmpleados_(sheet) {
  var filas = Math.max(sheet.getMaxRows() - 1, 1);

  var rangoSiNo = sheet.getRange(2, 4, filas, 1);
  rangoSiNo.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['SÍ', 'NO'], true)
      .setAllowInvalid(false)
      .build()
  ).setHorizontalAlignment('center');

  var rangoArea = sheet.getRange(2, 5, filas, 1);
  rangoArea.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(_APP_AREAS, true)
      .setAllowInvalid(true)
      .build()
  );

  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('SÍ').setBackground('#1b3a24').setFontColor('#3fb950').setBold(true)
      .setRanges([rangoSiNo]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('NO').setBackground('#2b1f1f').setFontColor('#8b949e')
      .setRanges([rangoSiNo]).build()
  ]);

  sheet.getRange(1, 4).setNote(
    'SÍ = aparece en el tablero de la oficina y puede elegirse en el celular.\n' +
    'NO = no existe para la app.'
  );
  sheet.getRange(1, 5).setNote('Le da el color al avatar. Se puede dejar vacío.');
}

/**
 * Agrega a los empleados que todavía no están en la hoja. Nunca cambia
 * una fila existente: lo que ya marcaste se respeta.
 */
function sincronizarAppEmpleados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(APP_EMPLEADOS_HOJA);
  if (!sheet) return crearHojaAppEmpleados() && sincronizarAppEmpleados();

  // Lo que ya está en la hoja
  var yaEstan = {};
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var actuales = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    actuales.forEach(function (r) {
      var id = _normId(r[0]);
      if (id) yaEstan[id] = true;
    });
  }

  // Todos los empleados que conoce el sistema
  var resp = getTodosLosUsuarios();
  var nuevos = [];
  var primeraVez = (lastRow < 2);

  (resp.usuarios || []).forEach(function (u) {
    var id = _normId(u.idUsuario);
    if (!id || id === 'ADMIN' || !u.nombre) return;
    if (yaEstan[id]) return;
    yaEstan[id] = true;

    var marcado = primeraVez && _APP_EMPLEADOS_INICIALES.indexOf(id) !== -1 ? 'SÍ' : 'NO';
    nuevos.push([id, u.nombre, u.turnoHorario || '', marcado, '']);
  });

  if (nuevos.length) {
    nuevos.sort(function (a, b) { return a[1].localeCompare(b[1], 'es'); });
    sheet.getRange(sheet.getLastRow() + 1, 1, nuevos.length, 5).setValues(nuevos);
    _formatoAppEmpleados_(sheet);
  }

  return { ok: true, agregados: nuevos.length, total: Object.keys(yaEstan).length };
}

/* ===========================================================================
   LO QUE LEE LA APP
   =========================================================================== */

/**
 * Los empleados marcados con SÍ, ya listos para pintarse.
 * NO devuelve contraseñas: la app nueva no las usa.
 */
function getEmpleadosApp() {
  try {
    var sheet = crearHojaAppEmpleados();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { ok: true, empleados: [], avatares: {} };

    var filas = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

    // PIN y turno vivos, por si cambiaron después de llenar la hoja.
    var pinPorId = {}, turnoPorId = {};
    var resp = getTodosLosUsuarios();
    (resp.usuarios || []).forEach(function (u) {
      var id = _normId(u.idUsuario);
      if (!id) return;
      pinPorId[id] = u.pin;
      turnoPorId[id] = u.turnoHorario || '';
    });

    var empleados = [];
    filas.forEach(function (r) {
      var marca = (r[3] || '').toString().trim().toUpperCase();
      if (marca !== 'SÍ' && marca !== 'SI') return;

      var id = _normId(r[0]);
      var nombre = (r[1] || '').toString().trim();
      if (!id || !nombre) return;

      empleados.push({
        id: id,
        nombre: nombre,
        pin: pinPorId[id] || '',
        turno: turnoPorId[id] || (r[2] || '').toString().trim(),
        area: (r[4] || '').toString().trim().toUpperCase()
      });
    });

    empleados.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });

    // Los avatares que cada quien ya se había armado.
    return { ok: true, empleados: empleados, avatares: getAvatarOverrides() };

  } catch (e) {
    return { ok: false, error: true, message: e.message, empleados: [], avatares: {} };
  }
}
