// ============================================================================
// FIREBASE — credenciales FUERA del código
// ============================================================================
// ⚠️ CAMBIO IMPORTANTE
//
// Antes el service account completo (incluida la private_key) estaba escrito
// aquí como constante. Eso significa que cualquiera que viera el código
// —una copia, una captura, un repo, un compañero con acceso al proyecto—
// podía mandar notificaciones haciéndose pasar por la empresa y entrar al
// proyecto de Firebase.
//
// Ahora vive en PropertiesService, cifrado y fuera del código.
//
// CÓMO CONFIGURARLO (una sola vez):
//   1. Consola de Firebase → ⚙️ → Cuentas de servicio → Generar nueva clave
//   2. Abre el .json que se descarga y copia TODO su contenido
//   3. Aquí en el editor, ejecuta configurarFirebase() y pégalo
//
// Y revoca la llave vieja en esa misma pantalla: borrarla del código no la
// invalida, sigue funcionando hasta que la revoques.

var PROP_FIREBASE_SA = 'FIREBASE_SERVICE_ACCOUNT';

function _firebaseSA_() {
  return PropertiesService.getScriptProperties().getProperty(PROP_FIREBASE_SA) || '';
}

function configurarFirebase() {
  const ui = SpreadsheetApp.getUi();
  const actual = _firebaseSA_();

  const r = ui.prompt('🔥 Service account de Firebase',
    'Estado: ' + (actual ? 'configurado (' + actual.length + ' caracteres)' : 'SIN CONFIGURAR') + '\n\n' +
    'Pega el contenido COMPLETO del .json que descargaste de\n' +
    'Firebase → ⚙️ → Cuentas de servicio → Generar nueva clave privada.\n\n' +
    'Se guarda cifrado en PropertiesService. No queda en el código.',
    ui.ButtonSet.OK_CANCEL);

  if (r.getSelectedButton() !== ui.Button.OK) return;

  const v = (r.getResponseText() || '').trim();
  if (!v) { ui.alert('No se guardó nada (campo vacío).'); return; }

  let sa;
  try {
    sa = JSON.parse(v);
  } catch (e) {
    ui.alert('❌ Eso no es un JSON válido', e.message, ui.ButtonSet.OK);
    return;
  }
  if (!sa.private_key || !sa.client_email || !sa.project_id) {
    ui.alert('❌ Falta información',
      'El JSON no trae private_key, client_email o project_id. ' +
      'Asegúrate de copiar el archivo completo.', ui.ButtonSet.OK);
    return;
  }

  PropertiesService.getScriptProperties().setProperty(PROP_FIREBASE_SA, v);
  CacheService.getScriptCache().remove('fcm_access_token');

  ui.alert('✅ Guardado',
    'Proyecto: ' + sa.project_id + '\nCuenta: ' + sa.client_email + '\n\n' +
    'Ahora prueba con el botón de notificación del perfil.\n\n' +
    'No olvides REVOCAR la llave anterior en la consola de Firebase.',
    ui.ButtonSet.OK);
}

function borrarConfigFirebase() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_FIREBASE_SA);
  CacheService.getScriptCache().remove('fcm_access_token');
  Logger.log('🔥 Configuración de Firebase borrada');
  return { ok: true };
}

// ============================================================================
// PUSH_TOKENS — un DISPOSITIVO por FILA
// ============================================================================

var _PUSH_HEADERS = ['PIN', 'ID Usuario', 'Nombre', 'Token', 'Dispositivo', 'Registrado', 'Último uso'];

