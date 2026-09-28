// ============================================================================
// DIAGNÓSTICO COMPLETO — panel del PIN 9999
// ============================================================================

function diagnosticoCompleto() {
  const d = { backendVersion: BACKEND_VERSION };
  try { d.deploymentUrl = ScriptApp.getService().getUrl(); } catch (e) { d.deploymentUrl = '?'; }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    d.spreadsheetNombre = ss.getName();
    d.spreadsheetId = ss.getId();
  } catch (e) { d.spreadsheetNombre = '❌ ' + e.message; }

  try {
    const saRaw = _firebaseSA_();
    if (!saRaw) {
      d.firebase = '❌ SIN CONFIGURAR — menú Checador › Configurar Firebase';
    } else {
      const sa = JSON.parse(saRaw);
      d.firebase = '✅ ' + sa.client_email;
    }
  } catch (e) { d.firebase = '❌ JSON corrupto: ' + e.message; }

  try {
    const n = ScriptApp.getProjectTriggers().filter(function(t) {
      return t.getHandlerFunction() === 'revisarAlertas';
    }).length;
    d.trigger = n > 0 ? ('✅ activo (' + n + ')') : '❌ apagadas — menú Checador › Activar alertas';
    d.ventanaMotor = ALERTAS_HORA_INICIO + ':00 a ' + ALERTAS_HORA_FIN + ':00, días hábiles';
  } catch (e) { d.trigger = '❌ ' + e.message; }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CHECADOR_CHOFERES');
    const hoy = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
    let filasHoy = 0;
    const ultimas = [];
    if (sheet && sheet.getLastRow() >= 3) {
      sheet.getRange(3, 1, sheet.getLastRow() - 2, 10).getValues().forEach(function(r) {
        if ((r[2] || '').toString() === hoy) {
          filasHoy++;
          ultimas.push((r[1] || '').toString().split(' ')[0] + ' ' + (r[3] || '') + ' ' + (r[9] || ''));
        }
      });
    }
    d.checadasHoy = filasHoy;
    d.ultimasHoy = ultimas.slice(-4);
  } catch (e) { d.checadasHoy = '❌ ' + e.message; }

  try {
    const st = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PUSH_TOKENS');
    d.dispositivosPush = st ? Math.max(0, st.getLastRow() - 1) : 0;
  } catch (e) { d.dispositivosPush = '?'; }
  try {
    const t2 = _leerConfigTurnos()['T2'] || {};
    d.duracionesT2 = 'desayuno ' + (t2.desDur || '?') + ' min · comida ' + (t2.comDur || '?') + ' min';
  } catch (e) { d.duracionesT2 = '?'; }

  d.horaServidor = Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM HH:mm:ss');
  // Corrida desde el editor: sin esto no se ve nada en pantalla.
  Logger.log(JSON.stringify(d, null, 2));
  return d;
}

// ============================================================================
// LIMPIEZA TOTAL — botón 🧹 del panel de diagnóstico
// ============================================================================
// Borra checadas y marcas de alertas. CONSERVA los dispositivos vinculados
// y las preferencias de alertas.

