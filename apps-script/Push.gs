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
    // Un aparato, un token: fuera los registros viejos de este mismo celular.
    _dejarUnoPorAparato_(sheet, emp.pin, disp, token);
    const total = _contarDispositivos(emp.pin);
    Logger.log('🔔 Dispositivo vinculado: ' + emp.nombre + ' · ' + disp + ' (total: ' + total + ')');
    return { ok: true, message: 'Dispositivo vinculado (' + total + ' en total)' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

/* ===========================================================================
   PODA DE DISPOSITIVOS — que la lista no mienta
   ===========================================================================
   Un "token muerto" es una fila que apunta a un teléfono que ya no existe:
   alguien borró la app, la reinstaló o limpió los datos. FCM contesta 200
   porque el token sigue en SU registro, pero no hay a dónde entregar. Se
   acumulan y el sistema miente: el 23-sep dijo "enviada a 4 de 4" y no
   llegó nada a ninguno.

   FCM acaba marcándolos 404/410 y ahí sí se borran solos (abajo, en el
   envío), pero tarda. Estas dos reglas los quitan antes, y las dos son
   seguras — ninguna puede borrar un teléfono vivo:

     1. UN APARATO, UN TOKEN. Al registrarse, se borran las otras filas de
        la MISMA persona con el MISMO aparato. Un iPhone de Víctor no tiene
        por qué aparecer tres veces.

     2. SIN APARECER EN MUCHO TIEMPO. "Último uso" se actualiza cada vez que
        la app se abre. Si un aparato lleva PUSH_DIAS_INACTIVO días sin dar
        señales, ya no lo usa nadie.

   OJO: NO se puede podar contando envíos sin acuse. Desde que el aviso lo
   pinta el sistema operativo, "Entregada" se marca cuando la persona TOCA
   la notificación, no cuando aparece. Un teléfono vivo cuyo dueño no las
   toca acumularía envíos sin acuse y se borraría estando bien.
   =========================================================================== */

var PUSH_DIAS_INACTIVO = 45;

/** Deja un solo token por persona+aparato: borra los otros. */
function _dejarUnoPorAparato_(sheet, pin, dispositivo, tokenBueno) {
  try {
    var data = sheet.getDataRange().getValues();
    var d = (dispositivo || '').toString().trim().toLowerCase();
    if (!d) return 0;
    var borradas = 0;
    for (var i = data.length - 1; i >= 1; i--) {
      var mismoPin = _normId(data[i][0]) === _normId(pin);
      var mismoAp  = (data[i][4] || '').toString().trim().toLowerCase() === d;
      var otroTk   = (data[i][3] || '').toString() !== tokenBueno;
      if (mismoPin && mismoAp && otroTk) { sheet.deleteRow(i + 1); borradas++; }
    }
    if (borradas) Logger.log('🧹 ' + borradas + ' token(s) viejo(s) del mismo aparato');
    return borradas;
  } catch (e) {
    Logger.log('⚠️ _dejarUnoPorAparato_: ' + e.message);
    return 0;
  }
}

/**
 * Quita los aparatos que llevan mucho sin abrir la app.
 * Se puede correr desde el menú y se corre solo una vez al día.
 */
function podarTokens() {
  try {
    var sheet = crearHojaPushTokens();
    var data = sheet.getDataRange().getValues();
    var limite = new Date().getTime() - PUSH_DIAS_INACTIVO * 24 * 60 * 60 * 1000;
    var borradas = 0, nombres = [];

    for (var i = data.length - 1; i >= 1; i--) {
      var ult = data[i][6];
      var t = null;
      if (ult instanceof Date) t = ult.getTime();
      else {
        // Formato dd/MM/yyyy HH:mm
        var m = (ult || '').toString().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (m) t = new Date(+m[3], +m[2] - 1, +m[1]).getTime();
      }
      // Si no se entiende la fecha, NO se borra: más vale un token de sobra
      // que quitarle las alertas a alguien por un formato raro.
      if (t === null) continue;
      if (t < limite) {
        nombres.push((data[i][2] || '?') + ' · ' + (data[i][4] || '?'));
        sheet.deleteRow(i + 1);
        borradas++;
      }
    }
    return { ok: true, borradas: borradas, detalle: nombres,
             message: borradas ? ('Se quitaron ' + borradas + ' aparato(s) sin usar en ' +
                                  PUSH_DIAS_INACTIVO + ' días:\n\n' + nombres.join('\n'))
                               : 'Todos los aparatos registrados siguen activos.' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

/** La poda diaria, sin trigger propio: la llama el motor de alertas. */
function _podaDiaria_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var hoy = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
    if (props.getProperty('PUSH_PODA_DIA') === hoy) return;
    props.setProperty('PUSH_PODA_DIA', hoy);
    var r = podarTokens();
    if (r.borradas) Logger.log('🧹 Poda diaria: ' + r.borradas + ' aparato(s)');
  } catch (e) {
    Logger.log('⚠️ _podaDiaria_: ' + e.message);
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
 * Aquí vivía, dos veces pegado, un comentario que decía "SOLO data, sin
 * notification". Ya no es cierto: desde v730 el mensaje SÍ lleva el bloque
 * notification, porque iOS no pinta los mensajes de solo datos (la
 * explicación larga está junto al bloque, más abajo). El aviso doble que
 * aquel comentario describía se resolvió por el otro lado: el service
 * worker ya no pinta nada, solo acusa recibo.
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
/* ---------------------------------------------------------------------------
   EL AVISO TIENE QUE DECIR QUE ES UN BOTÓN
   ---------------------------------------------------------------------------
   Si tocar el aviso registra una checada, el aviso lo tiene que decir. Si no,
   alguien lo toca para quitarlo de la pantalla y sin querer deja su salida
   puesta. Se arma aquí, en un solo lugar, leyendo la acción de la dirección:
   ninguna alerta tiene que acordarse de escribirlo.
   --------------------------------------------------------------------------- */
var _PIE_ACCION_ = {
  ENTRADA:          '👉 Toca este aviso para registrar tu entrada.',
  SALIDA:           '👉 Toca este aviso para registrar tu salida.',
  SALIDA_DESAYUNO:  '👉 Toca este aviso para marcar tu salida a desayunar.',
  REGRESO_DESAYUNO: '👉 Toca este aviso para cerrar tu desayuno.',
  SALIDA_COMIDA:    '👉 Toca este aviso para marcar tu salida a comer.',
  REGRESO_COMIDA:   '👉 Toca este aviso para cerrar tu comida.',
  DECIDIR:          '👉 Toca este aviso para contestar.'
};

function _conPieDeAccion_(cuerpo, urlAccion) {
  var m = (urlAccion || '').match(/[?&]accion=([^&]+)/);
  if (!m) return cuerpo;
  var pie = _PIE_ACCION_[decodeURIComponent(m[1]).toUpperCase()];
  return pie ? (cuerpo + '\n\n' + pie) : cuerpo;
}

function _payloadFCM_(sa, token, titulo, cuerpo, urlAccion, idEnvio) {
  var destino = urlAccion || 'https://v-w04.github.io/ElectronicsChecador/checar.html';
  cuerpo = _conPieDeAccion_(cuerpo, urlAccion);
  return JSON.stringify({
    message: {
      token: token,

      // Los datos siguen viajando: el service worker los usa para el acuse
      // y para saber a dónde llevar al empleado si toca el aviso.
      data: {
        title: titulo,
        body: cuerpo,
        url: urlAccion || '',
        envio: idEnvio || ''
      },

      // ---------------------------------------------------------------
      // EL BLOQUE notification ES LA PIEZA QUE FALTABA EN iPHONE
      // ---------------------------------------------------------------
      // Antes solo se mandaba data. Un mensaje de solo datos NO se pinta
      // solo: obliga al service worker del celular a despertar, cargar dos
      // librerias de gstatic y dibujar el aviso a mano. Android aguanta esa
      // cadena; iOS le da una ventana de tiempo mucho mas corta y si no
      // alcanza, el aviso simplemente no aparece. Firebase contesta 200 y en
      // el telefono no pasa nada — exactamente el sintoma del 23-sep, con
      // Android acusando recibo y iPhone en silencio con el mismo token.
      //
      // Con notification, el propio sistema operativo pinta el aviso sin
      // depender de que corra nada nuestro. Es el camino corto y el unico
      // que iOS garantiza.
      notification: {
        title: titulo,
        body: cuerpo
      },

      webpush: {
        headers: { Urgency: 'high', TTL: '600' },
        // Aqui van los detalles que solo entiende la web. Este bloque manda
        // sobre el notification de arriba cuando el destino es un navegador.
        notification: {
          title: titulo,
          body: cuerpo,
          icon: 'https://v-w04.github.io/ElectronicsChecador/icon-192.png',
          badge: 'https://v-w04.github.io/ElectronicsChecador/icon-192.png',
          // CADA AVISO CON SU PROPIA ETIQUETA.
          //
          // Antes todos llevaban 'checador-alerta'. Con la etiqueta repetida
          // el celular NO pinta un aviso nuevo: reemplaza el anterior en
          // silencio. Y peor: iOS lleva la cuenta de los mensajes que NO
          // acaban en un aviso visible, y cuando se le acaba la paciencia
          // empieza a tirarlos. Por eso el 23-sep el recordatorio de salida
          // de las 16:06 se mostró (acuse SÍ) y los de 16:11, 16:16 y 16:17
          // ya no: mismo mensaje, misma etiqueta, tirados en silencio.
          //
          // Con el folio del envío cada recordatorio es un aviso distinto:
          // suena, se apila, y se ve cuántos lleva uno ignorando — que es
          // exactamente lo que debe hacer un recordatorio de "ya vete".
          tag: 'checador-' + (idEnvio || 'alerta'),
          renotify: true,
          requireInteraction: true,
          vibrate: [400, 150, 400, 150, 400],
          data: { url: urlAccion || '', envio: idEnvio || '' }
        },
        fcm_options: { link: destino }
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
// CHEQUEO DE LA LLAVE (lo usa el menú Checador)
// ============================================================================

/** Revisa la llave de Firebase y contesta en una línea. */
function chequeoFirebase_() {
  var raw = _firebaseSA_();
  if (!raw) return { ok: false, msg: 'No hay llave de Firebase. Sin ella no sale ninguna alerta.' };
  var sa;
  try { sa = JSON.parse(raw); } catch (e) {
    return { ok: false, msg: 'La llave guardada no es JSON válido.' };
  }
  if (!sa.private_key || !sa.client_email || !sa.project_id) {
    return { ok: false, msg: 'A la llave le falta private_key, client_email o project_id.' };
  }
  CacheService.getScriptCache().remove('fcm_access_token');
  try {
    _obtenerAccessTokenFCM();
    return { ok: true, msg: 'Llave válida · ' + sa.project_id };
  } catch (e) {
    return { ok: false, msg: 'Google rechazó la llave (revocada o vencida). Genera otra en Firebase.' };
  }
}