function crearHojaPushTokens() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('PUSH_TOKENS');
  if (!sheet) {
    sheet = ss.insertSheet('PUSH_TOKENS');
    sheet.getRange(1, 1, 1, _PUSH_HEADERS.length).setValues([_PUSH_HEADERS])
      .setBackground('#3f51b5').setFontColor('#fff').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(4, 380);
    sheet.setColumnWidth(5, 200);
    return sheet;
  }
  // ⚠️ Si la hoja perdió su encabezado, la primera fila de datos queda
  // invisible para todo el código (que arranca en la fila 2 a propósito).
  // Pasó: un token de Eric llevaba meses ignorado. Se repone antes de nada.
  const primera = sheet.getRange(1, 1, 1, 4).getValues()[0];
  if ((primera[0] || '').toString().trim().toUpperCase() !== 'PIN') {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, _PUSH_HEADERS.length).setValues([_PUSH_HEADERS])
      .setBackground('#3f51b5').setFontColor('#fff').setFontWeight('bold');
    sheet.setFrozenRows(1);
    Logger.log('🔧 PUSH_TOKENS: se repuso el encabezado que faltaba');
    return sheet;
  }

  // Migración del formato viejo (PIN, ID, Nombre, Token, Registrado)
  const enc = sheet.getRange(1, 1, 1, Math.max(5, sheet.getLastColumn())).getValues()[0];
  if ((enc[4] || '').toString().trim() === 'Registrado') {
    sheet.insertColumnBefore(5);
    sheet.getRange(1, 5).setValue('Dispositivo');
    sheet.getRange(1, 7).setValue('Último uso');
    sheet.getRange(1, 1, 1, _PUSH_HEADERS.length)
      .setBackground('#3f51b5').setFontColor('#fff').setFontWeight('bold');
    sheet.setColumnWidth(5, 200);
    Logger.log('🔧 PUSH_TOKENS migrada a 7 columnas');
  }
  return sheet;
}

function registrarPushToken(pin, token, tokenAnterior, dispositivo) {
  try {
    if (!pin || !token) return { ok: false, message: 'pin y token requeridos' };
    // Si este dispositivo re-vincula, borrar su token viejo para no
    // mandarle la misma notificación dos veces.
    if (tokenAnterior && tokenAnterior !== token) {
      try { eliminarPushToken(tokenAnterior); } catch (e) {}
    }
    const usuarios = getTodosLosUsuarios();
    let emp = null;
    (usuarios.usuarios || []).forEach(function(u) { if (_normId(u.pin) === _normId(pin)) emp = u; });
    if (!emp) return { ok: false, message: 'PIN no encontrado' };

    const sheet = crearHojaPushTokens();
    const data = sheet.getDataRange().getValues();
    const ahora = Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm');
    const disp = (dispositivo || 'Dispositivo').toString().substring(0, 60);

    for (let i = 1; i < data.length; i++) {
      if ((data[i][3] || '').toString() === token) {
        sheet.getRange(i + 1, 5).setValue(disp);
        sheet.getRange(i + 1, 7).setValue(ahora);
        return { ok: true, message: 'Dispositivo ya vinculado' };
      }
    }
    sheet.appendRow([emp.pin, emp.idUsuario, emp.nombre, token, disp, ahora, ahora]);
    const total = _contarDispositivos(emp.pin);
    Logger.log('🔔 Dispositivo vinculado: ' + emp.nombre + ' · ' + disp + ' (total: ' + total + ')');
    return { ok: true, message: 'Dispositivo vinculado (' + total + ' en total)' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

function eliminarPushToken(token) {
  try {
    const sheet = crearHojaPushTokens();
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if ((data[i][3] || '').toString() === token) sheet.deleteRow(i + 1);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

// ── Envío FCM (HTTP v1) con OAuth del service account ───────────────────────

function _obtenerAccessTokenFCM() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('fcm_access_token');
  if (cached) return cached;

  const sa = JSON.parse(_firebaseSA_());
  const ahora = Math.floor(Date.now() / 1000);
  const header = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: ahora,
    exp: ahora + 3600
  }));
  const firma = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(header + '.' + claims, sa.private_key)
  );
  const jwt = header + '.' + claims + '.' + firma;

  const resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }
  });
  const tokenData = JSON.parse(resp.getContentText());
  cache.put('fcm_access_token', tokenData.access_token, 3300); // ~55 min
  return tokenData.access_token;
}

