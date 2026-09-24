// ============================================================================
// USUARIOS
// ============================================================================

function getTodosLosUsuarios() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    crearHojaUsuarios();
    crearHojaContrasenas();

    const sheetUsuarios     = ss.getSheetByName('USUARIOS');
    const sheetContrasenas  = ss.getSheetByName('CONTRASENAS_CHOFERES');
    const sheetTurnos       = ss.getSheetByName('TURNOS_DEFAULT');

    // ── 1. Mapa PIN → contraseña ──────────────────────────────────────────
    const mapaContrasenas = {};
    if (sheetContrasenas && sheetContrasenas.getLastRow() >= 3) {
      const dataC = sheetContrasenas.getRange(3, 1, sheetContrasenas.getLastRow() - 2, 3).getValues();
      dataC.forEach(row => {
        const pin = (row[0] || '').toString().trim();
        const cont = (row[2] || '').toString().trim();
        if (pin && cont) mapaContrasenas[pin] = cont;
      });
    }

    // ── 2. Mapa ID → nombre + turno desde TURNOS_DEFAULT ─────────────────
    const mapaTurnos = {};
    if (sheetTurnos) {
      const dt = sheetTurnos.getDataRange().getValues();
      const hT = dt[0];
      const iId      = _colIdTurnos_(hT);
      const iNombre  = hT.indexOf('Empleado');
      const iHorario = hT.indexOf('TURNO'); // formato "10:00 - 19:00"
      const iTurnoN  = hT.indexOf('Turno'); // nombre del turno, ej. "T2"
      const cfgTurnos = _leerConfigTurnos();
      for (let i = 1; i < dt.length; i++) {
        const id      = _normId(dt[i][iId]);
        const nombre  = (dt[i][iNombre] || '').toString().trim();
        const horario = iHorario !== -1 ? (dt[i][iHorario] || '').toString().trim() : '';
        const turnoN  = iTurnoN  !== -1 ? (dt[i][iTurnoN]  || '').toString().trim() : '';
        if (id && nombre) mapaTurnos[id] = {
          nombre: nombre, horario: horario,
          cfgTurno: cfgTurnos[turnoN] || null
        };
      }
    }

    // ── 3. Leer USUARIOS y armar el listado final ────────────────────────
    const usuarios = [];
    if (sheetUsuarios && sheetUsuarios.getLastRow() >= 2) {
      const dataU = sheetUsuarios.getRange(2, 1, sheetUsuarios.getLastRow() - 1, 2).getValues();
      dataU.forEach(row => {
        const pin = (row[0] || '').toString().trim();
        const idUsuario = (row[1] || '').toString().trim();
        if (!pin || !idUsuario) return;

        if (idUsuario === 'ADMIN') {
          usuarios.push({
            pin: pin, idUsuario: 'ADMIN', nombre: 'ADMIN', tipo: 'ADMIN',
            contrasena: mapaContrasenas[pin] || ''
          });
          return;
        }

        const info = mapaTurnos[_normId(idUsuario)];
        const nombre = info ? info.nombre : '';
        if (!nombre) return; // PIN sin empleado en TURNOS_DEFAULT: se ignora

        usuarios.push({
          pin: pin,
          idUsuario: idUsuario,
          nombre: nombre,
          tipo: 'CHOFER',
          turnoHorario: info.horario || '',
          cfgTurno: info.cfgTurno || null,
          contrasena: mapaContrasenas[pin] || ''
        });
      });
    }

    Logger.log('✅ getTodosLosUsuarios: ' + usuarios.length + ' usuarios');
    return { ok: true, timestamp: new Date().toISOString(),
             total: usuarios.length, usuarios: usuarios };

  } catch(e) {
    Logger.log('❌ Error getTodosLosUsuarios: ' + e.message);
    return { ok: false, message: e.message, usuarios: [] };
  }
}

