// ============================================================================
// SISTEMA DE AVATARES — DiceBear Adventurer
// ============================================================================

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

// Seeds para el selector — 15M + 15F
var _SEEDS_M = ['Carlos', 'Miguel', 'Jose', 'Luis', 'Juan', 'Pedro', 'Fernando', 'Ricardo', 'Eduardo', 'Manuel', 'Roberto', 'Alejandro', 'Francisco', 'Antonio', 'Jorge', 'Diego', 'Sergio', 'Arturo', 'Rafael', 'Hector', 'Gabriel', 'Mario', 'Oscar', 'Raul', 'Ernesto', 'Felipe', 'Gustavo', 'Andres', 'Pablo', 'Javier', 'Victor', 'Daniel', 'Marco', 'Enrique', 'Alberto', 'Adrian', 'Rodrigo', 'Samuel', 'Ivan', 'Benjamin', 'Cristian', 'Leonardo', 'Nicolas', 'Emilio', 'Salvador', 'Gerardo', 'Mauricio', 'Alfredo', 'Armando', 'Ignacio'];
var _SEEDS_F = ['Maria', 'Ana', 'Carmen', 'Rosa', 'Laura', 'Patricia', 'Daniela', 'Gabriela', 'Andrea', 'Monica', 'Claudia', 'Veronica', 'Sandra', 'Silvia', 'Elizabeth', 'Martha', 'Guadalupe', 'Beatriz', 'Teresa', 'Adriana', 'Alejandra', 'Carolina', 'Diana', 'Karla', 'Paola', 'Fernanda', 'Jessica', 'Isabel', 'Lorena', 'Mariana', 'Cristina', 'Yolanda', 'Leticia', 'Rocio', 'Julia', 'Victoria', 'Valeria', 'Sofia', 'Ximena', 'Gladys', 'Brenda', 'Cynthia', 'Estrella', 'Gisela', 'Irene', 'Janet', 'Karina', 'Liliana', 'Miriam', 'Nadia'];
var _PARAMS_M = "earringsProbability=0&facialHairProbability=50";
var _PARAMS_F = "earringsProbability=90&facialHairProbability=0";
var _STYLE = "micah";

window._avatarOverrides = {}; // { nombre: {idx, tab} }
window._avatarCache = {};

function _hashN(s) {
  var h=5381; for(var i=0;i<s.length;i++){h=((h<<5)+h)^s.charCodeAt(i);h=h>>>0;} return h;
}

function _isFem(nombre) {
  var F=new Set(['maria','ana','carmen','rosa','laura','patricia','daniela','gabriela','andrea','monica',
    'claudia','veronica','sandra','silvia','elizabeth','martha','guadalupe','beatriz','teresa','adriana',
    'alejandra','carolina','diana','karla','paola','fernanda','jessica','isabel','lorena','mariana',
    'cristina','yolanda','leticia','rocio','julia','victoria','valeria','sofia','ximena','gladys',
    'marissa','aida','yaneth','wendy','brenda','cynthia','estrella','gisela','irene','janet','karina',
    'liliana','miriam','nadia','olga','rebeca','susana','tania','ursula','viviana','samantha','maribel','jocelyn']);
  var p=(nombre||'').toLowerCase().trim().split(/\s+/)[0];
  return F.has(p)||(p.endsWith('a')&&!p.endsWith('ia')&&!p.endsWith('ua'));
}

function _getBgHex(nombre, departamento) {
  var k=(departamento||'').toString().trim().toUpperCase();
  if(_AV_DEPT_HEX[k]) return _AV_DEPT_HEX[k];
  return _FALLBACK_HEX[_hashN(nombre||'') % _FALLBACK_HEX.length];
}

function _buildUrl(seed, bgHex, isFemale) {
  var params = isFemale ? _PARAMS_F : _PARAMS_M;
  return 'https://api.dicebear.com/9.x/' + _STYLE + '/svg?seed=' +
    encodeURIComponent(seed) + '&radius=50&backgroundColor=' + bgHex + '&backgroundType=solid&' + params;
}

function _getAvatarUrl(nombre, departamento) {
  var bg = _getBgHex(nombre, departamento);
  var ov = window._avatarOverrides[(nombre||'').trim()];
  if (ov !== undefined) {
    var isFem = ov.tab === 'f';
    var seeds = isFem ? _SEEDS_F : _SEEDS_M;
    var seed = seeds[ov.idx % seeds.length];
    return _buildUrl(seed, bg, isFem);
  }
  // Default — nombre como seed, detectar género
  var isFemDefault = _isFem(nombre);
  return _buildUrl((nombre||'user').trim(), bg, isFemDefault);
}