/**
 * Cuerpo del mensaje FCM.
 *
 * SOLO data, sin "notification": si se manda notification, el navegador la
 * muestra por su cuenta Y el service worker la muestra otra vez, así que las
 * alertas llegaban DOBLE.
 */
/**
 * Cuerpo del mensaje FCM.
 *
 * SOLO data, sin "notification": si se manda notification, el navegador la
 * muestra por su cuenta Y el service worker la muestra otra vez, así que las
 * alertas llegaban DOBLE.
 *
 * Urgency y TTL son nuevos y son la diferencia entre avisar y estorbar:
 *   · Urgency "high" evita que Android, en ahorro de batería, guarde el aviso
 *     hasta que el celular despierte. Un "ya es tu hora de entrada" que llega
 *     dos horas tarde no sirve.
 *   · TTL 600 segundos: si en 10 minutos no se pudo entregar, que se tire.
 *     Por omisión FCM lo guarda CUATRO SEMANAS y lo entrega cuando sea.
 *
 * El campo data.envio es el folio de la bitácora: el service worker lo
 * devuelve al recibirlo y así se sabe si la alerta llegó de verdad.
 */
function _payloadFCM_(sa, token, titulo, cuerpo, urlAccion, idEnvio) {
  return JSON.stringify({
    message: {
      token: token,
      data: {
        title: titulo,
        body: cuerpo,
        url: urlAccion || '',
        envio: idEnvio || ''
      },
      webpush: {
        headers: { Urgency: 'high', TTL: '600' },
        fcm_options: { link: 'https://v-w04.github.io/ElectronicsChecador/' }
      }
    }
  });
}

/**
 * Manda una alerta y la anota en la bitácora.
 *
 * @param {Object} [meta] { idUsuario, nombre, alerta } para PUSH_LOG.
 * @return {boolean} si FCM la aceptó (aceptada NO es lo mismo que entregada:
 *   eso lo dice el acuse del celular, columna Entregada).
 */
function _enviarPushFCM(token, titulo, cuerpo, urlAccion, meta) {
  var saRaw = _firebaseSA_();
  if (!saRaw) {
    Logger.log('⚠️ Firebase sin configurar — push omitido. Ejecuta configurarFirebase()');
    return false;
  }
  var idEnvio = 'E' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd-HHmmss') +
                '-' + Math.floor(Math.random() * 1000);
  var codigo = 0, detalle = '';
  try {
    var sa = JSON.parse(saRaw);
    var url = 'https://fcm.googleapis.com/v1/projects/' + sa.project_id + '/messages:send';
    var resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + _obtenerAccessTokenFCM() },
      muteHttpExceptions: true,
      payload: _payloadFCM_(sa, token, titulo, cuerpo, urlAccion, idEnvio)
    });
    codigo = resp.getResponseCode();
    if (codigo < 200 || codigo >= 300) detalle = resp.getContentText().substring(0, 180);
    // Token muerto (app desinstalada) → limpiarlo para no reintentarlo a diario
    if (codigo === 404 || codigo === 410) eliminarPushToken(token);
  } catch (e) {
    detalle = e.message;
    Logger.log('❌ _enviarPushFCM: ' + e.message);
  }

  _logPush_(idEnvio, meta || {}, titulo, codigo, detalle, token);
  return codigo >= 200 && codigo < 300;
}

