// ============================================================================
// SISTEMA DE AVATARES — DiceBear Avataaars
// ============================================================================
// Estrategia: el seed es el nombre del empleado. Por default, mandamos al
// API una LISTA de opciones permitidas (curadas, sin elementos raros) y el
// PRNG de DiceBear elige una basándose en el seed → cada empleado tiene un
// avatar consistente. Al personalizar, fijamos valores específicos.
//
// IMPORTANTE: DiceBear 9.x usa COMAS para arrays, NO `[]=`.
// Ejemplo: top=ShortHairShortFlat,ShortHairTheCaesar  (no top[]=...)

var _AV_DEPT_HEX = {
  'CHOFER':'f59e0b','COMPRAS':'10b981','DEVOLUCIONES':'ef4444',
  'KAM':'8b5cf6','OPERACIONES':'3b82f6','PACKING':'06b6d4',
  'PICKING':'ec4899','RRHH':'84cc16','SEGURIDAD':'f97316','DEFAULT':'64748b',
};
var _FALLBACK_HEX = ['3b82f6','8b5cf6','ec4899','10b981','f59e0b','ef4444','06b6d4','84cc16'];

var _STYLE = "avataaars";

// ── Catálogos curados ─────────────────────────────────────────────────────────
var _OPCIONES = {
  skinColor: [
    { v:'Light',     l:'Claro' },
    { v:'Tanned',    l:'Tostado' },
    { v:'Brown',     l:'Moreno' },
    { v:'DarkBrown', l:'Moreno oscuro' }
  ],
  hairColor: [
    { v:'Black',     l:'Negro' },
    { v:'BrownDark', l:'Castaño oscuro' },
    { v:'Brown',     l:'Castaño' },
    { v:'Auburn',    l:'Caoba' },
    { v:'Blonde',    l:'Rubio' }
  ],
  topM: [
    { v:'ShortHairShortCurly',        l:'Corto rizado' },
    { v:'ShortHairShortFlat',         l:'Corto plano' },
    { v:'ShortHairShortRound',        l:'Corto redondo' },
    { v:'ShortHairShortWaved',        l:'Corto ondulado' },
    { v:'ShortHairSides',             l:'Rapado lados' },
    { v:'ShortHairTheCaesar',         l:'Estilo César' },
    { v:'ShortHairTheCaesarSidePart', l:'César con raya' },
    { v:'ShortHairDreads01',          l:'Dreads cortos' },
    { v:'ShortHairFrizzle',           l:'Rizos' }
  ],
  topF: [
    { v:'LongHairStraight',      l:'Lacio largo' },
    { v:'LongHairStraight2',     l:'Lacio largo 2' },
    { v:'LongHairStraightStrand',l:'Lacio con mechón' },
    { v:'LongHairBigHair',       l:'Voluminoso' },
    { v:'LongHairBob',           l:'Bob' },
    { v:'LongHairBun',           l:'Chongo' },
    { v:'LongHairCurly',         l:'Rizado largo' },
    { v:'LongHairCurvy',         l:'Ondulado' },
    { v:'LongHairDreads',        l:'Dreads largos' },
    { v:'LongHairFro',           l:'Afro' },
    { v:'LongHairFroBand',       l:'Afro con banda' },
    { v:'LongHairNotTooLong',    l:'Medio' },
    { v:'LongHairMiaWallace',    l:'Mia Wallace' },
    { v:'LongHairShavedSides',   l:'Rapado lateral' }
  ],
  eyebrows: [
    { v:'Default',        l:'Normal' },
    { v:'DefaultNatural', l:'Natural' },
    { v:'FlatNatural',    l:'Plana' },
    { v:'RaisedExcited',  l:'Levantada' },
    { v:'UpDown',         l:'Asimétrica' }
  ],
  eyes: [
    { v:'Default', l:'Normal' },
    { v:'Happy',   l:'Felices' },
    { v:'Squint',  l:'Entrecerrados' },
    { v:'Wink',    l:'Guiño' }
  ],
  mouth: [
    { v:'Default', l:'Normal' },
    { v:'Smile',   l:'Sonrisa' },
    { v:'Twinkle', l:'Sonrisa amplia' },
    { v:'Serious', l:'Serio' }
  ],
  accessories: [
    { v:'Blank',          l:'Sin lentes' },
    { v:'Round',          l:'Redondos' },
    { v:'Prescription01', l:'Cuadrados' },
    { v:'Prescription02', l:'Modernos' },
    { v:'Wayfarers',      l:'Wayfarer' }
  ],
  facialHair: [
    { v:'Blank',         l:'Sin barba' },
    { v:'BeardLight',    l:'Ligera' },
    { v:'BeardMedium',   l:'Mediana' },
    { v:'BeardMajestic', l:'Tupida' }
  ],
  clothing: [
    { v:'BlazerShirt',   l:'Saco y camisa' },
    { v:'BlazerSweater', l:'Saco y sweater' },
    { v:'CollarSweater', l:'Sweater cuello' },
    { v:'GraphicShirt',  l:'Playera estampada' },
    { v:'Hoodie',        l:'Sudadera' },
    { v:'ShirtCrewNeck', l:'Camiseta' },
    { v:'ShirtVNeck',    l:'Camiseta V' }
  ],
  clothesColor: [
    { v:'Black',       l:'Negro' },
    { v:'Blue01',      l:'Azul claro' },
    { v:'Blue02',      l:'Azul medio' },
    { v:'Blue03',      l:'Azul fuerte' },
    { v:'Gray01',      l:'Gris claro' },
    { v:'Gray02',      l:'Gris oscuro' },
    { v:'Heather',     l:'Jaspeado' },
    { v:'PastelBlue',  l:'Pastel azul' },
    { v:'PastelGreen', l:'Pastel verde' },
    { v:'White',       l:'Blanco' }
  ]
};

