function doGet(e) {
  // La PWA vive en GitHub Pages; este deployment es solo API (doPost).
  // ⭐ DIAGNÓSTICO: abrir esta URL en el navegador muestra a qué spreadsheet
  // está ligado este backend y cuántas checadas tiene HOY.
  var info = { ok: true, servicio: 'Checador Electronics México — API', hora: new Date().toISOString() };
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    info.spreadsheetNombre = ss.getName();
    info.spreadsheetUrl = ss.getUrl();
    var sheet = ss.getSheetByName('CHECADOR_CHOFERES');
    if (sheet) {
      var filas = Math.max(0, sheet.getLastRow() - 2);
      info.checadorChoferes = { filasDeDatos: filas };
      if (filas > 0) {
        var hoy = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
        var data = sheet.getRange(3, 1, filas, 10).getValues();
        var deHoy = data.filter(function(r) { return (r[2] || '').toString() === hoy; });
        info.checadorChoferes.checadasHoy = deHoy.length;
        info.checadorChoferes.ultimasHoy = deHoy.slice(-5).map(function(r) {
          return { id: r[0], nombre: r[1], hora: r[3], tipo: r[9] };
        });
      }
    } else {
      info.checadorChoferes = 'La hoja CHECADOR_CHOFERES no existe aún en este spreadsheet';
    }
  } catch (err) {
    info.diagError = err.message;
  }
  return ContentService
    .createTextOutput(JSON.stringify(info, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// API — doPost: dispatcher de llamadas del frontend
// ============================================================================
// Mapa explícito en vez de eval(). La lista blanca sigue siendo la misma
// idea, pero ahora el nombre solo puede resolver a una función de este mapa:
// aunque alguien agregue un nombre por error, no hay forma de que se
// convierta en ejecución de código arbitrario.
function _funcionesExpuestas() {
  return {
    // Empleados que aparecen en la app (hoja APP_EMPLEADOS)
    getEmpleadosApp:          getEmpleadosApp,
    // Entrega la liga del checador del site SOLO con el PIN correcto.
    // guardarPinIntranet NO va aqui a proposito: se cambia desde el menu.
    abrirChecadorSite:        abrirChecadorSite,

    // Login / usuarios
    getTodosLosUsuarios:      getTodosLosUsuarios,
    getVersionUsuarios:       getVersionUsuarios,
    validarPin:               validarPin,
    validarContrasena:        validarContrasena,
    guardarContrasena:        guardarContrasena,
    verificarTieneContrasena: verificarTieneContrasena,

    // Checadas
    guardarChecadaChofer:     guardarChecadaChofer,
    checadaSalidaRemota:      checadaSalidaRemota,
    borrarChecadaPropia:      borrarChecadaPropia,

    // Perfil del empleado
    getPerfilEmpleado:        getPerfilEmpleado,
    getHistorialQuincena:     getHistorialQuincena,

    // Configuración
    getConfigAlertas:         getConfigAlertas,
    getZonasValidas:          getZonasValidas,
    getAvatarOverrides:       getAvatarOverrides,

    // Notificaciones push
    registrarPushToken:       registrarPushToken,
    eliminarPushToken:        eliminarPushToken,
    testPushEmpleado:         testPushEmpleado,
    getMisDispositivos:       getMisDispositivos,
    desvincularDispositivo:   desvincularDispositivo,
    podarTokens:              podarTokens,

    // Preferencias de alertas
    getPrefsAlertas:          getPrefsAlertas,
    guardarPrefsAlertas:      guardarPrefsAlertas,

    // Excepciones y ausencias
    guardarExcepcionDia:      guardarExcepcionDia,
    quitarExcepcionDia:       quitarExcepcionDia,
    getExcepcionHoy:          getExcepcionHoy,
    registrarAusencia:        registrarAusencia,

    // Tablero de juegos
    getJuegosTablero:         getJuegosTablero,
    registrarPartida:         registrarPartida,
    borrarPartida:            borrarPartida,
    agregarJuego:             agregarJuego,
    limpiarTableroJuegos:     limpiarTableroJuegos,
    reabrirTableroJuegos:     reabrirTableroJuegos,

    // Acuse de recibo de las notificaciones (lo llama el service worker)
    confirmarEntregaPush:     confirmarEntregaPush,

    // Diagnóstico
    diagnosticoCompleto:      diagnosticoCompleto,
    diagnosticoAlertas:       diagnosticoAlertas

    // ⛔ limpiarTodoChecador YA NO se expone. Borraba todas las checadas y
    // cualquiera con la URL podía llamarla: la URL vive en el repo público.
    // Sigue existiendo en Mantenimiento.gs y se corre desde el editor.
  };
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const fnName = body.fn;
    const args = body.args || [];

    const fn = _funcionesExpuestas()[fnName];
    if (typeof fn !== 'function') {
      return _jsonResponse({ error: true, message: 'No permitida: ' + fnName });
    }

    return _jsonResponse(fn.apply(null, args));

  } catch (err) {
    return _jsonResponse({ error: true, message: err.message });
  }
}

function _jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