function _enviarPushFCMDetallado(token, titulo, cuerpo, urlAccion, meta) {
  var saRaw = _firebaseSA_();
  if (!saRaw) return { ok: false, code: 0, body: 'Firebase sin configurar' };
  var idEnvio = 'E' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd-HHmmss') +
                '-' + Math.floor(Math.random() * 1000);
  try {
    var sa = JSON.parse(saRaw);
    var url = 'https://fcm.googleapis.com/v1/projects/' + sa.project_id + '/messages:send';
    var resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + _obtenerAccessTokenFCM() },
      muteHttpExceptions: true,
      payload: _payloadFCM_(sa, token, titulo, cuerpo, urlAccion, idEnvio)
    });
    var code = resp.getResponseCode();
    var body = resp.getContentText().substring(0, 300);
    if (code === 404 || code === 410) eliminarPushToken(token);
    _logPush_(idEnvio, meta || { alerta: 'prueba' }, titulo, code,
              (code >= 200 && code < 300) ? '' : body.substring(0, 180), token);
    return { ok: code >= 200 && code < 300, code: code, body: body, envio: idEnvio };
  } catch (e) {
    _logPush_(idEnvio, meta || { alerta: 'prueba' }, titulo, 0, e.message, token);
    return { ok: false, code: 0, body: e.message, envio: idEnvio };
  }
}

// ── Bitácora de envíos ──────────────────────────────────────────────────────
//
// Sin esto no se puede contestar la única pregunta que importa: "¿le llegó?".
// El código de FCM solo dice que Google ACEPTÓ el mensaje; que haya aparecido
// en el celular lo confirma el service worker llamando confirmarEntregaPush.

var _PUSHLOG_HEADERS = ['ID Envío', 'Fecha', 'Hora', 'ID Usuario', 'Empleado',
                        'Alerta', 'Título', 'Código FCM', 'Detalle',
                        'Entregada', 'Hora entrega', 'Token'];

