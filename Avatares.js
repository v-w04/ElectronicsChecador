// ============================================================================
// SISTEMA DE AVATARES — DiceBear Avataaars
// ============================================================================
// Avatares limpios estilo Bitmoji con personalización por persona.
//
// Cada empleado tiene un avatar default generado por hash del nombre, con:
// - Piel: tonos mexicanos (Light, Tanned, Brown)
// - Cabello: colores naturales
// - Cara: expresiones neutras o sonrientes (no enojadas)
// - SIN: sombreros, parches de ojo, bigotes raros, cejas enojadas, boca de estresado
//
// Editor por persona — al hacer click se abre un modal con tabs:
//   Piel · Pelo · Ojos · Boca · Lentes · Barba · Ropa
// donde se puede cambiar cada parte. Cambios se guardan en Sheets
// (hoja AVATAR_OVERRIDES) y persisten entre sesiones.

// ── Colores de fondo por departamento ─────────────────────────────────────────
var _AV_DEPT_COLORS = {
  'CHOFER':'#F59E0B','COMPRAS':'#10B981','DEVOLUCIONES':'#EF4444',
  'KAM':'#8B5CF6','OPERACIONES':'#3B82F6','PACKING':'#06B6D4',
  'PICKING':'#EC4899','RRHH':'#84CC16','SEGURIDAD':'#F97316','DEFAULT':'#64748B',
};
var _AV_DEPT_HEX = {
  'CHOFER':'f59e0b','COMPRAS':'10b981','DEVOLUCIONES':'ef4444',
  'KAM':'8b5cf6','OPERACIONES':'3b82f6','PACKING':'06b6d4',
  'PICKING':'ec4899','RRHH':'84cc16','SEGURIDAD':'f97316','DEFAULT':'64748b',
};
var _FALLBACK_HEX = ['3b82f6','8b5cf6','ec4899','10b981','f59e0b','ef4444','06b6d4','84cc16'];

// ── Estilo y parámetros base ──────────────────────────────────────────────────
var _STYLE = "avataaars";

// Catálogos curados — solo opciones limpias, sin elementos raros
var _OPCIONES = {
  // Tonos de piel mexicanos: claro, tostado, moreno
  skinColor: ['Light', 'Tanned', 'Brown', 'DarkBrown'],

  // Colores de cabello naturales (sin azules, morados, rosas, etc.)
  hairColor: ['Black', 'BrownDark', 'Brown', 'Auburn', 'Blonde'],

  // Peinados — masculinos (cortos sin sombreros)
  topM: [
    'ShortHairShortCurly',
    'ShortHairShortFlat',
    'ShortHairShortRound',
    'ShortHairShortWaved',
    'ShortHairSides',
    'ShortHairTheCaesar',
    'ShortHairTheCaesarSidePart',
    'ShortHairDreads01',
    'ShortHairFrizzle'
  ],

  // Peinados — femeninos (largos y medios sin sombreros)
  topF: [
    'LongHairStraight',
    'LongHairStraight2',
    'LongHairStraightStrand',
    'LongHairBigHair',
    'LongHairBob',
    'LongHairBun',
    'LongHairCurly',
    'LongHairCurvy',
    'LongHairDreads',
    'LongHairFro',
    'LongHairFroBand',
    'LongHairNotTooLong',
    'LongHairMiaWallace',
    'LongHairShavedSides'
  ],

  // Cejas — solo neutras, sin enojadas
  eyebrows: ['Default', 'DefaultNatural', 'FlatNatural', 'RaisedExcited', 'UpDown'],

  // Ojos — naturales, sin lágrimas, sin x, sin asustados
  eyes: ['Default', 'Happy', 'Squint', 'Wink'],

  // Boca — sonriente o neutral
  mouth: ['Default', 'Smile', 'Twinkle', 'Serious'],

  // Lentes — incluye opción sin lentes
  accessories: ['Blank', 'Round', 'Prescription01', 'Prescription02', 'Wayfarers'],

  // Barba — incluye opción sin barba
  facialHair: ['Blank', 'BeardLight', 'BeardMedium', 'BeardMajestic'],

  // Ropa — formal y casual sin estampados raros
  clothing: ['BlazerShirt', 'BlazerSweater', 'CollarSweater', 'GraphicShirt', 'Hoodie', 'ShirtCrewNeck', 'ShirtVNeck'],

  // Color de ropa
  clothesColor: ['Black', 'Blue01', 'Blue02', 'Blue03', 'Gray01', 'Gray02', 'Heather', 'PastelBlue', 'PastelGreen', 'White']
};