function getVersionUsuarios() {
  try {
    const props = PropertiesService.getDocumentProperties();
    let version = props.getProperty('USUARIOS_CACHE_VERSION');
    if (!version) {
      version = new Date().getTime().toString();
      props.setProperty('USUARIOS_CACHE_VERSION', version);
    }
    // ⭐ Huella de TURNOS_DEFAULT + CONFIG_TURNOS: si alguien edita horarios,
    // la versión cambia y TODOS los dispositivos resincronizan solos.
    let huella = '';
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const st = ss.getSheetByName('TURNOS_DEFAULT');
      const sc = ss.getSheetByName('CONFIG_TURNOS');
      let acc = 0;
      if (st && st.getLastRow() > 1) {
        st.getDataRange().getDisplayValues().forEach(function(r) {
          acc = (acc * 31 + r.join('|').length + r.join('|').split(':').length * 7) % 1000000007;
          r.forEach(function(c) { for (var i = 0; i < c.length; i++) acc = (acc * 33 + c.charCodeAt(i)) % 1000000007; });
        });
      }
      if (sc && sc.getLastRow() > 1) {
        sc.getDataRange().getDisplayValues().forEach(function(r) {
          r.forEach(function(c) { for (var i = 0; i < c.length; i++) acc = (acc * 33 + c.charCodeAt(i)) % 1000000007; });
        });
      }
      huella = '-' + acc;
    } catch(e) {}
    return { ok: true, version: version + huella };
  } catch(e) {
    Logger.log('❌ Error getVersionUsuarios: ' + e.message);
    return { ok: false, message: e.message, version: '0' };
  }
}

function forzarResyncUsuarios() {
  try {
    const props = PropertiesService.getDocumentProperties();
    const nuevaVersion = new Date().getTime().toString();
    props.setProperty('USUARIOS_CACHE_VERSION', nuevaVersion);

    SpreadsheetApp.getUi().alert(
      '🔄 Usuarios sincronizados',
      'Los PINs y contraseñas se actualizarán automáticamente en todos los ' +
      'dispositivos la próxima vez que los empleados abran la app.\n\n' +
      'Versión nueva: ' + nuevaVersion,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    Logger.log('🔄 USUARIOS_CACHE_VERSION actualizada a ' + nuevaVersion);
    return { ok: true, version: nuevaVersion };
  } catch(e) {
    Logger.log('❌ Error forzarResyncUsuarios: ' + e.message);
    return { ok: false, message: e.message };
  }
}

function crearHojaUsuarios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName('USUARIOS')) return;

  const sheet = ss.insertSheet('USUARIOS');
  sheet.clear();

  sheet.getRange('A1:B1').merge();
  sheet.getRange('A1')
    .setValue('🔐 USUARIOS — PINs de acceso')
    .setBackground('#1a237e').setFontColor('#ffffff')
    .setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 40);

  sheet.getRange('A2:B2')
    .setValues([['PIN', 'ID Usuario']])
    .setBackground('#3f51b5').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(2, 35);

  sheet.getRange('A3:B3').setValues([['5555', 'ADMIN']]).setBackground('#e8f5e9');

  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 120);
  sheet.setFrozenRows(2);

  Logger.log('✅ Hoja USUARIOS creada');
}

function crearHojaContrasenas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName('CONTRASENAS_CHOFERES')) return;

  const sheet = ss.insertSheet('CONTRASENAS_CHOFERES');
  sheet.clear();

  sheet.getRange('A1:C1').merge();
  sheet.getRange('A1')
    .setValue('🔑 CONTRASENAS CHOFERES')
    .setBackground('#1a237e').setFontColor('#ffffff')
    .setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 40);

  sheet.getRange('A2:C2')
    .setValues([['PIN', 'Nombre', 'Contraseña']])
    .setBackground('#3f51b5').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(2, 35);

  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 180);
  sheet.setFrozenRows(2);
  sheet.getRange('A:A').setNumberFormat('@');
  sheet.getRange('C:C').setNumberFormat('@');

  Logger.log('Hoja CONTRASENAS_CHOFERES creada');
}

function validarPin(pin) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    crearHojaUsuarios();
    const sheet   = ss.getSheetByName('USUARIOS');
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { ok: false, message: 'Sin usuarios configurados' };

    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();

    for (const row of data) {
      if (_normId(row[0]) === _normId(pin)) {
        const idUsuario = row[1].toString().trim();
        if (idUsuario === 'ADMIN') return { ok: true, tipo: 'ADMIN' };

        const turnos = ss.getSheetByName('TURNOS_DEFAULT');
        if (!turnos) return { ok: false, message: 'TURNOS_DEFAULT no encontrada' };

        const dt = turnos.getDataRange().getValues();
        const hT = dt[0];
        const iId     = _colIdTurnos_(hT);
        const iNombre = hT.indexOf('Empleado');

        for (let i = 1; i < dt.length; i++) {
          if (_normId(dt[i][iId]) === _normId(idUsuario)) {
            const nombre = dt[i][iNombre].toString().trim();
            const tieneContrasena = verificarTieneContrasena(pin);
            return { ok: true, tipo: 'CHOFER', idUsuario, nombre, tieneContrasena };
          }
        }
        return { ok: false, message: 'ID no encontrado' };
      }
    }
    return { ok: false, message: 'PIN incorrecto' };
  } catch(e) {
    return { ok: false, message: e.message };
  }
}