// ── API pública ───────────────────────────────────────────────────────────────
function crearAvatarElement(nombreCompleto, size, departamento) {
  if(size===undefined) size=40;
  if(departamento===undefined) departamento=null;
  // NO cachear aquí — para que override se refleje siempre
  var url = _getAvatarUrl(nombreCompleto, departamento);
  return '<img src="'+url+'" width="'+size+'" height="'+size+
    '" style="border-radius:50%;flex-shrink:0;display:inline-block;vertical-align:middle;" '+
    'title="'+(nombreCompleto||'')+'" alt="'+(nombreCompleto||'')+'" '+
    'onerror="this.style.background=\'#64748B\'">';
}

function crearAvatarElementConDepto(nombreCompleto, size, departamento) {
  return crearAvatarElement(nombreCompleto, size, departamento);
}

function crearAvatarConEstado(nombreCompleto, size, departamento, estado) {
  var url = _getAvatarUrl(nombreCompleto, departamento);
  var estadoColor = estado==='presente'?'#10B981':estado==='vacaciones'?'#F59E0B':'#EF4444';
  var opacity = estado==='ausente'?'0.35':'1';
  var dotSize = Math.max(6,Math.round(size*0.22));
  var dotOffset = Math.round(size*0.04);
  return '<div style="position:relative;width:'+size+'px;height:'+size+'px;flex-shrink:0;display:inline-block;" title="'+(nombreCompleto||'')+'">'+
    '<img src="'+url+'" width="'+size+'" height="'+size+
    '" style="border-radius:50%;opacity:'+opacity+';display:block;border:2px solid '+estadoColor+';" '+
    'onerror="this.style.background=\'#64748B\'">'+
    '<div style="position:absolute;bottom:'+dotOffset+'px;right:'+dotOffset+'px;width:'+dotSize+'px;height:'+dotSize+
    'px;border-radius:50%;background:'+estadoColor+';border:2px solid #0F172A;"></div>'+
    '</div>';
}

