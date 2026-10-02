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
      _leerOrdenado_(sheet, 2, 3, ENC_CHECADAS).forEach(function(r) {
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


/* ===========================================================================
   REVISAR FÓRMULAS — cuáles se romperían si se mueve una columna
   ===========================================================================
   Desde fuera del Sheet no se pueden ver las fórmulas (la exportación solo
   trae los resultados). Esto las recorre TODAS desde adentro y separa:

     · Las que apuntan a una COLUMNA FIJA (A:A, $C$2, IMPORTRANGE con rango
       cerrado…). Si alguien mueve o inserta una columna, estas se recorren
       o apuntan a otro lado.
     · Las que usan BUSCAR/COINCIDIR por nombre, que aguantan el cambio.

   Se corre desde el menú Checador → Revisar fórmulas.
   =========================================================================== */
function revisarFormulas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var riesgo = [], seguras = 0, total = 0;

  ss.getSheets().forEach(function (sh) {
    var fs;
    try { fs = sh.getDataRange().getFormulas(); } catch (e) { return; }
    for (var i = 0; i < fs.length; i++) {
      for (var j = 0; j < fs[i].length; j++) {
        var f = fs[i][j];
        if (!f) continue;
        total++;
        var porNombre = /COINCIDIR|MATCH|BUSCARH|HLOOKUP|INDIRECTO|INDIRECT/i.test(f);
        var colFija = /\$[A-Z]{1,3}\$?\d*|\b[A-Z]{1,3}:[A-Z]{1,3}\b|IMPORTRANGE/i.test(f);
        if (colFija && !porNombre) {
          riesgo.push(sh.getName() + '!' + sh.getRange(i + 1, j + 1).getA1Notation() +
                      '  ' + f.substring(0, 90));
        } else {
          seguras++;
        }
      }
    }
  });

  var msg;
  if (!total) {
    msg = 'No hay fórmulas en ninguna hoja: nada que se pueda romper por mover una columna.';
  } else if (!riesgo.length) {
    msg = total + ' fórmula(s) y ninguna depende de una columna fija.';
  } else {
    msg = total + ' fórmula(s). ' + riesgo.length + ' apuntan a una COLUMNA FIJA y se ' +
          'romperían si mueves columnas:\n\n' + riesgo.slice(0, 25).join('\n') +
          (riesgo.length > 25 ? '\n\n…y ' + (riesgo.length - 25) + ' más (ver el registro).' : '');
  }
  Logger.log(msg);
  return { ok: true, total: total, enRiesgo: riesgo.length, seguras: seguras,
           detalle: riesgo, message: msg };
}