// ── Detección de género ───────────────────────────────────────────────────────
var _NOMBRES_F = new Set([
  'maria','ana','carmen','rosa','laura','patricia','daniela','gabriela','andrea','monica',
  'claudia','veronica','sandra','silvia','elizabeth','martha','guadalupe','beatriz','teresa','adriana',
  'alejandra','carolina','diana','karla','paola','fernanda','jessica','isabel','lorena','mariana',
  'cristina','yolanda','leticia','rocio','julia','victoria','valeria','sofia','ximena','gladys',
  'marissa','aida','yaneth','wendy','brenda','cynthia','estrella','gisela','irene','janet','karina',
  'liliana','miriam','nadia','olga','rebeca','susana','tania','samantha','maribel','jocelyn',
  'dennis','marin','sara','vanessa','natalia','jimena','michelle'
]);

function _isFem(nombre) {
  var p = (nombre || '').toLowerCase().trim().split(/\s+/)[0];
  if (_NOMBRES_F.has(p)) return true;
  return p.endsWith('a') && !p.endsWith('ia') && !p.endsWith('ua');
}

// ── Estado global ─────────────────────────────────────────────────────────────
window._avatarOverrides = {};

function _hashN(s) {
  var h = 5381;
  for (var i = 0; i < s.length; i++) { h = ((h << 5) + h) ^ s.charCodeAt(i); h = h >>> 0; }
  return h;
}

function _getBgHex(nombre, departamento) {
  var k = (departamento || '').toString().trim().toUpperCase();
  if (_AV_DEPT_HEX[k]) return _AV_DEPT_HEX[k];
  return _FALLBACK_HEX[_hashN(nombre || '') % _FALLBACK_HEX.length];
}

function _valoresDe(opcionesArr) {
  return opcionesArr.map(function(o) { return o.v; });
}