// ── Detección de género por primer nombre ─────────────────────────────────────
var _NOMBRES_F = new Set([
  'maria','ana','carmen','rosa','laura','patricia','daniela','gabriela','andrea','monica',
  'claudia','veronica','sandra','silvia','elizabeth','martha','guadalupe','beatriz','teresa','adriana',
  'alejandra','carolina','diana','karla','paola','fernanda','jessica','isabel','lorena','mariana',
  'cristina','yolanda','leticia','rocio','julia','victoria','valeria','sofia','ximena','gladys',
  'marissa','aida','yaneth','wendy','brenda','cynthia','estrella','gisela','irene','janet','karina',
  'liliana','miriam','nadia','olga','rebeca','susana','tania','ursula','viviana','samantha','maribel',
  'jocelyn','dennis','marin','sara','vanessa','natalia','jimena','michelle','denisse','daphne'
]);

function _isFem(nombre) {
  var p = (nombre || '').toLowerCase().trim().split(/\s+/)[0];
  if (_NOMBRES_F.has(p)) return true;
  // Regla heurística: termina en 'a' pero no 'ia' ni 'ua' y no 'ma' final
  return p.endsWith('a') && !p.endsWith('ia') && !p.endsWith('ua');
}

// ── Estado global ────────────────────────────────────────────────────────────
window._avatarOverrides = {}; // { nombre: { skinColor, hairColor, top, eyebrows, eyes, mouth, accessories, facialHair, clothing, clothesColor } }
window._avatarCache = {};

function _hashN(s) {
  var h = 5381;
  for (var i = 0; i < s.length; i++) { h = ((h << 5) + h) ^ s.charCodeAt(i); h = h >>> 0; }
  return h;
}

// Selecciona una opción de un array usando el hash del nombre como semilla
function _pickFromHash(arr, nombre, offset) {
  var h = _hashN((nombre || '') + (offset || 0));
  return arr[h % arr.length];
}

// Genera el avatar default para un empleado (basado en su nombre)
function _generarAvatarDefault(nombre) {
  var isFem = _isFem(nombre);
  return {
    skinColor:     _pickFromHash(_OPCIONES.skinColor, nombre, 1),
    hairColor:     _pickFromHash(_OPCIONES.hairColor, nombre, 2),
    top:           _pickFromHash(isFem ? _OPCIONES.topF : _OPCIONES.topM, nombre, 3),
    eyebrows:      _pickFromHash(_OPCIONES.eyebrows, nombre, 4),
    eyes:          _pickFromHash(_OPCIONES.eyes, nombre, 5),
    mouth:         _pickFromHash(_OPCIONES.mouth, nombre, 6),
    accessories:   'Blank',  // ⭐ por default SIN lentes
    facialHair:    'Blank',  // ⭐ por default SIN barba (incluso en hombres)
    clothing:      _pickFromHash(_OPCIONES.clothing, nombre, 9),
    clothesColor:  _pickFromHash(_OPCIONES.clothesColor, nombre, 10)
  };
}

function _getBgHex(nombre, departamento) {
  var k = (departamento || '').toString().trim().toUpperCase();
  if (_AV_DEPT_HEX[k]) return _AV_DEPT_HEX[k];
  return _FALLBACK_HEX[_hashN(nombre || '') % _FALLBACK_HEX.length];
}

// Construye la URL del avatar dado un objeto de configuración
function _buildUrl(config, bgHex) {
  var params = [
    'seed=' + encodeURIComponent('x'),  // seed fijo, las opciones lo definen
    'radius=50',
    'backgroundColor=' + bgHex,
    'backgroundType=solid',
    'skinColor=' + config.skinColor,
    'hairColor=' + config.hairColor,
    'top[]=' + config.top,
    'eyebrows[]=' + config.eyebrows,
    'eyes[]=' + config.eyes,
    'mouth[]=' + config.mouth,
    'accessories[]=' + (config.accessories || 'Blank'),
    'accessoriesProbability=' + (config.accessories === 'Blank' || !config.accessories ? '0' : '100'),
    'facialHair[]=' + (config.facialHair || 'Blank'),
    'facialHairProbability=' + (config.facialHair === 'Blank' || !config.facialHair ? '0' : '100'),
    'clothing[]=' + config.clothing,
    'clothesColor[]=' + config.clothesColor
  ];
  return 'https://api.dicebear.com/9.x/' + _STYLE + '/svg?' + params.join('&');
}