function crearHojaPushLog() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('PUSH_LOG');
  if (!sheet) {
    sheet = ss.insertSheet('PUSH_LOG');
    sheet.getRange(1, 1, 1, _PUSHLOG_HEADERS.length).setValues([_PUSHLOG_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _logPush_(idEnvio, meta, titulo, codigo, detalle, token) {
  try {
    var sheet = crearHojaPushLog();
    var ahora = new Date();
    sheet.appendRow([
      idEnvio,
      Utilities.formatDate(ahora, TIMEZONE, 'yyyy-MM-dd'),
      Utilities.formatDate(ahora, TIMEZONE, 'HH:mm:ss'),
      meta.idUsuario || '', meta.nombre || '', meta.alerta || '',
      titulo || '', codigo || '', detalle || '',
      '', '',
      (token || '').toString().substring(0, 24) + '…'
    ]);
  } catch (e) {
    // La bitácora nunca debe tumbar el envío.
    Logger.log('⚠️ _logPush_: ' + e.message);
  }
}

/**
 * Acuse de recibo. Lo llama el service worker del celular cuando la
 * notificación YA se mostró. Es la prueba de que llegó.
 */
function confirmarEntregaPush(idEnvio) {
  try {
    if (!idEnvio) return { ok: false, message: 'Falta el folio' };
    var sheet = crearHojaPushLog();
    var ultima = sheet.getLastRow();
    if (ultima < 2) return { ok: false, message: 'Bitácora vacía' };

    // Se busca hacia atrás y solo en lo reciente: el acuse llega en segundos,
    // y recorrer miles de filas por cada notificación no tiene sentido.
    var cuantas = Math.min(400, ultima - 1);
    var desde = ultima - cuantas + 1;
    var ids = sheet.getRange(desde, 1, cuantas, 1).getValues();
    for (var i = ids.length - 1; i >= 0; i--) {
      if ((ids[i][0] || '').toString() === idEnvio.toString()) {
        var fila = desde + i;
        sheet.getRange(fila, 10).setValue('SÍ');
        sheet.getRange(fila, 11).setValue(Utilities.formatDate(new Date(), TIMEZONE, 'HH:mm:ss'));
        return { ok: true };
      }
    }
    return { ok: false, message: 'Folio no encontrado' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

/** Cuántas alertas se mandaron hoy y cuántas confirmó el celular. */
function resumenEntregasHoy() {
  var sheet = crearHojaPushLog();
  var hoy = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  var res = { fecha: hoy, enviadas: 0, aceptadas: 0, entregadas: 0, porEmpleado: {} };
  if (sheet.getLastRow() < 2) return res;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues().forEach(function (r) {
    if ((r[1] || '').toString() !== hoy) return;
    res.enviadas++;
    var ok = Number(r[7]) >= 200 && Number(r[7]) < 300;
    if (ok) res.aceptadas++;
    var entregada = (r[9] || '').toString() === 'SÍ';
    if (entregada) res.entregadas++;
    var quien = (r[4] || '?').toString();
    if (!res.porEmpleado[quien]) res.porEmpleado[quien] = { enviadas: 0, entregadas: 0 };
    res.porEmpleado[quien].enviadas++;
    if (entregada) res.porEmpleado[quien].entregadas++;
  });
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

// ============================================================================
// PRUEBAS DESDE EL EDITOR
// ============================================================================
//
// Estas dos se corren con el botón ▶ del editor. No regresan nada a la
// pantalla: TODO lo que dicen sale en el "Registro de ejecución" de abajo.

/**
 * ¿Está bien puesta la llave de Firebase? Contesta con una sola línea.
 *
 * La llave se guarda en Configuración del proyecto → Propiedades de la
 * secuencia de comandos → FIREBASE_SERVICE_ACCOUNT = el JSON completo.
 * (configurarFirebase() hace lo mismo pero necesita abrirse desde el Sheet,
 * y este proyecto no tiene menú: por eso casi seguro nunca se corrió.)
 */
function verificarFirebase() {
  var raw = _firebaseSA_();
  if (!raw) {
    Logger.log('❌ NO HAY LLAVE DE FIREBASE. Sin ella no sale ni una alerta.');
    Logger.log('   Configuración del proyecto → Propiedades de la secuencia de comandos →');
    Logger.log('   Agregar: FIREBASE_SERVICE_ACCOUNT = el JSON completo de la cuenta de servicio.');
    return false;
  }
  var sa;
  try { sa = JSON.parse(raw); } catch (e) {
    Logger.log('❌ La llave guardada no es JSON válido: ' + e.message);
    Logger.log('   Pega el archivo completo, desde la primera { hasta la última }.');
    return false;
  }
  if (!sa.private_key || !sa.client_email || !sa.project_id) {
    Logger.log('❌ Al JSON le falta private_key, client_email o project_id.');
    return false;
  }
  Logger.log('Proyecto: ' + sa.project_id + '   Cuenta: ' + sa.client_email);

  // Se tira el token en caché para probar la llave de verdad, no uno viejo.
  CacheService.getScriptCache().remove('fcm_access_token');
  try {
    _obtenerAccessTokenFCM();
    Logger.log('✅ LLAVE VÁLIDA. Firebase acepta esta cuenta de servicio.');
    return true;
  } catch (e) {
    Logger.log('❌ GOOGLE RECHAZÓ LA LLAVE: ' + e.message);
    Logger.log('   Si dice invalid_grant, la llave fue revocada: genera una nueva en');
    Logger.log('   Firebase → Configuración → Cuentas de servicio y reemplázala.');
    return false;
  }
}

/**
 * Manda una notificación de prueba a TU celular (PIN 0055) y deja el
 * resultado en el registro. Luego abre la hoja PUSH_LOG: si la fila tiene
 * código 200 y Entregada = SÍ, el circuito completo funciona.
 */
function probarMiCelular() {
  if (!verificarFirebase()) return;
  var r = testPushEmpleado('0055');
  Logger.log(r.message || JSON.stringify(r));
  Logger.log('Ahora revisa la hoja PUSH_LOG: Código FCM 200 = Google lo aceptó;');
  Logger.log('Entregada = SÍ (en unos segundos) = tu celular lo mostró.');
}