// ── Construcción de URL ───────────────────────────────────────────────────────
function _buildUrl(seed, bgHex, isFem, override) {
  override = override || {};
  var topAllowed = _valoresDe(isFem ? _OPCIONES.topF : _OPCIONES.topM);

  var params = [];
  params.push('seed=' + encodeURIComponent(seed || 'user'));
  params.push('radius=50');
  params.push('backgroundColor=' + bgHex);
  params.push('backgroundType=solid');

  // Para cada propiedad: si hay override, fijar valor; si no, pasar lista curada
  params.push('skinColor=' + (override.skinColor || _valoresDe(_OPCIONES.skinColor).join(',')));
  params.push('hairColor=' + (override.hairColor || _valoresDe(_OPCIONES.hairColor).join(',')));
  params.push('top='       + (override.top       || topAllowed.join(',')));
  params.push('eyebrows='  + (override.eyebrows  || _valoresDe(_OPCIONES.eyebrows).join(',')));
  params.push('eyes='      + (override.eyes      || _valoresDe(_OPCIONES.eyes).join(',')));
  params.push('mouth='     + (override.mouth     || _valoresDe(_OPCIONES.mouth).join(',')));
  params.push('clothing='  + (override.clothing  || _valoresDe(_OPCIONES.clothing).join(',')));
  params.push('clothesColor=' + (override.clothesColor || _valoresDe(_OPCIONES.clothesColor).join(',')));

  // Accesorios y barba: por default = 0 probabilidad (sin nada)
  if (override.accessories && override.accessories !== 'Blank') {
    params.push('accessories=' + override.accessories);
    params.push('accessoriesProbability=100');
  } else {
    params.push('accessoriesProbability=0');
  }

  if (override.facialHair && override.facialHair !== 'Blank') {
    params.push('facialHair=' + override.facialHair);
    params.push('facialHairProbability=100');
  } else {
    params.push('facialHairProbability=0');
  }

  return 'https://api.dicebear.com/9.x/' + _STYLE + '/svg?' + params.join('&');
}

function _getAvatarUrl(nombre, departamento) {
  var nombreTrim = (nombre || '').trim();
  var bg = _getBgHex(nombreTrim, departamento);
  var isFem = _isFem(nombreTrim);
  var override = window._avatarOverrides[nombreTrim];
  return _buildUrl(nombreTrim, bg, isFem, override);
}

// ── API pública ───────────────────────────────────────────────────────────────
function crearAvatarElement(nombreCompleto, size, departamento) {
  if (size === undefined) size = 40;
  if (departamento === undefined) departamento = null;
  var url = _getAvatarUrl(nombreCompleto, departamento);
  return '<img src="' + url + '" width="' + size + '" height="' + size +
    '" style="border-radius:50%;flex-shrink:0;display:inline-block;vertical-align:middle;" ' +
    'title="' + (nombreCompleto || '') + '" alt="" ' +
    'onerror="this.style.background=\'#64748B\'">';
}

function crearAvatarElementConDepto(nombreCompleto, size, departamento) {
  return crearAvatarElement(nombreCompleto, size, departamento);
}

function cargarAvatarOverrides(callback) {
  google.script.run
    .withSuccessHandler(function(data) {
      if (data && typeof data === 'object') window._avatarOverrides = data;
      if (typeof callback === 'function') callback();
    })
    .withFailureHandler(function() { if (typeof callback === 'function') callback(); })
    .getAvatarOverrides();
}

// ============================================================================
// EDITOR
// ============================================================================
window._currentTab = 'piel';