function _getConfig(nombre) {
  var nombreTrim = (nombre || '').trim();
  var override = window._avatarOverrides[nombreTrim];
  if (override) {
    // Si tiene override, combinar con default (override sobreescribe)
    var def = _generarAvatarDefault(nombreTrim);
    var merged = {};
    Object.keys(def).forEach(function(k) { merged[k] = def[k]; });
    Object.keys(override).forEach(function(k) {
      if (override[k]) merged[k] = override[k];
    });
    return merged;
  }
  return _generarAvatarDefault(nombreTrim);
}

function _getAvatarUrl(nombre, departamento) {
  var bg = _getBgHex(nombre, departamento);
  var config = _getConfig(nombre);
  return _buildUrl(config, bg);
}

// ── API pública para usar avatares ────────────────────────────────────────────
function crearAvatarElement(nombreCompleto, size, departamento) {
  if (size === undefined) size = 40;
  if (departamento === undefined) departamento = null;
  var url = _getAvatarUrl(nombreCompleto, departamento);
  return '<img src="' + url + '" width="' + size + '" height="' + size +
    '" style="border-radius:50%;flex-shrink:0;display:inline-block;vertical-align:middle;" ' +
    'title="' + (nombreCompleto || '') + '" alt="' + (nombreCompleto || '') + '" ' +
    'onerror="this.style.background=\'#64748B\'">';
}

function crearAvatarElementConDepto(nombreCompleto, size, departamento) {
  return crearAvatarElement(nombreCompleto, size, departamento);
}

// ── Cargar overrides desde el servidor ────────────────────────────────────────
function cargarAvatarOverrides(callback) {
  google.script.run
    .withSuccessHandler(function(data) {
      if (data && typeof data === 'object') {
        window._avatarOverrides = data;
      }
      if (typeof callback === 'function') callback();
    })
    .withFailureHandler(function() {
      if (typeof callback === 'function') callback();
    })
    .getAvatarOverrides();
}

// ============================================================================
// EDITOR DE AVATAR — Modal con tabs para personalizar cada parte
// ============================================================================

