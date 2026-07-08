// ============================================================================
// SISTEMA DE AVATARES — DiceBear Avataaars
// ============================================================================
// Valores extraídos del schema oficial DiceBear v10.x:
// https://cdn.hopjs.net/npm/@dicebear/styles@10.1.0/dist/avataaars.min.json
//
// IMPORTANTE:
// - Los parámetros van como CSV (separados por coma), NO `[]=`
// - Nombres son camelCase exactos del schema (no PascalCase)
// - Colores son valores HEX sin el `#` al inicio
// - El parámetro de ropa se llama `clothes`, NO `clothing`

var _AV_DEPT_HEX = {
  'CHOFER':'f59e0b','COMPRAS':'10b981','DEVOLUCIONES':'ef4444',
  'KAM':'8b5cf6','OPERACIONES':'3b82f6','PACKING':'06b6d4',
  'PICKING':'ec4899','RRHH':'84cc16','SEGURIDAD':'f97316','DEFAULT':'64748b',
};
var _FALLBACK_HEX = ['3b82f6','8b5cf6','ec4899','10b981','f59e0b','ef4444','06b6d4','84cc16'];

var _STYLE = "avataaars";

// ── Opciones CURADAS verificadas contra el schema oficial ───────────────────
var _OPCIONES = {
  // Piel: tonos mexicanos (sin amarillos ni blancos extremos)
  skinColor: [
    { v:'edb98a', l:'Claro' },
    { v:'d08b5b', l:'Tostado' },
    { v:'ae5d29', l:'Moreno' },
    { v:'614335', l:'Moreno oscuro' }
  ],

  // Cabello: colores naturales (sin rosa, sin gris pálido)
  hairColor: [
    { v:'2c1b18', l:'Negro' },
    { v:'4a312c', l:'Castaño oscuro' },
    { v:'724133', l:'Castaño medio' },
    { v:'a55728', l:'Castaño' },
    { v:'b58143', l:'Caoba' },
    { v:'c93305', l:'Rojo' },
    { v:'d6b370', l:'Rubio claro' }
  ],

  // Peinados (todos válidos del schema, sin sombreros/hijabs/turbantes)
  topM: [
    { v:'shortCurly',           l:'Corto rizado' },
    { v:'shortFlat',            l:'Corto plano' },
    { v:'shortRound',           l:'Corto redondo' },
    { v:'shortWaved',           l:'Corto ondulado' },
    { v:'sides',                l:'Rapado lados' },
    { v:'theCaesar',            l:'Estilo César' },
    { v:'theCaesarAndSidePart', l:'César con raya' },
    { v:'shavedSides',          l:'Rapado mohawk' },
    { v:'frizzle',              l:'Rizos' },
    { v:'bun',                  l:'Bun' },
    { v:'dreads01',             l:'Rastas cortas' },
    { v:'dreads02',             l:'Rastas largas' }
  ],

  topF: [
    { v:'straight01',         l:'Lacio largo' },
    { v:'straight02',         l:'Lacio recto' },
    { v:'straightAndStrand',  l:'Lacio con mechón' },
    { v:'bigHair',            l:'Voluminoso' },
    { v:'bob',                l:'Bob' },
    { v:'bun',                l:'Chongo' },
    { v:'curly',              l:'Rizado largo' },
    { v:'curvy',              l:'Ondulado' },
    { v:'longButNotTooLong',  l:'Medio' },
    { v:'miaWallace',         l:'Mia Wallace' },
    { v:'shaggy',             l:'Despeinado' },
    { v:'shaggyMullet',       l:'Capas' }
  ],

  // Cejas neutras (sin enojadas/tristes/unibrow)
  eyebrows: [
    { v:'default',              l:'Normal' },
    { v:'defaultNatural',       l:'Natural' },
    { v:'flatNatural',          l:'Plana' },
    { v:'raisedExcited',        l:'Levantada' },
    { v:'raisedExcitedNatural', l:'Levantada nat.' },
    { v:'upDown',               l:'Asimétrica' },
    { v:'upDownNatural',        l:'Asimétrica nat.' }
  ],

  // Ojos naturales (sin xDizzy, sin cry, sin hearts, sin surprised, sin closed)
  eyes: [
    { v:'default', l:'Normal' },
    { v:'happy',   l:'Felices' },
    { v:'side',    l:'De lado' },
    { v:'squint',  l:'Entrecerrados' },
    { v:'wink',    l:'Guiño' }
  ],

  // Boca sonriente o neutral (sin tristes, sin gritando, sin vomit, sin tongue)
  mouth: [
    { v:'default', l:'Normal' },
    { v:'serious', l:'Serio' },
    { v:'smile',   l:'Sonrisa' },
    { v:'twinkle', l:'Sonrisa amplia' }
  ],

  // Accesorios (sin eyepatch ni kurt)
  // Blank = sin lentes; los demás son del schema
  accessories: [
    { v:'Blank',          l:'Sin lentes' },
    { v:'round',          l:'Redondos' },
    { v:'prescription01', l:'Cuadrados' },
    { v:'prescription02', l:'Modernos' },
    { v:'sunglasses',     l:'Sol' },
    { v:'wayfarers',      l:'Wayfarer' }
  ],

  // Barba
  facialHair: [
    { v:'Blank',         l:'Sin barba' },
    { v:'beardLight',    l:'Ligera' },
    { v:'beardMedium',   l:'Mediana' },
    { v:'beardMajestic', l:'Tupida' }
  ],

  // Ropa - nombre real es `clothes`
  clothes: [
    { v:'blazerAndShirt',   l:'Saco y camisa' },
    { v:'blazerAndSweater', l:'Saco y sweater' },
    { v:'collarAndSweater', l:'Sweater cuello' },
    { v:'graphicShirt',     l:'Playera estampada' },
    { v:'hoodie',           l:'Sudadera' },
    { v:'shirtCrewNeck',    l:'Camiseta' },
    { v:'shirtScoopNeck',   l:'Camiseta cuello redondo' },
    { v:'shirtVNeck',       l:'Camiseta V' }
  ],

  // Color de ropa (hex del schema)
  clothesColor: [
    { v:'262e33', l:'Negro' },
    { v:'3c4f5c', l:'Gris oscuro' },
    { v:'929598', l:'Gris' },
    { v:'e6e6e6', l:'Gris claro' },
    { v:'ffffff', l:'Blanco' },
    { v:'25557c', l:'Azul marino' },
    { v:'5199e4', l:'Azul' },
    { v:'65c9ff', l:'Azul claro' },
    { v:'b1e2ff', l:'Azul pastel' },
    { v:'a7ffc4', l:'Verde pastel' },
    { v:'ff5c5c', l:'Rojo' },
    { v:'ff488e', l:'Rosa fuerte' },
    { v:'ffafb9', l:'Rosa claro' }
  ],

  // Color de lentes (mismos hex que ropa según el schema oficial)
  accessoriesColor: [
    { v:'262e33', l:'Negro' },
    { v:'3c4f5c', l:'Gris oscuro' },
    { v:'929598', l:'Gris' },
    { v:'e6e6e6', l:'Gris claro' },
    { v:'25557c', l:'Azul marino' },
    { v:'5199e4', l:'Azul' },
    { v:'ff5c5c', l:'Rojo' }
  ],

  // Color de barba (mismos hex que cabello según el schema oficial)
  facialHairColor: [
    { v:'2c1b18', l:'Negro' },
    { v:'4a312c', l:'Castaño oscuro' },
    { v:'724133', l:'Castaño medio' },
    { v:'a55728', l:'Castaño' },
    { v:'b58143', l:'Caoba' },
    { v:'c93305', l:'Rojo' },
    { v:'d6b370', l:'Rubio' }
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
// forZoom=true → reduce el zoom para que se vea más del torso (útil al
//                mostrar miniaturas del tab Ropa).
function _buildUrl(seed, bgHex, isFem, override, forZoom) {
  override = override || {};
  var topAllowed = _valoresDe(isFem ? _OPCIONES.topF : _OPCIONES.topM);

  var params = [];
  params.push('seed=' + encodeURIComponent(seed || 'user'));
  // Para forZoom: NO redondear el SVG ni recortarlo, queremos ver el torso completo
  if (!forZoom) {
    params.push('radius=50');
  }
  params.push('backgroundColor=' + bgHex);
  params.push('backgroundType=solid');

  // skin / hair: colores como hex (sin #)
  params.push('skinColor=' + (override.skinColor || _valoresDe(_OPCIONES.skinColor).join(',')));
  params.push('hairColor=' + (override.hairColor || _valoresDe(_OPCIONES.hairColor).join(',')));
  params.push('top='        + (override.top      || topAllowed.join(',')));
  params.push('eyebrows='   + (override.eyebrows || _valoresDe(_OPCIONES.eyebrows).join(',')));
  params.push('eyes='       + (override.eyes     || _valoresDe(_OPCIONES.eyes).join(',')));
  params.push('mouth='      + (override.mouth    || _valoresDe(_OPCIONES.mouth).join(',')));
  params.push('clothes='    + (override.clothes  || _valoresDe(_OPCIONES.clothes).join(',')));
  params.push('clothesColor=' + (override.clothesColor || _valoresDe(_OPCIONES.clothesColor).join(',')));

  // Lentes: por default SIN, solo si override pide algo específico distinto a Blank
  if (override.accessories && override.accessories !== 'Blank') {
    params.push('accessories=' + override.accessories);
    params.push('accessoriesProbability=100');
    if (override.accessoriesColor) {
      params.push('accessoriesColor=' + override.accessoriesColor);
    } else {
      params.push('accessoriesColor=' + _valoresDe(_OPCIONES.accessoriesColor).join(','));
    }
  } else {
    params.push('accessoriesProbability=0');
  }

  // Barba: por default SIN, solo si override pide algo específico
  if (override.facialHair && override.facialHair !== 'Blank') {
    params.push('facialHair=' + override.facialHair);
    params.push('facialHairProbability=100');
    if (override.facialHairColor) {
      params.push('facialHairColor=' + override.facialHairColor);
    } else {
      // Default: heredar el color del cabello (mismo override.hairColor) o paleta completa
      params.push('facialHairColor=' + (override.hairColor || _valoresDe(_OPCIONES.facialHairColor).join(',')));
    }
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

  function makeMini(propPath, opcionVal, forZoom) {
    var miniOv = {};
    Object.keys(ov).forEach(function(k) { miniOv[k] = ov[k]; });
    miniOv[propPath] = opcionVal;
    return _buildUrl(nombreSeed, bg, isFem, miniOv, forZoom);
  }

  // forZoom=true → miniaturas cuadradas (sin recorte circular) para mostrar
  //                la ropa completa (de hombros para abajo)
  function gridOpciones(opciones, propPath, forZoom) {
    var actual = ov[propPath];
    var g = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:10px;">';
    opciones.forEach(function(opt) {
      var sel = (actual === opt.v);
      var miniUrl = makeMini(propPath, opt.v, forZoom);
      // Para tab ropa: miniaturas cuadradas con esquinas redondeadas (no círculo)
      // para que se vea el torso/ropa que normalmente queda fuera del recorte circular
      var imgStyle = forZoom
        ? 'border-radius:8px;display:block;margin:0 auto 4px;background:rgba(15,23,42,0.3);'
        : 'border-radius:50%;display:block;margin:0 auto 4px;';
      g += '<div onclick="window._cambiarProp(\'' + propPath + '\',\'' + opt.v + '\')" ' +
        'style="cursor:pointer;padding:6px;border-radius:10px;border:2px solid ' + (sel ? '#10B981' : 'rgba(51,65,85,0.4)') +
        ';background:' + (sel ? 'rgba(16,185,129,0.1)' : 'transparent') + ';transition:all 0.15s;text-align:center;">' +
        '<img src="' + miniUrl + '" width="64" height="64" style="' + imgStyle + '" onerror="this.style.background=\'#64748B\'"/>' +
        '<div style="font-size:9px;color:' + (sel ? '#10B981' : '#94A3B8') + ';line-height:1.2;font-weight:' + (sel ? '700' : '500') + ';">' + opt.l + '</div>' +
        '</div>';
    });
    return g + '</div>';
  }

  // Grid de swatches puramente de color (solo el círculo de color, sin avatar)
  function gridColores(opciones, propPath) {
    var actual = ov[propPath];
    var g = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(60px,1fr));gap:10px;">';
    opciones.forEach(function(opt) {
      var sel = (actual === opt.v);
      g += '<div onclick="window._cambiarProp(\'' + propPath + '\',\'' + opt.v + '\')" ' +
        'style="cursor:pointer;padding:6px;border-radius:10px;border:2px solid ' + (sel ? '#10B981' : 'rgba(51,65,85,0.4)') +
        ';background:' + (sel ? 'rgba(16,185,129,0.1)' : 'transparent') + ';transition:all 0.15s;text-align:center;">' +
        '<div style="width:40px;height:40px;border-radius:50%;background:#' + opt.v + ';margin:0 auto 4px;border:1px solid rgba(255,255,255,0.15);"></div>' +
        '<div style="font-size:9px;color:' + (sel ? '#10B981' : '#94A3B8') + ';line-height:1.2;font-weight:' + (sel ? '700' : '500') + ';">' + opt.l + '</div>' +
        '</div>';
    });
    return g + '</div>';
  }

  function tituloSeccion(t) {
    return '<div style="font-size:11px;color:#94A3B8;margin-bottom:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">' + t + '</div>';
  }

  // El tab "lentes" muestra el color solo si hay lentes seleccionados (no Blank)
  var lentesActivos = ov.accessories && ov.accessories !== 'Blank';
  var barbaActiva = ov.facialHair && ov.facialHair !== 'Blank';

  var html = '';
  if (tab === 'piel') {
    html = tituloSeccion('Tono de piel') + gridColores(_OPCIONES.skinColor, 'skinColor');
  } else if (tab === 'pelo') {
    html = tituloSeccion('Peinado') + gridOpciones(isFem ? _OPCIONES.topF : _OPCIONES.topM, 'top') +
           '<div style="margin-top:18px;"></div>' +
           tituloSeccion('Color de cabello') + gridColores(_OPCIONES.hairColor, 'hairColor');
  } else if (tab === 'cara') {
    html = tituloSeccion('Cejas') + gridOpciones(_OPCIONES.eyebrows, 'eyebrows') +
           '<div style="margin-top:18px;"></div>' +
           tituloSeccion('Ojos') + gridOpciones(_OPCIONES.eyes, 'eyes') +
           '<div style="margin-top:18px;"></div>' +
           tituloSeccion('Boca') + gridOpciones(_OPCIONES.mouth, 'mouth');
  } else if (tab === 'lentes') {
    html = tituloSeccion('Accesorios') + gridOpciones(_OPCIONES.accessories, 'accessories');
    if (lentesActivos) {
      html += '<div style="margin-top:18px;"></div>' +
              tituloSeccion('Color de lentes') + gridColores(_OPCIONES.accessoriesColor, 'accessoriesColor');
    }
  } else if (tab === 'barba') {
    html = tituloSeccion('Barba') + gridOpciones(_OPCIONES.facialHair, 'facialHair');
    if (barbaActiva) {
      html += '<div style="margin-top:18px;"></div>' +
              tituloSeccion('Color de barba') + gridColores(_OPCIONES.facialHairColor, 'facialHairColor');
    }
  } else if (tab === 'ropa') {
    // forZoom=true para que las miniaturas muestren el torso (ropa) y no solo la cara
    html = tituloSeccion('Tipo de ropa') + gridOpciones(_OPCIONES.clothes, 'clothes', true) +
           '<div style="margin-top:18px;"></div>' +
           tituloSeccion('Color de ropa') + gridColores(_OPCIONES.clothesColor, 'clothesColor');
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
  var ponerLentes  = Math.random() < 0.3;
  var ponerBarba   = !isFem && Math.random() < 0.25;
  window._editorOverride = {
    skinColor:    rnd(_OPCIONES.skinColor),
    hairColor:    rnd(_OPCIONES.hairColor),
    top:          rnd(isFem ? _OPCIONES.topF : _OPCIONES.topM),
    eyebrows:     rnd(_OPCIONES.eyebrows),
    eyes:         rnd(_OPCIONES.eyes),
    mouth:        rnd(_OPCIONES.mouth),
    accessories:  ponerLentes ? rnd(_OPCIONES.accessories.slice(1)) : 'Blank',
    facialHair:   ponerBarba ? rnd(_OPCIONES.facialHair.slice(1)) : 'Blank',
    clothes:      rnd(_OPCIONES.clothes),
    clothesColor: rnd(_OPCIONES.clothesColor)
  };
  // Si hay lentes, también color
  if (ponerLentes) {
    window._editorOverride.accessoriesColor = rnd(_OPCIONES.accessoriesColor);
  }
  // Si hay barba, también color (por default que coincida con el cabello)
  if (ponerBarba) {
    window._editorOverride.facialHairColor = window._editorOverride.hairColor;
  }
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