window.abrirSelectorAvatar = function(nombre) {
  var prev = document.getElementById('avatar-editor-overlay');
  if (prev) prev.remove();

  var nombreTrim = (nombre || '').trim();
  var isFem = _isFem(nombreTrim);
  window._editorNombre = nombreTrim;
  window._editorOverride = JSON.parse(JSON.stringify(window._avatarOverrides[nombreTrim] || {}));

  var overlay = document.createElement('div');
  overlay.id = 'avatar-editor-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);';

  overlay.innerHTML =
    '<div style="background:linear-gradient(135deg,#1E293B,#0F172A);border:1px solid rgba(59,130,246,0.4);border-radius:16px;width:540px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
      '<div style="padding:20px 24px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(51,65,85,0.4);">' +
        '<div>' +
          '<div style="font-size:18px;font-weight:800;color:#F1F5F9;">Personalizar avatar</div>' +
          '<div style="font-size:12px;color:#94A3B8;margin-top:2px;">' + nombreTrim.split(' ').slice(0,2).join(' ') + '</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'avatar-editor-overlay\').remove()" style="background:none;border:none;color:#64748B;font-size:24px;cursor:pointer;line-height:1;">×</button>' +
      '</div>' +
      '<div style="padding:20px;display:flex;justify-content:center;background:rgba(15,23,42,0.4);">' +
        '<div id="avatar-preview-container" style="width:140px;height:140px;border-radius:50%;overflow:hidden;border:3px solid rgba(59,130,246,0.4);"></div>' +
      '</div>' +
      '<div id="avatar-tabs" style="display:flex;gap:4px;padding:0 16px;border-bottom:1px solid rgba(51,65,85,0.4);overflow-x:auto;">' +
        _crearTabBtn('piel','🎨 Piel', true) +
        _crearTabBtn('pelo','💇 Pelo') +
        _crearTabBtn('cara','😊 Cara') +
        _crearTabBtn('lentes','👓 Lentes') +
        (isFem ? '' : _crearTabBtn('barba','🧔 Barba')) +
        _crearTabBtn('ropa','👕 Ropa') +
      '</div>' +
      '<div id="avatar-tab-content" style="padding:18px;flex:1;overflow-y:auto;min-height:200px;max-height:340px;"></div>' +
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
  window._abrirTab('piel');
};

function _crearTabBtn(id, label, activo) {
  var bg = activo ? 'rgba(59,130,246,0.15)' : 'transparent';
  var color = activo ? '#3B82F6' : '#94A3B8';
  var border = activo ? '2px solid #3B82F6' : '2px solid transparent';
  return '<button id="tab-btn-' + id + '" onclick="window._abrirTab(\'' + id + '\')" ' +
    'style="padding:10px 12px;background:' + bg + ';border:none;border-bottom:' + border +
    ';color:' + color + ';font-weight:700;cursor:pointer;font-size:12px;white-space:nowrap;">' +
    label + '</button>';
}

window._abrirTab = function(tab) {
  window._currentTab = tab;
  ['piel','pelo','cara','lentes','barba','ropa'].forEach(function(t) {
    var btn = document.getElementById('tab-btn-' + t);
    if (!btn) return;
    var act = (t === tab);
    btn.style.background = act ? 'rgba(59,130,246,0.15)' : 'transparent';
    btn.style.color = act ? '#3B82F6' : '#94A3B8';
    btn.style.borderBottom = act ? '2px solid #3B82F6' : '2px solid transparent';
  });

  var contenido = document.getElementById('avatar-tab-content');
  if (!contenido) return;

  var ov = window._editorOverride;
  var isFem = _isFem(window._editorNombre);
  var nombreSeed = window._editorNombre;
  var bg = _getBgHex(nombreSeed);

  function makeMini(propPath, opcionVal) {
    var miniOv = {};
    Object.keys(ov).forEach(function(k) { miniOv[k] = ov[k]; });
    miniOv[propPath] = opcionVal;
    return _buildUrl(nombreSeed, bg, isFem, miniOv);
  }

  function gridOpciones(opciones, propPath) {
    var actual = ov[propPath];
    var g = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:10px;">';
    opciones.forEach(function(opt) {
      var sel = (actual === opt.v);
      var miniUrl = makeMini(propPath, opt.v);
      g += '<div onclick="window._cambiarProp(\'' + propPath + '\',\'' + opt.v + '\')" ' +
        'style="cursor:pointer;padding:6px;border-radius:10px;border:2px solid ' + (sel ? '#10B981' : 'rgba(51,65,85,0.4)') +
        ';background:' + (sel ? 'rgba(16,185,129,0.1)' : 'transparent') + ';transition:all 0.15s;text-align:center;">' +
        '<img src="' + miniUrl + '" width="56" height="56" style="border-radius:50%;display:block;margin:0 auto 4px;" onerror="this.style.background=\'#64748B\'"/>' +
        '<div style="font-size:9px;color:' + (sel ? '#10B981' : '#94A3B8') + ';line-height:1.2;font-weight:' + (sel ? '700' : '500') + ';">' + opt.l + '</div>' +
        '</div>';
    });
    return g + '</div>';
  }

  function tituloSeccion(t) {
    return '<div style="font-size:11px;color:#94A3B8;margin-bottom:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">' + t + '</div>';
  }

  var html = '';
  if (tab === 'piel') {
    html = tituloSeccion('Tono de piel') + gridOpciones(_OPCIONES.skinColor, 'skinColor');
  } else if (tab === 'pelo') {
    html = tituloSeccion('Peinado') + gridOpciones(isFem ? _OPCIONES.topF : _OPCIONES.topM, 'top') +
           '<div style="margin-top:18px;"></div>' +
           tituloSeccion('Color de cabello') + gridOpciones(_OPCIONES.hairColor, 'hairColor');
  } else if (tab === 'cara') {
    html = tituloSeccion('Cejas') + gridOpciones(_OPCIONES.eyebrows, 'eyebrows') +
           '<div style="margin-top:18px;"></div>' +
           tituloSeccion('Ojos') + gridOpciones(_OPCIONES.eyes, 'eyes') +
           '<div style="margin-top:18px;"></div>' +
           tituloSeccion('Boca') + gridOpciones(_OPCIONES.mouth, 'mouth');
  } else if (tab === 'lentes') {
    html = tituloSeccion('Accesorios') + gridOpciones(_OPCIONES.accessories, 'accessories');
  } else if (tab === 'barba') {
    html = tituloSeccion('Barba') + gridOpciones(_OPCIONES.facialHair, 'facialHair');
  } else if (tab === 'ropa') {
    html = tituloSeccion('Tipo de ropa') + gridOpciones(_OPCIONES.clothing, 'clothing') +
           '<div style="margin-top:18px;"></div>' +
           tituloSeccion('Color de ropa') + gridOpciones(_OPCIONES.clothesColor, 'clothesColor');
  }

  contenido.innerHTML = html;
};

