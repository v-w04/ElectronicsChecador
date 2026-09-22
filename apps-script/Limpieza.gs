/**
 * ============================================================================
 *  Limpieza.gs — DEJAR EL SHEET SOLO CON LO QUE SE USA
 * ============================================================================
 *  El libro arrastra hojas de versiones viejas del checador que ya nadie lee.
 *  Esto las quita de en medio.
 *
 *  IMPORTANTE: limpiar NO borra. Las hojas se renombran con "ZZ " adelante y
 *  se esconden. Siguen ahí, con todos sus datos, y se pueden regresar con una
 *  opción del menú. Borrar de verdad es un paso aparte que hay que confirmar
 *  escribiendo BORRAR.
 *
 *  Se hace así porque una hoja que parece muerta puede estar alimentando una
 *  fórmula en otro lado, y eso solo se descubre cuando algo se rompe. Si
 *  después de unos días nada falla, entonces ya se borran.
 * ============================================================================
 */

var LIMPIEZA_PREFIJO = 'ZZ ';

/**
 * Las hojas que el código SÍ usa. Salen de buscar getSheetByName e
 * insertSheet en todo el proyecto. Cualquier hoja que no esté aquí es
 * candidata a archivarse.
 *
 * Si algún día se agrega una hoja nueva al código, va también en esta lista.
 */
var LIMPIEZA_EN_USO = [
  // El corazón del checador
  'CHECADOR_CHOFERES',   // todas las checadas
  'USUARIOS',            // PIN → empleado
  'CONTRASENAS_CHOFERES',
  'TURNOS_DEFAULT',      // empleado, turno y horario
  'CONFIG_TURNOS',       // definición de cada turno

  // Quién aparece en la app
  'APP_EMPLEADOS',

  // Alertas
  'CONFIG_ALERTAS',
  'PREFS_ALERTAS',
  'PUSH_TOKENS',
  'PUSH_LOG',

  // Ausencias y días marcados
  'AUSENCIAS',
  'EXCEPCIONES_DIA',

  // Tablero de juegos
  'JUEGOS',
  'JUEGOS_PARTIDAS'
];

/* ===========================================================================
   AYUDAS
   =========================================================================== */

function _esArchivada_(nombre) {
  return nombre.indexOf(LIMPIEZA_PREFIJO) === 0;
}

function _enUso_(nombre) {
  return LIMPIEZA_EN_USO.indexOf(nombre.toString().trim().toUpperCase()) !== -1;
}

/** Las hojas que sobran: ni se usan ni están ya archivadas. */
function _hojasQueSobran_() {
  var fuera = [];
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(function (h) {
    var n = h.getName();
    if (_enUso_(n) || _esArchivada_(n)) return;
    fuera.push({ hoja: h, nombre: n, filas: Math.max(0, h.getLastRow()) });
  });
  return fuera;
}

function _hojasArchivadas_() {
  var l = [];
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(function (h) {
    if (_esArchivada_(h.getName())) l.push(h);
  });
  return l;
}

function _listaLegible_(items) {
  return items.map(function (x) {
    return '  · ' + x.nombre + (x.filas ? '  (' + x.filas + ' filas)' : '  (vacía)');
  }).join('\n');
}

/* ===========================================================================
   OPCIONES DEL MENÚ
   =========================================================================== */

/** Archiva todo lo que no usa el código. No borra nada. */
function menuLimpiarHojas() {
  var ui = SpreadsheetApp.getUi();
  var sobran = _hojasQueSobran_();

  if (!sobran.length) {
    _aviso_('Limpieza', 'El libro ya está limpio: todas las hojas visibles se usan.');
    return;
  }

  var resp = ui.alert(
    'Archivar ' + sobran.length + ' hoja' + (sobran.length === 1 ? '' : 's'),
    'Estas no las usa el código:\n\n' + _listaLegible_(sobran) +
    '\n\nSe van a esconder y a renombrar con "ZZ " adelante. ' +
    'NO se borran: los datos se quedan y se pueden regresar desde el menú.\n\n' +
    '¿Le sigo?',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  var hechas = 0, fallaron = [];
  sobran.forEach(function (x) {
    try {
      x.hoja.setName(LIMPIEZA_PREFIJO + x.nombre);
      x.hoja.hideSheet();
      hechas++;
    } catch (e) {
      fallaron.push(x.nombre + ': ' + e.message);
    }
  });

  _aviso_('Listo',
    hechas + ' hoja' + (hechas === 1 ? '' : 's') + ' fuera de en medio.\n\n' +
    'Quedaron escondidas con "ZZ " adelante. Si en unos días nada se rompe, ' +
    'usa "Borrar las hojas archivadas" para quitarlas de verdad.' +
    (fallaron.length ? '\n\nNo pude con:\n' + fallaron.join('\n') : ''));
}

/** Regresa las archivadas a como estaban. */
function menuRestaurarHojas() {
  var archivadas = _hojasArchivadas_();
  if (!archivadas.length) {
    _aviso_('Deshacer limpieza', 'No hay hojas archivadas.');
    return;
  }

  var n = 0;
  archivadas.forEach(function (h) {
    try {
      h.showSheet();
      h.setName(h.getName().substring(LIMPIEZA_PREFIJO.length));
      n++;
    } catch (e) {}
  });

  _aviso_('Deshecho', n + ' hoja' + (n === 1 ? '' : 's') + ' de vuelta a la vista.');
}

/** Borra de verdad, y solo lo ya archivado. Esto no se deshace. */
function menuBorrarArchivadas() {
  var ui = SpreadsheetApp.getUi();
  var archivadas = _hojasArchivadas_();

  if (!archivadas.length) {
    _aviso_('Borrar archivadas', 'No hay hojas archivadas. Primero corre "Limpiar hojas".');
    return;
  }

  var nombres = archivadas.map(function (h) { return '  · ' + h.getName(); }).join('\n');

  var resp = ui.prompt(
    'Borrar ' + archivadas.length + ' hoja' + (archivadas.length === 1 ? '' : 's'),
    'Se van a borrar para siempre:\n\n' + nombres +
    '\n\nEsto NO se puede deshacer.\n\n' +
    'Si estás seguro, escribe BORRAR y acepta.',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  if ((resp.getResponseText() || '').trim().toUpperCase() !== 'BORRAR') {
    _aviso_('Cancelado', 'No escribiste BORRAR. No toqué nada.');
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var n = 0;
  archivadas.forEach(function (h) {
    try { ss.deleteSheet(h); n++; } catch (e) {}
  });

  _aviso_('Borradas', n + ' hoja' + (n === 1 ? '' : 's') + ' menos.');
}

/** Solo informa: qué hay y en qué estado, sin mover nada. */
function menuRevisarHojas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var usadas = [], sobran = [], archivadas = [];

  ss.getSheets().forEach(function (h) {
    var n = h.getName();
    if (_esArchivada_(n)) archivadas.push(n);
    else if (_enUso_(n)) usadas.push(n);
    else sobran.push(n + (h.getLastRow() ? ' (' + h.getLastRow() + ')' : ' (vacía)'));
  });

  _aviso_('Hojas del libro',
    'EN USO (' + usadas.length + '):\n' + usadas.join(', ') +
    '\n\nQUE SOBRAN (' + sobran.length + '):\n' + (sobran.length ? sobran.join('\n') : 'ninguna') +
    '\n\nARCHIVADAS (' + archivadas.length + '):\n' + (archivadas.length ? archivadas.join(', ') : 'ninguna'));
}