window.abrirSelectorAvatar = function(nombre) {
  var prev = document.getElementById('avatar-editor-overlay');
  if (prev) prev.remove();

  var nombreTrim = (nombre || '').trim();
  var nombreSeg = nombreTrim.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  // Estado actual (se va modificando con cada cambio)
  window._editorConfig = _getConfig(nombreTrim);
  window._editorNombre = nombreTrim;

  var isFem = _isFem(nombreTrim);

  var overlay = document.createElement('div');
  overlay.id = 'avatar-editor-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);';

  overlay.innerHTML =
    '<div style="background:linear-gradient(135deg,#1E293B,#0F172A);border:1px solid rgba(59,130,246,0.4);border-radius:16px;width:520px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +

      // ── Header ──
      '<div style="padding:20px 24px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(51,65,85,0.4);">' +
        '<div>' +
          '<div style="font-size:18px;font-weight:800;color:#F1F5F9;">Personalizar avatar</div>' +
          '<div style="font-size:12px;color:#94A3B8;margin-top:2px;">' + nombreTrim.split(' ').slice(0,2).join(' ') + '</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'avatar-editor-overlay\').remove()" style="background:none;border:none;color:#64748B;font-size:24px;cursor:pointer;line-height:1;">×</button>' +
      '</div>' +

      // ── Preview grande ──
      '<div style="padding:20px;display:flex;justify-content:center;background:rgba(15,23,42,0.4);">' +
        '<div id="avatar-preview-container" style="width:140px;height:140px;border-radius:50%;overflow:hidden;border:3px solid rgba(59,130,246,0.4);">' +
        '</div>' +
      '</div>' +

      // ── Tabs (Piel / Pelo / Ojos / Boca / Lentes / Barba / Ropa) ──
      '<div id="avatar-tabs" style="display:flex;gap:4px;padding:0 16px;border-bottom:1px solid rgba(51,65,85,0.4);overflow-x:auto;">' +
        _crearTabBtn('piel', '🎨 Piel', true) +
        _crearTabBtn('pelo', '💇 Pelo') +
        _crearTabBtn('cara', '😊 Cara') +
        _crearTabBtn('lentes', '👓 Lentes') +
        (isFem ? '' : _crearTabBtn('barba', '🧔 Barba')) +
        _crearTabBtn('ropa', '👕 Ropa') +
      '</div>' +

      // ── Contenido de tab ──
      '<div id="avatar-tab-content" style="padding:20px;flex:1;overflow-y:auto;min-height:200px;"></div>' +

      // ── Footer con botones ──
      '<div style="padding:14px 20px;display:flex;gap:10px;border-top:1px solid rgba(51,65,85,0.4);">' +
        '<button onclick="window._resetAvatar()" style="padding:10px 16px;background:rgba(100,116,139,0.2);border:1px solid rgba(100,116,139,0.4);border-radius:8px;color:#94A3B8;font-weight:700;cursor:pointer;font-size:12px;">↺ Restaurar</button>' +
        '<button onclick="window._aleatorizarAvatar()" style="padding:10px 16px;background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.4);border-radius:8px;color:#A855F7;font-weight:700;cursor:pointer;font-size:12px;">🎲 Aleatorio</button>' +
        '<div style="flex:1;"></div>' +
        '<button id="btn-guardar-avatar" onclick="window._guardarAvatar()" style="padding:10px 20px;background:linear-gradient(135deg,#10B981,#059669);border:none;border-radius:8px;color:white;font-weight:800;cursor:pointer;font-size:13px;">💾 Guardar</button>' +
      '</div>' +

    '</div>';

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
  _renderPreview();
  _abrirTab('piel');
};

function _crearTabBtn(id, label, activo) {
  var bg    = activo ? 'rgba(59,130,246,0.15)' : 'transparent';
  var color = activo ? '#3B82F6' : '#94A3B8';
  var border= activo ? '2px solid #3B82F6' : '2px solid transparent';
  return '<button id="tab-btn-' + id + '" onclick="window._abrirTab(\'' + id + '\')" ' +
    'style="padding:10px 12px;background:' + bg + ';border:none;border-bottom:' + border +
    ';color:' + color + ';font-weight:700;cursor:pointer;font-size:12px;white-space:nowrap;">' +
    label + '</button>';
}