// ── Cargar overrides desde servidor ──────────────────────────────────────────
// Llamar esto al iniciar cualquier módulo que muestre avatares
function cargarAvatarOverrides(callback) {
  google.script.run
    .withSuccessHandler(function(data) {
      // data = { "Nombre Empleado": {idx, tab}, ... }
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

// ── Selector de avatar ────────────────────────────────────────────────────────
window.abrirSelectorAvatar = function(nombre) {
  var prev = document.getElementById('avatar-selector-overlay');
  if (prev) prev.remove();

  var bg = _getBgHex(nombre, null);
  var nombreSeg = (nombre||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  var currentOv = window._avatarOverrides[(nombre||'').trim()];
  var currentIdx = currentOv ? currentOv.idx : -1;
  var currentTab = currentOv ? (currentOv.tab||'m') : 'm';

  function makeGrid(seeds, tab) {
    var display = tab === 'm' ? 'grid' : 'none';
    var g = '<div id="avs-grid-'+tab+'" style="display:'+display+';grid-template-columns:repeat(5,1fr);gap:10px;">';
    seeds.forEach(function(seed, i) {
      var url = _buildUrl(seed, bg, tab === 'f');
      var isSel = (currentTab===tab && currentIdx===i);
      g += '<div id="av-'+tab+'-'+i+'" onclick="window._avsSel(\''+nombreSeg+'\','+i+',\''+tab+'\')" '+
        'style="cursor:pointer;padding:3px;border-radius:50%;border:3px solid '+(isSel?'#10B981':'transparent')+
        ';transition:border-color 0.15s;" '+
        'onmouseover="this.style.borderColor=\''+(tab==='m'?'#3B82F6':'#EC4899')+'\'" '+
        'onmouseout="this.style.borderColor=\''+(isSel?'#10B981':'transparent')+'\'">'+
        '<img src="'+url+'" width="60" height="60" style="border-radius:50%;display:block;" onerror="this.style.background=\'#64748B\'">'+
        '</div>';
    });
    return g + '</div>';

  // Cargar imágenes escalonadamente para no saturar DiceBear
  function lazyLoadGrid(tab) {
    var grid = document.getElementById('avs-grid-'+tab);
    if (!grid) return;
    var imgs = grid.querySelectorAll('img[data-src]');
    imgs.forEach(function(img, idx) {
      setTimeout(function() {
        var src = img.getAttribute('data-src');
        if (src) { img.src = src; img.removeAttribute('data-src'); }
      }, idx * 70);
    });
  }
  }

  var overlay = document.createElement('div');
  overlay.id = 'avatar-selector-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML =
    '<div style="background:#1E293B;border:1px solid rgba(59,130,246,0.4);border-radius:16px;padding:24px;width:460px;max-width:95vw;max-height:85vh;overflow-y:auto;">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'+
        '<div>'+
          '<div style="font-size:16px;font-weight:700;color:#F1F5F9;">Cambiar avatar</div>'+
          '<div style="font-size:12px;color:#64748B;margin-top:2px;">'+(nombre||'').split(' ').slice(0,2).join(' ')+'</div>'+
        '</div>'+
        '<button onclick="document.getElementById(\'avatar-selector-overlay\').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer;">×</button>'+
      '</div>'+
      '<div style="display:flex;gap:8px;margin-bottom:16px;">'+
        '<button id="avs-tab-m" onclick="window._avsTab(\'m\')" style="flex:1;padding:8px;border-radius:8px;border:1px solid rgba(59,130,246,0.5);background:rgba(59,130,246,0.15);color:#3B82F6;font-weight:700;cursor:pointer;font-size:12px;">👨 Masculinos</button>'+
        '<button id="avs-tab-f" onclick="window._avsTab(\'f\')" style="flex:1;padding:8px;border-radius:8px;border:1px solid rgba(51,65,85,0.4);background:transparent;color:#64748B;font-weight:700;cursor:pointer;font-size:12px;">👩 Femeninos</button>'+
      '</div>'+
      makeGrid(_SEEDS_M, 'm')+
      makeGrid(_SEEDS_F, 'f')+
      '<div id="avs-status" style="margin-top:14px;font-size:12px;color:#64748B;text-align:center;min-height:18px;"></div>'+
    '</div>';

  overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  lazyLoadGrid('m');

  // Si currentTab es 'f', cambiar tab
  if (currentTab === 'f') window._avsTab('f');
};

window._avsTab = function(tab) {
  var gm=document.getElementById('avs-grid-m');
  var gf=document.getElementById('avs-grid-f');
  var tm=document.getElementById('avs-tab-m');
  var tf=document.getElementById('avs-tab-f');
  if(gm) gm.style.display=tab==='m'?'grid':'none';
  if(gf) gf.style.display=tab==='f'?'grid':'none';
  if(tm){tm.style.background=tab==='m'?'rgba(59,130,246,0.15)':'transparent';tm.style.color=tab==='m'?'#3B82F6':'#64748B';tm.style.borderColor=tab==='m'?'rgba(59,130,246,0.5)':'rgba(51,65,85,0.4)';}
  if(tf){tf.style.background=tab==='f'?'rgba(236,72,153,0.15)':'transparent';tf.style.color=tab==='f'?'#EC4899':'#64748B';tf.style.borderColor=tab==='f'?'rgba(236,72,153,0.5)':'rgba(51,65,85,0.4)';}
  lazyLoadGrid(tab);
};

window._avsSel = function(nombre, idx, tab) {
  var st=document.getElementById('avs-status');
  if(st) st.innerHTML='<span style="color:#F59E0B;">⏳ Guardando...</span>';

  // Aplicar cambio INMEDIATAMENTE en memoria
  window._avatarOverrides[(nombre||'').trim()] = {idx:idx, tab:tab};

  // Re-renderizar el mapa ahora mismo
  if(typeof renderMapaDashboard==='function' && window._mapaEmpleadosDashboard)
    renderMapaDashboard(window._mapaEmpleadosDashboard);

  // Guardar en servidor en paralelo
  google.script.run
    .withSuccessHandler(function() {
      if(st) st.innerHTML='<span style="color:#10B981;">✅ Guardado</span>';
      setTimeout(function(){
        var ov=document.getElementById('avatar-selector-overlay');
        if(ov) ov.remove();
      }, 800);
    })
    .withFailureHandler(function(err){
      if(st) st.innerHTML='<span style="color:#EF4444;">❌ '+(err&&err.message?err.message:'Error al guardar')+'</span>';
    })
    .guardarAvatarOverride(nombre, idx, tab);
};

// ============================================================================
// UTILIDADES
// ============================================================================
function encontrarColumnaDeNombres(headers) {
  var posibles=['Nombre','nombre','NOMBRE','Empleado','empleado','Nombre Completo','Name'];
  for(var i=0;i<posibles.length;i++){var idx=headers.indexOf(posibles[i]);if(idx!==-1)return idx;}
  for(var j=0;j<headers.length;j++){var h=(headers[j]||'').toString().toLowerCase();if(h.includes('nombre')||h.includes('empleado')||h.includes('name'))return j;}
  return 0;
}
function extraerNombreDeRow(row,headers){return(row[encontrarColumnaDeNombres(headers)]||'Sin nombre').toString();}
function hashNombreToColor(nombre){var h=_hashN(nombre);var c=['#3B82F6','#8B5CF6','#EC4899','#10B981','#F59E0B','#EF4444','#06B6D4','#84CC16'];return c[h%c.length];}
function safeResult(result){if(!result)return{error:true,message:'Respuesta vacía del servidor',data:[]};if(typeof result!=='object')return{error:true,message:'Respuesta inválida del servidor',data:[]};return result;}
function getFechaHoyMexico(){var now=new Date();var utc=now.getTime()+now.getTimezoneOffset()*60000;var mx=new Date(utc+(-6*3600000));return mx.toISOString().split('T')[0];}
var currentModule=null,cachedData={},pendingRequest=null,currentData=null,currentRenderFunction=null,fechaSeleccionada=null;