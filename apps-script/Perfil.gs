// ============================================================================
// PERFIL DEL EMPLEADO
// ============================================================================

function getPerfilEmpleado(pin) {
  try {
    if (!pin) return { ok: false, message: 'PIN requerido' };
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const usuarios = getTodosLosUsuarios();
    if (!usuarios.ok) return { ok: false, message: 'No se pudieron leer usuarios' };
    let empleado = null;
    for (let i = 0; i < usuarios.usuarios.length; i++) {
      if (_normId(usuarios.usuarios[i].pin) === _normId(pin)) { empleado = usuarios.usuarios[i]; break; }
    }
    if (!empleado) return { ok: false, message: 'PIN no encontrado' };

    const hoy = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
    const hace7 = new Date(); hace7.setDate(hace7.getDate() - 7);

    const sheet = ss.getSheetByName('CHECADOR_CHOFERES');
    const checadasHoy = [];
    const historial = {};

    if (sheet && sheet.getLastRow() >= 3) {
      const data = sheet.getRange(3, 1, sheet.getLastRow() - 2, 10).getValues();
      const idEmpleado = (empleado.idUsuario || '').toString();

      data.forEach(function(row) {
        if (_normId(row[0]) !== _normId(idEmpleado)) return;
        const fecha = (row[2] || '').toString();
        const fechaObj = new Date(fecha + 'T00:00:00');
        if (isNaN(fechaObj.getTime()) || fechaObj < hace7) return;

        const checada = { fecha: fecha, hora: (row[3] || '').toString(), tipo: (row[9] || '').toString() };
        if (fecha === hoy) checadasHoy.push(checada);
        if (!historial[fecha]) historial[fecha] = [];
        historial[fecha].push(checada);
      });
    }

    return {
      ok: true,
      empleado: { pin: empleado.pin, idUsuario: empleado.idUsuario,
                  nombre: empleado.nombre, turnoHorario: empleado.turnoHorario || '' },
      hoy: hoy, checadasHoy: checadasHoy, historial: historial
    };
  } catch (e) {
    Logger.log('❌ getPerfilEmpleado: ' + e.message);
    return { ok: false, message: e.message };
  }
}

// ============================================================================
// BONO Y RETARDOS DE LA QUINCENA
// ============================================================================
// Escala oficial (minutos de retraso vs hora de entrada del turno):
//   0                  → puntual
//   1..tolerancia (15) → dentro de tolerancia, bono a salvo
//   16..30             → PERDIÓ EL BONO (sin retardo)
//   31 o más           → RETARDO (el bono ya estaba perdido)
// Descuentos acumulados en la MISMA quincena:
//   3 retardos = medio día · 6 = un día · 9 = día y medio

function _rangoQuincena(fecha) {
  const d = fecha.getDate();
  const y = fecha.getFullYear(), m = fecha.getMonth();
  if (d <= 15) return { ini: new Date(y, m, 1), fin: new Date(y, m, 15) };
  return { ini: new Date(y, m, 16), fin: new Date(y, m + 1, 0) };
}

function _descuentoPorRetardos(n) {
  if (n < 3) return '';
  const dias = Math.floor(n / 3) * 0.5;
  if (dias === 0.5) return 'MEDIO DÍA';
  if (dias === 1)   return 'UN DÍA';
  if (dias === 1.5) return 'DÍA Y MEDIO';
  return dias + ' DÍAS';
}

function _analisisEntradaQuincena(idUsuario, cfg, fechaHoyStr) {
  const res = { retardos: 0, bonoPerdido: false, diaBonoPerdido: '' };
  try {
    if (!cfg || cfg.inicioMin == null) return res;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CHECADOR_CHOFERES');
    if (!sheet || sheet.getLastRow() < 3) return res;
    const r = _rangoQuincena(new Date());
    const iniStr = Utilities.formatDate(r.ini, TIMEZONE, 'yyyy-MM-dd');
    const finStr = Utilities.formatDate(r.fin, TIMEZONE, 'yyyy-MM-dd');
    const tol = cfg.tolerancia || 15;
    const idN = _normId(idUsuario);

    sheet.getRange(3, 1, sheet.getLastRow() - 2, 10).getValues().forEach(function(row) {
      if (_normId(row[0]) !== idN) return;
      if ((row[9] || '').toString().trim().toUpperCase() !== 'ENTRADA') return;
      const f = (row[2] || '').toString();
      if (f < iniStr || f > finStr) return;
      if (f === fechaHoyStr) return; // hoy se evalúa aparte
      const hm = (row[3] || '').toString().match(/(\d{1,2}):(\d{2})/);
      if (!hm) return;
      const min = parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
      const ret = min - cfg.inicioMin;
      if (ret > tol) {
        if (!res.bonoPerdido) { res.bonoPerdido = true; res.diaBonoPerdido = f.substring(8, 10) + '/' + f.substring(5, 7); }
        if (ret > 30) res.retardos++;
      }
    });
  } catch (e) { Logger.log('⚠️ _analisisEntradaQuincena: ' + e.message); }
  return res;
}

// ============================================================================
// HISTORIAL POR QUINCENA
// ============================================================================
// offset 0 = quincena en curso, -1 = la anterior, etc.
// Los días 16-fin se ajustan solos al mes (28, 29, 30 o 31).
// Sábados y domingos NO cuentan como falta.
//
// NOTA: esta función y _quincenaPorOffset estaban DUPLICADAS en el archivo
// anterior. En Apps Script gana la última definición, así que la primera era
// código muerto. Se conservó esta, que es la que de verdad corría.