function validarContrasena(pin, contrasena) {
  try {
    crearHojaContrasenas();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CONTRASENAS_CHOFERES');
    const lastRow = sheet.getLastRow();
    if (lastRow < 3) return { ok: false, message: 'Sin contrasenas registradas' };

    const data = sheet.getRange(3, 1, lastRow - 2, 3).getValues();
    for (const row of data) {
      if (_normId(row[0]) === _normId(pin)) {
        if (row[2].toString().trim() === contrasena.toString().trim()) return { ok: true };
        return { ok: false, message: 'Contraseña incorrecta' };
      }
    }
    return { ok: false, message: 'PIN no encontrado en contraseñas' };
  } catch(e) {
    return { ok: false, message: e.message };
  }
}

function guardarContrasena(pin, nombre, contrasena) {
  try {
    crearHojaContrasenas();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CONTRASENAS_CHOFERES');

    if (verificarTieneContrasena(pin)) {
      return { ok: false, message: 'Este PIN ya tiene contraseña registrada' };
    }

    const fila = sheet.getLastRow() + 1;
    // Forzar A y C como texto ANTES de escribir: sin esto Sheets se come
    // los ceros de la izquierda del PIN y de la contraseña.
    sheet.getRange(fila, 1).setNumberFormat('@');
    sheet.getRange(fila, 3).setNumberFormat('@');
    sheet.getRange(fila, 1, 1, 3).setValues([[
      pin.toString().trim(), nombre.toString().trim(), contrasena.toString().trim()
    ]]);
    Logger.log('Contrasena guardada para: ' + nombre + ' PIN: ' + pin);
    return { ok: true };
  } catch(e) {
    return { ok: false, message: e.message };
  }
}

function verificarTieneContrasena(pin) {
  try {
    crearHojaContrasenas();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('CONTRASENAS_CHOFERES');
    const lastRow = sheet.getLastRow();
    if (lastRow < 3) return false;

    const data = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
    return data.some(row => _normId(row[0]) === _normId(pin));
  } catch(e) {
    return false;
  }
}

// ============================================================================
// AVATARES
// ============================================================================
// Los overrides viven en las propiedades del PROYECTO de Apps Script, no en
// el sheet. Al cambiar de proyecto no se mueven solos.

function getAvatarOverrides() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var result = {};
  for (var key in all) {
    if (key.indexOf('avatar_') === 0) {
      var nombre = key.replace('avatar_', '');
      try { result[nombre] = JSON.parse(all[key]); } catch(e) {}
    }
  }
  return result;
}

// Migración desde un proyecto viejo:
//   1) en el proyecto VIEJO ejecuta exportarAvatarOverridesParaMigracion
//   2) pega el JSON aquí abajo
//   3) ejecuta importarAvatarOverrides una vez
var AVATAR_MIGRACION_JSON = '';

function exportarAvatarOverridesParaMigracion() {
  Logger.log(JSON.stringify(getAvatarOverrides()));
  return { ok: true };
}

function importarAvatarOverrides() {
  if (!AVATAR_MIGRACION_JSON || !AVATAR_MIGRACION_JSON.trim()) {
    Logger.log('❌ Pega primero el JSON en AVATAR_MIGRACION_JSON');
    return { ok: false, message: 'AVATAR_MIGRACION_JSON vacío' };
  }
  var data = JSON.parse(AVATAR_MIGRACION_JSON);
  var props = PropertiesService.getScriptProperties();
  var n = 0;
  for (var nombre in data) {
    props.setProperty('avatar_' + nombre, JSON.stringify(data[nombre]));
    n++;
  }
  Logger.log('✅ ' + n + ' avatares importados');
  return { ok: true, importados: n };
}
