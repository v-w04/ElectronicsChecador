// ============================================================================
// CHECADAS
// ============================================================================

function crearHojaChecadorChoferes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('CHECADOR_CHOFERES');

  const headers = [
    'ID Usuario', 'Nombre', 'Fecha', 'Hora', 'Timestamp Completo',
    'Latitud', 'Longitud', 'Estado Zona', 'UUID Cliente', 'Tipo Checada'
  ];

  if (sheet) {
    const ultimaCol = sheet.getLastColumn();
    if (ultimaCol > 10) {
      sheet.deleteColumns(11, ultimaCol - 10);
      Logger.log('🧹 CHECADOR_CHOFERES recortada a 10 columnas');
    } else if (ultimaCol < 10) {
      Logger.log('⬆️ CHECADOR_CHOFERES migrando de ' + ultimaCol + ' a 10 columnas');
    }
    sheet.getRange(2, 1, 1, 10).setValues([headers]);
    sheet.getRange('C:E').setNumberFormat('@');
    sheet.getRange('I:J').setNumberFormat('@');
    return sheet;
  }

  sheet = ss.insertSheet('CHECADOR_CHOFERES');
  sheet.clear();

  sheet.getRange('A1:J1').merge();
  sheet.getRange('A1')
    .setValue('🚛 CHECADOR CHOFERES — Registro en Vivo')
    .setBackground('#1a237e').setFontColor('#ffffff')
    .setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 40);

  sheet.getRange(2, 1, 1, headers.length)
    .setValues([headers])
    .setBackground('#3f51b5').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(2, 35);
  sheet.setFrozenRows(2);

  [80, 220, 100, 90, 190, 110, 110, 130, 280, 160]
    .forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  sheet.getRange('C:E').setNumberFormat('@');
  sheet.getRange('I:J').setNumberFormat('@');

  Logger.log('✅ Hoja CHECADOR_CHOFERES creada (10 columnas)');
  return sheet;
}

