// ============================================================================
// AUSENCIAS — vacaciones / enfermedad / evento
// ============================================================================


var _AUSENCIA_TIPOS = {
  VACACIONES: { emoji: '🌴', label: 'Vacaciones' },
  ENFERMEDAD: { emoji: '🤒', label: 'Incapacidad' },
  EVENTO:     { emoji: '📅', label: 'Evento' }
};


// ============================================================================
// EXCEPCIONES DEL DÍA
// ============================================================================
// Un día marcado como excepción no genera alertas ni cuenta como falta.
// FESTIVO se guarda como global (PIN 'TODOS') y aplica a toda la empresa.

var _EXC_TIPOS = {
  VACACIONES:  { emoji: '🏖️', label: 'Vacaciones' },
  ENFERMEDAD:  { emoji: '🤒', label: 'Incapacidad' },
  EVENTO:      { emoji: '🎉', label: 'Evento' },
  FESTIVO:     { emoji: '📅', label: 'Día festivo' }
};

function crearHojaExcepciones() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('EXCEPCIONES_DIA');
  if (sheet) return sheet;
  sheet = ss.insertSheet('EXCEPCIONES_DIA');
  sheet.getRange(1, 1, 1, 6).setValues([['Fecha', 'PIN', 'ID Usuario', 'Nombre', 'Tipo', 'Registrado']])
    .setBackground('#3f51b5').setFontColor('#fff').setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

function _leerExcepciones() {
  const mapa = {};
  try {
    const sheet = crearHojaExcepciones();
    if (sheet.getLastRow() < 2) return mapa;
    _leerOrdenado_(sheet, 1, 2, ENC_EXCEPCIONES).forEach(function(r) {
      const f = (r[0] instanceof Date)
        ? Utilities.formatDate(r[0], TIMEZONE, 'yyyy-MM-dd')
        : (r[0] || '').toString().trim();
      const p = (r[1] || '').toString().trim().toUpperCase();
      const t = (r[4] || '').toString().trim().toUpperCase();
      if (f && p && t) mapa[f + '|' + (p === 'TODOS' ? 'TODOS' : _normId(p))] = t;
    });
  } catch (e) {}
  return mapa;
}

function _excepcionDe(mapa, fecha, pin) {
  return mapa[fecha + '|TODOS'] || mapa[fecha + '|' + _normId(pin)] || '';
}

function guardarExcepcionDia(pin, tipo) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    tipo = (tipo || '').toString().trim().toUpperCase();
    if (!_EXC_TIPOS[tipo]) return { ok: false, message: 'Tipo inválido' };

    const usuarios = getTodosLosUsuarios();
    let emp = null;
    (usuarios.usuarios || []).forEach(function(u) { if (_normId(u.pin) === _normId(pin)) emp = u; });
    if (!emp) return { ok: false, message: 'PIN no encontrado' };

    const hoy = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
    const clavePin = (tipo === 'FESTIVO') ? 'TODOS' : emp.pin.toString();
    const sheet = crearHojaExcepciones();
    const data = sheet.getDataRange().getValues();
    const ixE = _colsPorNombre_(sheet, 1, ENC_EXCEPCIONES).idx;

    for (let i = data.length - 1; i >= 1; i--) {
      const f = (data[i][ixE[0]] instanceof Date)
        ? Utilities.formatDate(data[i][ixE[0]], TIMEZONE, 'yyyy-MM-dd')
        : (data[i][ixE[0]] || '').toString().trim();
      const p = (data[i][ixE[1]] || '').toString().trim().toUpperCase();
      const mismaPersona = (clavePin === 'TODOS') ? (p === 'TODOS') : (_normId(p) === _normId(clavePin));
      if (f === hoy && mismaPersona) sheet.deleteRow(i + 1);
    }
    _agregarFila_(sheet, 1, ENC_EXCEPCIONES,
      [hoy, clavePin, emp.idUsuario, (tipo === 'FESTIVO' ? 'TODOS' : emp.nombre), tipo,
       Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm')]);
    return { ok: true, tipo: tipo,
             message: _EXC_TIPOS[tipo].emoji + ' ' + _EXC_TIPOS[tipo].label + ' registrado. Hoy no habrá alertas.' };
  } catch (e) {
    return { ok: false, message: e.message };
  } finally { lock.releaseLock(); }
}

function quitarExcepcionDia(pin) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const hoy = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
    const sheet = crearHojaExcepciones();
    const data = sheet.getDataRange().getValues();
    const ixE = _colsPorNombre_(sheet, 1, ENC_EXCEPCIONES).idx;
    let n = 0;
    for (let i = data.length - 1; i >= 1; i--) {
      const f = (data[i][ixE[0]] instanceof Date)
        ? Utilities.formatDate(data[i][ixE[0]], TIMEZONE, 'yyyy-MM-dd')
        : (data[i][ixE[0]] || '').toString().trim();
      const p = (data[i][ixE[1]] || '').toString().trim().toUpperCase();
      // OJO: el renglon 'TODOS' es el dia festivo de TODA la empresa. Antes
      // entraba en este if, asi que cualquiera que quitara SU excepcion
      // borraba el festivo de los 40 y les revolvia las alertas.
      if (f === hoy && _normId(p) === _normId(pin)) { sheet.deleteRow(i + 1); n++; }
    }
    return { ok: true, message: n ? 'Excepción quitada. Las alertas vuelven a estar activas.' : 'No había excepción hoy.' };
  } catch (e) {
    return { ok: false, message: e.message };
  } finally { lock.releaseLock(); }
}

function getExcepcionHoy(pin) {
  const hoy = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const mapa = _leerExcepciones();
  return { ok: true, tipo: _excepcionDe(mapa, hoy, pin), global: !!mapa[hoy + '|TODOS'] };
}
