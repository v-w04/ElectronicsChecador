/**
 * ============================================================================
 *  Menu.gs — MENÚ "Checador" DEL SHEET
 * ============================================================================
 *  Todo lo que antes había que correr desde el editor vive aquí.
 *  Cada opción contesta en una ventanita, en una o dos líneas.
 * ============================================================================
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Checador')
    .addItem('Empleados en la app', 'menuEmpleadosApp')
    .addSeparator()
    .addItem('Probar notificación a un celular', 'menuProbarCelular')
    .addItem('Entregas de hoy', 'menuEntregasHoy')
    .addItem('Diagnóstico', 'menuDiagnostico')
    .addSeparator()
    .addItem('Configurar Firebase', 'configurarFirebase')
    .addItem('Verificar Firebase', 'menuVerificarFirebase')
    .addItem('Activar alertas', 'menuActivarAlertas')
    .addToUi();
}

function _aviso_(titulo, texto) {
  SpreadsheetApp.getUi().alert(titulo, texto, SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuVerificarFirebase() {
  var r = chequeoFirebase_();
  _aviso_(r.ok ? '✅ Firebase' : '❌ Firebase', r.msg);
}

function menuProbarCelular() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('Probar notificación', 'PIN del empleado (vacío = 0055)', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var pin = (resp.getResponseText() || '').trim() || '0055';

  var fb = chequeoFirebase_();
  if (!fb.ok) { _aviso_('❌ Firebase', fb.msg); return; }

  var r = testPushEmpleado(pin);
  _aviso_(r.ok ? '✅ Enviada' : '❌ No salió',
          (r.message || '').replace(/^[✅❌]\s*/, '') +
          (r.ok ? '\n\nEn PUSH_LOG, Entregada = SÍ confirma que el celular la mostró.' : ''));
}

function menuEntregasHoy() {
  var r = resumenEntregasHoy();
  if (!r.enviadas) { _aviso_('Entregas de hoy', 'Hoy no se ha mandado ninguna alerta.'); return; }
  var lineas = Object.keys(r.porEmpleado).map(function (n) {
    var e = r.porEmpleado[n];
    return n + ': ' + e.entregadas + ' de ' + e.enviadas;
  });
  _aviso_('Entregas de hoy',
          'Enviadas ' + r.enviadas + ' · aceptadas ' + r.aceptadas + ' · entregadas ' + r.entregadas +
          '\n\n' + lineas.join('\n'));
}

function menuDiagnostico() {
  var d = diagnosticoCompleto();
  var fb = chequeoFirebase_();
  _aviso_('Diagnóstico',
          'Backend: ' + d.backendVersion + '\n' +
          'Firebase: ' + (fb.ok ? '✅ ' : '❌ ') + fb.msg + '\n' +
          'Alertas automáticas: ' + d.trigger + '\n' +
          'Dispositivos vinculados: ' + d.dispositivosPush + '\n' +
          'Checadas hoy: ' + d.checadasHoy);
}

function menuActivarAlertas() {
  instalarTriggerAlertas();
  _aviso_('✅ Alertas activadas',
          'Corren cada minuto, de ' + ALERTAS_HORA_INICIO + ':00 a ' + ALERTAS_HORA_FIN + ':00, ' +
          'con la cuenta que está abriendo este Sheet.');
}


/**
 * Crea la hoja APP_EMPLEADOS si no existe y le agrega a los que falten.
 * Nunca cambia lo que ya está marcado: lo que pusiste en SÍ o NO se respeta.
 */
function menuEmpleadosApp() {
  var r = sincronizarAppEmpleados();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(APP_EMPLEADOS_HOJA);
  if (sheet) ss.setActiveSheet(sheet);

  var enApp = getEmpleadosApp().empleados.length;
  _aviso_('Empleados en la app',
          (r && r.agregados
             ? 'Agregué ' + r.agregados + ' empleado' + (r.agregados === 1 ? '' : 's') + ' a la lista.\n\n'
             : 'No hay empleados nuevos.\n\n') +
          'Aparecen hoy en la app: ' + enApp + '.\n\n' +
          'Cambia la columna "En la app" a SÍ o NO y listo: la app lo toma sola.');
}