window._abrirTab = function(tab) {
  // Actualizar estilos de tabs
  ['piel','pelo','cara','lentes','barba','ropa'].forEach(function(t) {
    var btn = document.getElementById('tab-btn-' + t);
    if (!btn) return;
    var activo = (t === tab);
    btn.style.background    = activo ? 'rgba(59,130,246,0.15)' : 'transparent';
    btn.style.color         = activo ? '#3B82F6' : '#94A3B8';
    btn.style.borderBottom  = activo ? '2px solid #3B82F6' : '2px solid transparent';
  });

  var contenido = document.getElementById('avatar-tab-content');
  if (!contenido) return;

  var html = '';
  var cfg = window._editorConfig;
  var isFem = _isFem(window._editorNombre);

  function gridOpciones(opciones, propActual, propPath, labels) {
    var g = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px;">';
    opciones.forEach(function(opt, i) {
      var sel = (cfg[propPath] === opt);
      var label = labels && labels[i] ? labels[i] : opt.replace(/^(Long|Short)Hair/, '').replace(/([A-Z])/g, ' $1').trim();
      // Generar mini-preview con esta opción cambiada
      var miniCfg = {};
      Object.keys(cfg).forEach(function(k) { miniCfg[k] = cfg[k]; });
      miniCfg[propPath] = opt;
      // Si es 'accessories' o 'facialHair' = 'Blank', desactivar probability
      var miniUrl = _buildUrl(miniCfg, _getBgHex(window._editorNombre));

      g += '<div onclick="window._cambiarProp(\'' + propPath + '\',\'' + opt + '\')" ' +
        'style="cursor:pointer;padding:6px;border-radius:10px;border:2px solid ' + (sel ? '#10B981' : 'rgba(51,65,85,0.4)') +
        ';background:' + (sel ? 'rgba(16,185,129,0.1)' : 'transparent') + ';transition:all 0.15s;text-align:center;">' +
        '<img src="' + miniUrl + '" width="56" height="56" style="border-radius:50%;display:block;margin:0 auto 4px;" />' +
        '<div style="font-size:9px;color:' + (sel ? '#10B981' : '#94A3B8') + ';line-height:1.2;font-weight:' + (sel ? '700' : '500') + ';">' + label + '</div>' +
        '</div>';
    });
    return g + '</div>';
  }

  // Switch por tab
  if (tab === 'piel') {
    html = '<div style="font-size:11px;color:#94A3B8;margin-bottom:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Tono de piel</div>' +
      gridOpciones(_OPCIONES.skinColor, cfg.skinColor, 'skinColor', ['Claro','Tostado','Moreno','Moreno oscuro']);
  } else if (tab === 'pelo') {
    var peinados = isFem ? _OPCIONES.topF : _OPCIONES.topM;
    html = '<div style="font-size:11px;color:#94A3B8;margin-bottom:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Peinado</div>' +
      gridOpciones(peinados, cfg.top, 'top') +
      '<div style="font-size:11px;color:#94A3B8;margin:16px 0 12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Color de cabello</div>' +
      gridOpciones(_OPCIONES.hairColor, cfg.hairColor, 'hairColor', ['Negro','Castaño oscuro','Castaño','Caoba','Rubio']);
  } else if (tab === 'cara') {
    html = '<div style="font-size:11px;color:#94A3B8;margin-bottom:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Cejas</div>' +
      gridOpciones(_OPCIONES.eyebrows, cfg.eyebrows, 'eyebrows') +
      '<div style="font-size:11px;color:#94A3B8;margin:16px 0 12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Ojos</div>' +
      gridOpciones(_OPCIONES.eyes, cfg.eyes, 'eyes') +
      '<div style="font-size:11px;color:#94A3B8;margin:16px 0 12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Boca</div>' +
      gridOpciones(_OPCIONES.mouth, cfg.mouth, 'mouth');
  } else if (tab === 'lentes') {
    html = '<div style="font-size:11px;color:#94A3B8;margin-bottom:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Accesorios</div>' +
      gridOpciones(_OPCIONES.accessories, cfg.accessories, 'accessories', ['Sin lentes','Redondos','Cuadrados','Modernos','Wayfarer']);
  } else if (tab === 'barba') {
    html = '<div style="font-size:11px;color:#94A3B8;margin-bottom:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Barba</div>' +
      gridOpciones(_OPCIONES.facialHair, cfg.facialHair, 'facialHair', ['Sin barba','Ligera','Mediana','Tupida']);
  } else if (tab === 'ropa') {
    html = '<div style="font-size:11px;color:#94A3B8;margin-bottom:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Tipo de ropa</div>' +
      gridOpciones(_OPCIONES.clothing, cfg.clothing, 'clothing', ['Saco-camisa','Saco-sweater','Sweater cuello','Playera estampada','Sudadera','Camiseta','Camiseta V']) +
      '<div style="font-size:11px;color:#94A3B8;margin:16px 0 12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Color de ropa</div>' +
      gridOpciones(_OPCIONES.clothesColor, cfg.clothesColor, 'clothesColor');
  }

  contenido.innerHTML = html;
};

window._cambiarProp = function(prop, valor) {
  window._editorConfig[prop] = valor;
  _renderPreview();
  // Re-renderizar tab para actualizar selección
  var tabs = ['piel','pelo','cara','lentes','barba','ropa'];
  for (var i = 0; i < tabs.length; i++) {
    var btn = document.getElementById('tab-btn-' + tabs[i]);
    if (btn && btn.style.color === 'rgb(59, 130, 246)') {
      window._abrirTab(tabs[i]);
      break;
    }
  }
};

function _renderPreview() {
  var container = document.getElementById('avatar-preview-container');
  if (!container) return;
  var bg = _getBgHex(window._editorNombre);
  var url = _buildUrl(window._editorConfig, bg);
  container.innerHTML = '<img src="' + url + '" width="140" height="140" style="border-radius:50%;display:block;" />';
}