function guardarChecadaChofer(datos) {
  // CANDADO. Sin esto, dos personas que checan en el mismo par de segundos
  // calculan la MISMA fila (lastRow se lee arriba y se usa 70 lineas abajo)
  // y la segunda le escribe encima a la primera. Pasa justo a la hora de
  // entrada, que es cuando todos checan al mismo tiempo, y la checada
  // perdida no deja rastro. Las otras seis funciones que escriben ya lo
  // tenian; esta, la de mas trafico, era la unica sin el.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); }
  catch (e) { return { ok: false, message: 'El sistema esta ocupado, intenta otra vez.' }; }

  try {
    if (!datos) return { ok: false, message: 'No se recibieron datos' };

    crearHojaChecadorChoferes();

    // ── HORA: del servidor si online, del cliente si offline ──────────────
    const esOffline = !!datos.esOffline;
    let fechaServidor, horaServidor, timestampServidor;

    if (esOffline && datos.clienteTimestamp) {
      const fechaCli = new Date(datos.clienteTimestamp);
      if (!isNaN(fechaCli.getTime())) {
        fechaServidor     = Utilities.formatDate(fechaCli, TIMEZONE, 'yyyy-MM-dd');
        horaServidor      = Utilities.formatDate(fechaCli, TIMEZONE, 'HH:mm:ss');
        timestampServidor = Utilities.formatDate(fechaCli, TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
      }
    }
    if (!fechaServidor) {
      const ahora = new Date();
      fechaServidor     = Utilities.formatDate(ahora, TIMEZONE, 'yyyy-MM-dd');
      horaServidor      = Utilities.formatDate(ahora, TIMEZONE, 'HH:mm:ss');
      timestampServidor = Utilities.formatDate(ahora, TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
    }

    // ── SIN VALIDACIÓN DE ZONA (decisión de Electronics) ──────────────────
    const latNum = parseFloat(datos.lat);
    const lngNum = parseFloat(datos.lng);
    const tieneCoords = !isNaN(latNum) && !isNaN(lngNum) && (latNum !== 0 || lngNum !== 0);
    const estadoZonaFinal = 'VÁLIDA';

    // ── DEDUPLICACIÓN POR UUID ────────────────────────────────────────────
    const ss      = SpreadsheetApp.getActiveSpreadsheet();
    const sheet   = ss.getSheetByName('CHECADOR_CHOFERES');
    const lastRow = sheet.getLastRow();
    const uuid = (datos.uuid || '').toString().trim();

    if (uuid && lastRow >= 3) {
      try {
        const uuidsExistentes = sheet.getRange(3, _colsPorNombre_(sheet, 2, ENC_CHECADAS).idx[8] + 1, lastRow - 2, 1).getValues();
        for (let i = 0; i < uuidsExistentes.length; i++) {
          if ((uuidsExistentes[i][0] || '').toString().trim() === uuid) {
            Logger.log('🔁 UUID ' + uuid + ' ya existe en fila ' + (i + 3) + ' — no se duplica');
            return { ok: true, message: 'Checada ya registrada previamente',
                     horaServidor: horaServidor, estadoZona: estadoZonaFinal, duplicado: true };
          }
        }
      } catch (e) { /* columna I aún no existe: seguir */ }
    }

    // ⭐ EL SHEET ES LA LEY: el tipo se deduce con lo que está registrado
    // hoy en CHECADOR_CHOFERES, nunca con el cache del dispositivo.
    const idBuscado = _normId(datos.idUsuario);
    const checadasPrevias = [];
    if (lastRow >= 3) {
      const prev = _leerOrdenado_(sheet, 2, 3, ENC_CHECADAS);
      prev.forEach(function(r) {
        if (_normId(r[0]) !== idBuscado) return;
        if ((r[2] || '').toString() !== fechaServidor) return;
        const t = (r[9] || '').toString().trim().toUpperCase();
        if (!t) return; // ignorar checadas legacy sin tipo
        const hm = (r[3] || '').toString().match(/(\d{1,2}):(\d{2})/);
        checadasPrevias.push({ tipo: t, min: hm ? parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10) : 0 });
      });
    }

    const cfgEmp = _cfgEmpleadoServ(idBuscado);
    const hmDet = horaServidor.match(/(\d{1,2}):(\d{2})/);
    const minDet = hmDet ? parseInt(hmDet[1], 10) * 60 + parseInt(hmDet[2], 10) : 0;

    let tipoChecada = (datos.tipo || '').toString().trim().toUpperCase();
    if (!tipoChecada || datos.autoDetect) {
      tipoChecada = _detectarTipoPorHora(checadasPrevias, cfgEmp, minDet);
    }

    const veredicto = _calcularVeredictoServ(tipoChecada, idBuscado, horaServidor, checadasPrevias, cfgEmp);

    // ⛔ SALIDA ANTES DE HORA → no se registra, solo aviso
    if (tipoChecada === 'SALIDA_TEMPRANA') {
      const t = _obtenerTurnoServ(idBuscado) || cfgEmp;
      const finM = (t && t.finMin != null) ? t.finMin : (cfgEmp && cfgEmp.finMin);
      return {
        ok: true, noRegistrada: true, tipo: tipoChecada,
        message: 'Aún no es tu hora de salida',
        horaServidor: horaServidor,
        veredicto: { texto: '⛔ Todavía no es tu salida', color: '#ef4444',
          detalle: 'Tu salida es a las ' + (finM != null ? _minAHora(finM) : '—') +
                   '. No puedes checar antes. Espera a tu hora.' },
        checadasHoyServidor: checadasPrevias.map(function(c) { return { fecha: fechaServidor, hora: '', tipo: c.tipo }; })
      };
    }

    // ⛔ FUERA DE HORARIO → no se registra nada
    if (tipoChecada === 'FUERA_HORARIO') {
      return {
        ok: true, noRegistrada: true,
        message: 'Fuera de horario — no se registró',
        horaServidor: horaServidor, tipo: tipoChecada, veredicto: veredicto,
        checadasHoyServidor: checadasPrevias.map(function(c) { return { fecha: fechaServidor, hora: '', tipo: c.tipo }; })
      };
    }

    // ⚠️ Si no es entrada y hoy no hay entrada registrada, decirlo claro
    if (tipoChecada !== 'ENTRADA' && !checadasPrevias.some(function(c) { return c.tipo === 'ENTRADA'; })) {
      veredicto.detalle = '⚠️ Sin entrada registrada hoy. ' + (veredicto.detalle || '');
    }

    // ── Escribir ──
    // Los valores van en el orden de siempre y _filaParaHoja_ los acomoda a
    // donde esten REALMENTE las columnas en la hoja. Si alguien movio una, la
    // checada cae igual en su lugar y no se recorre todo.
    const fila = lastRow + 1;
    const puesta = _filaParaHoja_(sheet, 2, ENC_CHECADAS, [
      datos.idUsuario || '', _nombreParaChecada_(datos, idBuscado),
      fechaServidor, horaServidor, timestampServidor,
      tieneCoords ? latNum : '', tieneCoords ? lngNum : '',
      estadoZonaFinal, uuid, tipoChecada
    ]);
    sheet.getRange(fila, 1, 1, puesta.ancho).setValues([puesta.fila]);

    // Texto en Fecha, Hora, Timestamp, UUID y Tipo: evita que Sheets
    // reinterprete las cadenas como fechas.
    const ixEsc = _colsPorNombre_(sheet, 2, ENC_CHECADAS).idx;
    [2, 3, 4, 8, 9].forEach(function (c) {
      sheet.getRange(fila, ixEsc[c] + 1).setNumberFormat('@');
    });

    Logger.log('✅ Checada' + (esOffline ? ' (OFFLINE)' : '') + ': ' + datos.nombre +
               ' · ' + horaServidor + ' · ' + tipoChecada +
               (uuid ? ' · uuid=' + uuid.substring(0, 8) : ''));

    // ⭐ Devolver las checadas de HOY según el SHEET, para que el frontend
    // se resincronice y cualquier desfase se auto-corrija.
    let checadasHoyServidor = [];
    try {
      const totalFilas = sheet.getLastRow();
      if (totalFilas >= 3) {
        const todas = _leerOrdenado_(sheet, 2, 3, ENC_CHECADAS);
        todas.forEach(function(row) {
          if (_normId(row[0]) !== idBuscado) return;
          if ((row[2] || '').toString() !== fechaServidor) return;
          checadasHoyServidor.push({
            fecha: (row[2] || '').toString(),
            hora:  (row[3] || '').toString(),
            tipo:  (row[9] || '').toString()
          });
        });
      }
    } catch (e) {}

    // El otro aparato de esta persona se enterará en <=15 s. Se devuelve el
    // sello para que ESTE aparato no se refresque a sí mismo por su propio
    // cambio: ya se pintó solo.
    var selloNuevo = _marcarCambio_(datos.pin || '');

    return { ok: true, message: 'Checada registrada', horaServidor: horaServidor,
             estadoZona: estadoZonaFinal, tipo: tipoChecada, veredicto: veredicto,
             checadasHoyServidor: checadasHoyServidor, sello: selloNuevo };

  } catch (e) {
    Logger.log('❌ Error guardarChecadaChofer: ' + e.message);
    return { ok: false, message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


// ── DETECCIÓN POR HORA + ESTADO ────────────────────────────────────────────
// La hora del día manda: checar a las 14:59 (ventana de comida) sin registros
// es SALIDA_COMIDA, no "entrada".
function _detectarTipoPorHora(checadasPrevias, cfg, minAhora) {
  function tiene(t) { return checadasPrevias.some(function(c) { return c.tipo === t; }); }
  const ult = checadasPrevias.length ? checadasPrevias[checadasPrevias.length - 1] : null;

  // 1. Regresos pendientes: prioridad absoluta
  if (ult && ult.tipo === 'SALIDA_DESAYUNO') return 'REGRESO_DESAYUNO';
  if (ult && ult.tipo === 'SALIDA_COMIDA')   return 'REGRESO_COMIDA';

  const c = cfg || {};
  function enVentana(a, b) { return a != null && b != null && minAhora >= a && minAhora <= b; }

  // ⛔ El ciclo NO se da la vuelta: la entrada solo desde 2 h antes del turno,
  // y después de la salida sin jornada en curso no se registra nada.
  const entradaDesde = (c.inicioMin != null) ? c.inicioMin - 120 : null;
  if (!tiene('ENTRADA')) {
    if (c.finMin != null && minAhora > c.finMin) return 'FUERA_HORARIO';
    if (entradaDesde != null && minAhora < entradaDesde) return 'FUERA_HORARIO';
  }

  if (!tiene('SALIDA_COMIDA') && enVentana(c.comMin, c.comMax)) return 'SALIDA_COMIDA';
  if (!tiene('ENTRADA') && (c.comMin == null || minAhora < c.comMin)) return 'ENTRADA';
  if (!tiene('SALIDA_DESAYUNO') && enVentana(c.desMin, c.desMax)) return 'SALIDA_DESAYUNO';
  if (!tiene('SALIDA') && c.finMin != null && minAhora >= c.finMin) return 'SALIDA';

  if (!tiene('SALIDA') && c.finMin != null && minAhora < c.finMin &&
      tiene('ENTRADA') && (c.comMax == null || tiene('REGRESO_COMIDA') || minAhora > c.comMax)) {
    return 'SALIDA_TEMPRANA';
  }

  // Fallback por estado (fuera de toda ventana)
  if (!tiene('ENTRADA'))          return 'ENTRADA';
  if (!tiene('SALIDA_DESAYUNO') && (c.desMax == null || minAhora <= c.desMax)) return 'SALIDA_DESAYUNO';
  if (!tiene('SALIDA_COMIDA')   && (c.comMax == null || minAhora <= c.comMax)) return 'SALIDA_COMIDA';
  if (!tiene('SALIDA'))           return 'SALIDA';
  return 'EXTRA';
}

// ============================================================================
// VEREDICTO SERVER-SIDE
// ============================================================================

function _obtenerTurnoServ(idUsuario) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TURNOS_DEFAULT');
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues();
    const ix = _ixTurnos_(data[0]);
    const iId = ix.id, iHor = ix.horario;
    if (iId === -1 || iHor === -1) return null;
    for (let i = 1; i < data.length; i++) {
      if (_normId(data[i][iId]) === _normId(idUsuario)) {
        const m = (data[i][iHor] || '').toString().match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
        if (m) return {
          inicioMin: parseInt(m[1], 10) * 60 + parseInt(m[2], 10),
          finMin:    parseInt(m[3], 10) * 60 + parseInt(m[4], 10)
        };
      }
    }
  } catch (e) {}
  return null;
}

function _calcularVeredictoServ(tipo, idUsuario, horaServidor, checadasPrevias, cfg) {
  cfg = cfg || _cfgEmpleadoServ(idUsuario) || {};
  const DUR_DES = cfg.desDur || 20;
  const DUR_COM = cfg.comDur || 60;
  const hm = horaServidor.match(/(\d{1,2}):(\d{2})/);
  const minAhora = hm ? parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10) : 0;
  const turno = (cfg.inicioMin != null && cfg.finMin != null)
    ? { inicioMin: cfg.inicioMin, finMin: cfg.finMin }
    : _obtenerTurnoServ(idUsuario);

  function fmtHora(total) {
    const h = Math.floor(total / 60) % 24, m = total % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function ultimaDe(t) {
    for (let i = checadasPrevias.length - 1; i >= 0; i--) {
      if (checadasPrevias[i].tipo === t) return checadasPrevias[i];
    }
    return null;
  }

  switch (tipo) {
    case 'ENTRADA': {
      if (!turno) return { texto: 'Entrada registrada', color: '#3ddc84', detalle: '' };
      const tol = cfg.tolerancia || 15;
      const limTol = turno.inicioMin + tol;
      const limRet = turno.inicioMin + 30;
      const ret = minAhora - turno.inicioMin;
      const hoyStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
      const q = _analisisEntradaQuincena(idUsuario, cfg, hoyStr);
      const nota = q.retardos > 0 ? ' Llevas ' + q.retardos + ' retardo(s) esta quincena.' : '';

      if (ret <= tol) {
        if (q.bonoPerdido) {
          return { texto: '✅ Entrada a tiempo', color: '#3ddc84',
                   detalle: 'El bono se perdió el ' + q.diaBonoPerdido + '.' + nota };
        }
        return { texto: '✅ Entrada a tiempo', color: '#3ddc84',
                 detalle: 'Apto para el bono de puntualidad.' + nota };
      }

      if (ret <= 30) {
        const extra = minAhora - limTol;
        const det = extra + ' min pasado el límite (' + fmtHora(limTol) + '). Aún no es retardo.' +
                    (q.bonoPerdido ? ' Bono perdido desde el ' + q.diaBonoPerdido + '.' : '');
        return { texto: '❌ Perdiste el bono', color: '#ef4444', detalle: det + nota };
      }

      const extraR = minAhora - limRet;
      const nRet = q.retardos + 1;
      const desc = _descuentoPorRetardos(nRet);
      let det = extraR + ' min pasado el límite (' + fmtHora(limRet) + ').';
      det += desc ? ' ⚡ Descuento: ' + desc + '.' : ' A ' + (3 - (nRet % 3)) + ' más: MEDIO DÍA.';
      return { texto: '❌ Retardo #' + nRet, color: '#ef4444', detalle: det };
    }
    case 'SALIDA_DESAYUNO':
      return { texto: '¡Provecho!', color: '#3ddc84',
               detalle: 'Tienes ' + DUR_DES + ' min · Regresa antes de las ' + fmtHora(minAhora + DUR_DES) };
    case 'REGRESO_DESAYUNO': {
      const sd = ultimaDe('SALIDA_DESAYUNO');
      if (!sd) return { texto: '🥐 Regreso de desayuno', color: '#3ddc84', detalle: '' };
      const dur = minAhora - sd.min;
      if (dur <= DUR_DES) return { texto: '✅ Regreso a tiempo', color: '#3ddc84',
                                   detalle: dur + ' de ' + DUR_DES + ' min.' };
      return { texto: '❌ Exceso de ' + (dur - DUR_DES) + ' min en desayuno', color: '#ef4444',
               detalle: dur + ' min de ' + DUR_DES + ' permitidos. El exceso se descuenta por hora completa.' };
    }
    case 'SALIDA_COMIDA':
      return { texto: '¡Provecho!', color: '#3ddc84',
               detalle: 'Tienes ' + DUR_COM + ' min · Regresa antes de las ' + fmtHora(minAhora + DUR_COM) };
    case 'REGRESO_COMIDA': {
      const sc = ultimaDe('SALIDA_COMIDA');
      if (!sc) return { texto: '🍽️ Regreso de comida', color: '#3ddc84', detalle: '' };
      const durC = minAhora - sc.min;
      if (durC <= DUR_COM) return { texto: '✅ Regreso a tiempo', color: '#3ddc84',
                                    detalle: durC + ' de ' + DUR_COM + ' min.' };
      return { texto: '❌ Exceso de ' + (durC - DUR_COM) + ' min en comida', color: '#ef4444',
               detalle: durC + ' min de ' + DUR_COM + ' permitidos. El exceso se descuenta por hora completa.' };
    }
    case 'SALIDA': {
      if (!turno) return { texto: '🏠 Salida registrada', color: '#3ddc84', detalle: '' };
      if (minAhora > turno.finMin) {
        const extra = minAhora - turno.finMin;
        return { texto: '⏱️ ' + extra + ' min de tiempo extra', color: '#fbbf24',
                 detalle: 'Tu salida era a las ' + fmtHora(turno.finMin) + '. Este tiempo no se paga.' };
      }
      if (minAhora < turno.finMin) {
        return { texto: '🏃 Saliste ' + (turno.finMin - minAhora) + ' min antes', color: '#fbbf24',
                 detalle: 'Tu salida es a las ' + fmtHora(turno.finMin) + '.' };
      }
      return { texto: '✅ Salida a tiempo', color: '#3ddc84', detalle: '' };
    }
    case 'FUERA_HORARIO': {
      if (turno && minAhora > turno.finMin) {
        return { texto: '⛔ Ya pasó tu hora de salida', color: '#ef4444',
                 detalle: 'Tu horario terminó a las ' + fmtHora(turno.finMin) + '. No hay nada que registrar a esta hora.' };
      }
      const desde = turno ? fmtHora(Math.max(0, turno.inicioMin - 120)) : '';
      return { texto: '🌙 Aún no es hora de checar', color: '#fbbf24',
               detalle: (turno ? 'Tu turno empieza a las ' + fmtHora(turno.inicioMin) + '. Puedes checar desde las ' + desde + '.' : 'Vuelve más cerca de tu horario.') };
    }
    default:
      return { texto: '➕ Registro extra', color: '#3ddc84', detalle: 'Checada adicional del día' };
  }
}

// ============================================================================
// SALIDA REMOTA — desde la notificación ("ando fuera de la oficina")
// ============================================================================


/* ===========================================================================
   EL NOMBRE DE LA COLUMNA B
   ===========================================================================
   La app siempre manda el nombre, pero una checada hecha DESDE la
   notificación la manda el service worker del celular, y ese no tiene el
   nombre a la mano — solo el pin. Antes eso dejaba la columna B vacía.
   Aquí se rellena buscando el pin en APP_EMPLEADOS.
   =========================================================================== */
function _nombreParaChecada_(datos, idBuscado) {
  var n = ((datos && datos.nombre) || '').toString().trim();
  if (n) return n;
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APP_EMPLEADOS_HOJA);
    if (!sh || sh.getLastRow() < 2) return '';
    var filas = _leerOrdenado_(sh, 1, 2, ENC_APP_EMPLEADOS);
    for (var i = 0; i < filas.length; i++) {
      if (_normId(filas[i][0]) === _normId(idBuscado)) return (filas[i][1] || '').toString();
    }
  } catch (e) {}
  return '';
}