window._cambiarProp = function(prop, valor) {
  window._editorOverride[prop] = valor;
  _renderPreview();
  window._abrirTab(window._currentTab);
};

function _renderPreview() {
  var container = document.getElementById('avatar-preview-container');
  if (!container) return;
  var bg = _getBgHex(window._editorNombre);
  var isFem = _isFem(window._editorNombre);
  var url = _buildUrl(window._editorNombre, bg, isFem, window._editorOverride);
  container.innerHTML = '<img src="' + url + '" width="140" height="140" style="border-radius:50%;display:block;" onerror="this.style.background=\'#64748B\'"/>';
}

window._resetAvatar = function() {
  window._editorOverride = {};
  _renderPreview();
  window._abrirTab(window._currentTab);
};

window._aleatorizarAvatar = function() {
  var isFem = _isFem(window._editorNombre);
  var rnd = function(arr) { return arr[Math.floor(Math.random() * arr.length)].v; };
  window._editorOverride = {
    skinColor:    rnd(_OPCIONES.skinColor),
    hairColor:    rnd(_OPCIONES.hairColor),
    top:          rnd(isFem ? _OPCIONES.topF : _OPCIONES.topM),
    eyebrows:     rnd(_OPCIONES.eyebrows),
    eyes:         rnd(_OPCIONES.eyes),
    mouth:        rnd(_OPCIONES.mouth),
    accessories:  Math.random() < 0.3 ? rnd(_OPCIONES.accessories.slice(1)) : 'Blank',
    facialHair:   (!isFem && Math.random() < 0.25) ? rnd(_OPCIONES.facialHair.slice(1)) : 'Blank',
    clothing:     rnd(_OPCIONES.clothing),
    clothesColor: rnd(_OPCIONES.clothesColor)
  };
  _renderPreview();
  window._abrirTab(window._currentTab);
};

window._guardarAvatar = function() {
  var btn = document.getElementById('btn-guardar-avatar');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Guardando...';
    btn.style.opacity = '0.7';
  }

  window._avatarOverrides[window._editorNombre] = window._editorOverride;

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
    .guardarAvatarOverride(window._editorNombre, window._editorOverride);
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