window._resetAvatar = function() {
  window._editorConfig = _generarAvatarDefault(window._editorNombre);
  _renderPreview();
  // Re-renderizar tab actual
  var tabs = ['piel','pelo','cara','lentes','barba','ropa'];
  for (var i = 0; i < tabs.length; i++) {
    var btn = document.getElementById('tab-btn-' + tabs[i]);
    if (btn && btn.style.color === 'rgb(59, 130, 246)') {
      window._abrirTab(tabs[i]);
      break;
    }
  }
};

window._aleatorizarAvatar = function() {
  var isFem = _isFem(window._editorNombre);
  var rnd = function(arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  window._editorConfig = {
    skinColor:     rnd(_OPCIONES.skinColor),
    hairColor:     rnd(_OPCIONES.hairColor),
    top:           rnd(isFem ? _OPCIONES.topF : _OPCIONES.topM),
    eyebrows:      rnd(_OPCIONES.eyebrows),
    eyes:          rnd(_OPCIONES.eyes),
    mouth:         rnd(_OPCIONES.mouth),
    accessories:   Math.random() < 0.3 ? rnd(_OPCIONES.accessories.slice(1)) : 'Blank', // 30% lentes
    facialHair:    (!isFem && Math.random() < 0.25) ? rnd(_OPCIONES.facialHair.slice(1)) : 'Blank', // 25% barba en hombres
    clothing:      rnd(_OPCIONES.clothing),
    clothesColor:  rnd(_OPCIONES.clothesColor)
  };
  _renderPreview();
  var tabs = ['piel','pelo','cara','lentes','barba','ropa'];
  for (var i = 0; i < tabs.length; i++) {
    var btn = document.getElementById('tab-btn-' + tabs[i]);
    if (btn && btn.style.color === 'rgb(59, 130, 246)') {
      window._abrirTab(tabs[i]);
      break;
    }
  }
};

window._guardarAvatar = function() {
  var btn = document.getElementById('btn-guardar-avatar');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Guardando...';
    btn.style.opacity = '0.7';
  }

  // Aplicar inmediato en memoria
  window._avatarOverrides[window._editorNombre] = window._editorConfig;

  // Re-renderizar el mapa si está visible
  if (typeof renderMapaDashboard === 'function' && window._mapaEmpleadosDashboard) {
    renderMapaDashboard(window._mapaEmpleadosDashboard);
  }

  google.script.run
    .withSuccessHandler(function() {
      var ov = document.getElementById('avatar-editor-overlay');
      if (ov) ov.remove();
    })
    .withFailureHandler(function(err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '❌ Error al guardar';
        btn.style.background = '#EF4444';
      }
      console.error('Error guardando avatar:', err);
    })
    .guardarAvatarOverride(window._editorNombre, window._editorConfig);
};

// ============================================================================
// UTILIDADES
// ============================================================================
function encontrarColumnaDeNombres(headers) {
  var posibles = ['Nombre','nombre','NOMBRE','Empleado','empleado','Nombre Completo','Name'];
  for (var i = 0; i < posibles.length; i++) {
    var idx = headers.indexOf(posibles[i]);
    if (idx !== -1) return idx;
  }
  for (var j = 0; j < headers.length; j++) {
    var h = (headers[j] || '').toString().toLowerCase();
    if (h.includes('nombre') || h.includes('empleado') || h.includes('name')) return j;
  }
  return 0;
}

function extraerNombreDeRow(row, headers) {
  return (row[encontrarColumnaDeNombres(headers)] || 'Sin nombre').toString();
}

function hashNombreToColor(nombre) {
  var h = _hashN(nombre);
  var c = ['#3B82F6','#8B5CF6','#EC4899','#10B981','#F59E0B','#EF4444','#06B6D4','#84CC16'];
  return c[h % c.length];
}

function safeResult(result) {
  if (!result) return { error: true, message: 'Respuesta vacía del servidor', data: [] };
  if (typeof result !== 'object') return { error: true, message: 'Respuesta inválida del servidor', data: [] };
  return result;
}

function getFechaHoyMexico() {
  var now = new Date();
  var utc = now.getTime() + now.getTimezoneOffset() * 60000;
  var mx = new Date(utc + (-6 * 3600000));
  return mx.toISOString().split('T')[0];
}