function _quincenaPorOffset(offset) {
  const hoy = new Date();
  let y = hoy.getFullYear(), m = hoy.getMonth();
  let seg = hoy.getDate() > 15; // true = segunda quincena
  let n = -(offset || 0);
  while (n > 0) { if (seg) seg = false; else { seg = true; m--; if (m < 0) { m = 11; y--; } } n--; }
  const ini = seg ? new Date(y, m, 16) : new Date(y, m, 1);
  const fin = seg ? new Date(y, m + 1, 0) : new Date(y, m, 15); // día 0 del mes siguiente = último día
  return { ini: ini, fin: fin };
}

function getHistorialQuincena(pin, offset) {
  try {
    const usuarios = getTodosLosUsuarios();
    let emp = null;
    (usuarios.usuarios || []).forEach(function(u) { if (_normId(u.pin) === _normId(pin)) emp = u; });
    if (!emp) return { ok: false, message: 'PIN no encontrado' };

    const q = _quincenaPorOffset(offset || 0);
    const iniStr = Utilities.formatDate(q.ini, TIMEZONE, 'yyyy-MM-dd');
    const finStr = Utilities.formatDate(q.fin, TIMEZONE, 'yyyy-MM-dd');
    const hoyStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
    const cfg = _cfgEmpleadoServ(emp.idUsuario) || {};
    const tol = cfg.tolerancia || 15;
    const excs = _leerExcepciones();

    const porDia = {};
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CHECADOR_CHOFERES');
    if (sheet && sheet.getLastRow() >= 3) {
      const idN = _normId(emp.idUsuario);
      sheet.getRange(3, 1, sheet.getLastRow() - 2, 10).getValues().forEach(function(r) {
        if (_normId(r[0]) !== idN) return;
        const f = (r[2] || '').toString();
        if (f < iniStr || f > finStr) return;
        if (!porDia[f]) porDia[f] = [];
        porDia[f].push({ tipo: (r[9] || '').toString().toUpperCase(), hora: (r[3] || '').toString() });
      });
    }

    const dias = [];
    const resumen = { retardos: 0, faltas: 0, bonoPerdido: false, diaBonoPerdido: '' };
    for (let d = new Date(q.fin); d >= q.ini; d.setDate(d.getDate() - 1)) {
      const f = Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
      if (f > hoyStr) continue;
      const finde = (d.getDay() === 0 || d.getDay() === 6);
      const exc = _excepcionDe(excs, f, emp.pin);
      const items = (porDia[f] || []).sort(function(a, b) { return a.hora < b.hora ? -1 : 1; });

      let minTarde = null, retardo = false, perdioBono = false;
      const ent = items.filter(function(c) { return c.tipo === 'ENTRADA'; })[0];
      if (ent && cfg.inicioMin != null) {
        const hm = ent.hora.match(/(\d{1,2}):(\d{2})/);
        if (hm) {
          const min = parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
          minTarde = min - cfg.inicioMin;
          if (minTarde > tol) {
            perdioBono = true;
            if (!resumen.bonoPerdido) { resumen.bonoPerdido = true; resumen.diaBonoPerdido = f; }
          }
          if (minTarde > 30) { retardo = true; resumen.retardos++; }
        }
      }
      const falta = !finde && !exc && items.length === 0;
      if (falta) resumen.faltas++;

      dias.push({ fecha: f, finde: finde, excepcion: exc, checadas: items,
                  retardo: retardo, perdioBono: perdioBono, falta: falta, minTarde: minTarde });
    }

    resumen.descuento = _descuentoPorRetardos(resumen.retardos);
    return { ok: true, inicio: iniStr, fin: finStr, offset: offset || 0,
             esActual: (offset || 0) === 0, dias: dias, resumen: resumen };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

// ============================================================================
// DISPOSITIVOS VINCULADOS
// ============================================================================

function _contarDispositivos(pin) {
  try {
    const sheet = crearHojaPushTokens();
    const data = sheet.getDataRange().getValues();
    let n = 0;
    for (let i = 1; i < data.length; i++) {
      if (_normId(data[i][0]) === _normId(pin) && (data[i][3] || '')) n++;
    }
    return n;
  } catch (e) { return 0; }
}

function getMisDispositivos(pin, tokenActual) {
  try {
    const sheet = crearHojaPushTokens();
    const data = sheet.getDataRange().getValues();
    const lista = [];
    for (let i = 1; i < data.length; i++) {
      if (_normId(data[i][0]) !== _normId(pin)) continue;
      const tk = (data[i][3] || '').toString();
      if (!tk) continue;
      lista.push({
        token: tk,
        dispositivo: (data[i][4] || 'Dispositivo').toString(),
        registrado: (data[i][5] || '').toString(),
        esActual: !!(tokenActual && tk === tokenActual)
      });
    }
    return { ok: true, dispositivos: lista };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

function desvincularDispositivo(pin, token) {
  try {
    const sheet = crearHojaPushTokens();
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (_normId(data[i][0]) === _normId(pin) && (data[i][3] || '').toString() === token) {
        sheet.deleteRow(i + 1);
        return { ok: true, message: 'Dispositivo desvinculado' };
      }
    }
    return { ok: false, message: 'No se encontró ese dispositivo' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}
