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


// ============================================================================
// AVATARES
// ============================================================================
// Los overrides viven en las propiedades del PROYECTO de Apps Script, no en
// el sheet. Al cambiar de proyecto no se mueven solos.

var AVATAR_INDICE_PROP = 'AVATAR_IDS';

function getAvatarOverrides() {
  // Antes hacía props.getProperties(), que se trae TODAS las propiedades del
  // proyecto para quedarse con las que empiezan en 'avatar_'. En cada carga
  // del tablero eso arrastraba el JSON del service account de Firebase (~2.4
  // KB) y las ~240 llaves 'alerta_*' que se acumulan durante el día. Ahora se
  // lee una sola propiedad con el índice de quiénes tienen avatar propio.
  try {
    var props = PropertiesService.getScriptProperties();
    var idx = props.getProperty(AVATAR_INDICE_PROP);
    if (idx) {
      var ids = JSON.parse(idx), fuera = {};
      for (var i = 0; i < ids.length; i++) {
        var v = props.getProperty('avatar_' + ids[i]);
        if (v) fuera[ids[i]] = v;
      }
      return fuera;
    }
    // Sin índice todavía (primera vez): se arma con el barrido viejo y se
    // guarda, para no volver a barrer nunca.
    var todas = props.getProperties(), res = {}, lista = [];
    for (var k in todas) {
      if (k.indexOf('avatar_') !== 0) continue;
      var id = k.substring(7);
      res[id] = todas[k];
      lista.push(id);
    }
    props.setProperty(AVATAR_INDICE_PROP, JSON.stringify(lista));
    return res;
  } catch (e) {
    Logger.log('\u26a0\ufe0f getAvatarOverrides: ' + e.message);
    return {};
  }
}
