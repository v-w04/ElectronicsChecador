// ============================================================================
// MÓDULO MAPA - Plano por Departamentos con Avatares
// ============================================================================

// DEPARTAMENTOS_CONFIG se construye dinámicamente desde los datos de TURNOS_DEFAULT
// Los valores aquí son solo el fallback por si no hay datos aún
const DEPARTAMENTOS_CONFIG_FALLBACK = {
  'CHOFER':       { icon: '🚛', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.4)',  glow: '245,158,11'  },
  'COMPRAS':      { icon: '🛒', color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.4)',  glow: '16,185,129'  },
  'DEVOLUCIONES': { icon: '↩️', color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.4)',   glow: '239,68,68'   },
  'KAM':          { icon: '⚙️', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.4)',  glow: '139,92,246'  },
  'ALMACENES':    { icon: '🏭', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.4)',  glow: '59,130,246'  },
  'OPERACIONES':  { icon: '🏭', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.4)',  glow: '59,130,246'  },
  'PACKING':      { icon: '📦', color: '#06B6D4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.4)',   glow: '6,182,212'   },
  'PICKING':      { icon: '🔍', color: '#EC4899', bg: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.4)',  glow: '236,72,153'  },
  'PROYECTO':     { icon: '🎯', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.4)',  glow: '245,158,11'  },
  'RRHH':         { icon: '👥', color: '#84CC16', bg: 'rgba(132,204,22,0.12)',  border: 'rgba(132,204,22,0.4)',  glow: '132,204,22'  },
  'SEGURIDAD':    { icon: '🛡️', color: '#F97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.4)',  glow: '249,115,22'  },
};

// Paleta de colores para departamentos desconocidos (se asigna por índice)
const DEPT_PALETA = [
  { color: '#3B82F6', glow: '59,130,246'  },
  { color: '#10B981', glow: '16,185,129'  },
  { color: '#8B5CF6', glow: '139,92,246'  },
  { color: '#F59E0B', glow: '245,158,11'  },
  { color: '#EF4444', glow: '239,68,68'   },
  { color: '#06B6D4', glow: '6,182,212'   },
  { color: '#EC4899', glow: '236,72,153'  },
  { color: '#84CC16', glow: '132,204,22'  },
  { color: '#F97316', glow: '249,115,22'  },
  { color: '#A855F7', glow: '168,85,247'  },
  { color: '#14B8A6', glow: '20,184,166'  },
  { color: '#EAB308', glow: '234,179,8'   },
];

const DEPT_ICONOS = {
  'CHOFER': '🚛', 'CHOFERES': '🚛',
  'COMPRAS': '🛒',
  'DEVOLUCIONES': '↩️',
  'KAM': '⚙️',
  'ALMACENES': '🏭', 'OPERACIONES': '🏭',
  'PACKING': '📦',
  'PICKING': '🔍',
  'PROYECTO': '🎯', 'PROYECTOS': '🎯',
  'RRHH': '👥', 'RECURSOS HUMANOS': '👥',
  'SEGURIDAD': '🛡️',
  'SISTEMAS': '💻', 'TI': '💻',
  'VENTAS': '💰',
  'LOGISTICA': '📬', 'LOGÍSTICA': '📬',
};

// DEPARTAMENTOS_CONFIG se construye dinámicamente — empieza vacío
// y se puebla en construirDeptConfig() al cargar los datos
var DEPARTAMENTOS_CONFIG = {};

function construirDeptConfig(listaDeptosReales) {
  // listaDeptosReales: array de strings con los nombres de departamentos encontrados en TURNOS_DEFAULT
  var config = {};
  listaDeptosReales.forEach(function(dept, idx) {
    var key = dept.toString().trim().toUpperCase();
    if (!key) return;
    // Si ya está en el fallback, usarlo
    if (DEPARTAMENTOS_CONFIG_FALLBACK[key]) {
      config[key] = DEPARTAMENTOS_CONFIG_FALLBACK[key];
    } else {
      // Asignar color de paleta por índice
      var paleta = DEPT_PALETA[idx % DEPT_PALETA.length];
      var color = paleta.color;
      var glow = paleta.glow;
      config[key] = {
        icon: DEPT_ICONOS[key] || '🏢',
        color: color,
        bg: 'rgba(' + glow + ',0.12)',
        border: 'rgba(' + glow + ',0.4)',
        glow: glow
      };
    }
  });
  DEPARTAMENTOS_CONFIG = config;
  return config;
}

function renderModuloMapa() {
  const popup = document.getElementById('module-popup');
  const container = document.getElementById('popup-container');
  popup.classList.add('active');
  document.getElementById('popup-title').textContent = 'Mapa de Ubicaciones';

  container.innerHTML =
    '<style>' +
    '.mapa-wrapper{display:grid;grid-template-columns:1fr 280px;gap:20px;height:calc(100vh - 160px);min-height:600px;}' +
    '.mapa-central{background:rgba(8,15,30,0.95);border:1px solid rgba(59,130,246,0.2);border-radius:16px;padding:20px;overflow-y:auto;position:relative;}' +
    '.mapa-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}' +
    '.mapa-titulo{font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#3B82F6;}' +
    '.mapa-stats{display:flex;gap:12px;font-size:12px;}' +
    '.stat-badge{padding:4px 12px;border-radius:20px;font-weight:700;letter-spacing:1px;}' +
    '.stat-badge.presentes{background:rgba(16,185,129,0.15);color:#10B981;border:1px solid rgba(16,185,129,0.3);}' +
    '.stat-badge.ausentes{background:rgba(239,68,68,0.15);color:#EF4444;border:1px solid rgba(239,68,68,0.3);}' +
    '.plano-grid{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:auto;gap:12px;}' +
    '.dept-bloque{border-radius:14px;padding:14px;border:1px solid;position:relative;transition:all 0.3s;cursor:pointer;min-height:120px;}' +
    '.dept-bloque:hover{transform:translateY(-2px);}' +
    '.dept-bloque.span-2{grid-column:span 2;}.dept-bloque.span-3{grid-column:span 3;}' +
    '.dept-bloque::before,.dept-bloque::after{content:"";position:absolute;width:10px;height:10px;border-color:inherit;border-style:solid;}' +
    '.dept-bloque::before{top:-1px;left:-1px;border-width:2px 0 0 2px;border-radius:4px 0 0 0;}' +
    '.dept-bloque::after{bottom:-1px;right:-1px;border-width:0 2px 2px 0;border-radius:0 0 4px 0;}' +
    '.dept-header{display:flex;align-items:center;gap:8px;margin-bottom:10px;}' +
    '.dept-icon{font-size:18px;line-height:1;}' +
    '.dept-nombre{font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;}' +
    '.dept-count{margin-left:auto;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(255,255,255,0.08);}' +
    '.avatares-zona{display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;}' +
    '.avatar-en-mapa{position:relative;cursor:pointer;transition:transform 0.2s;overflow:visible;}' +
    '.avatar-en-mapa .av-edit-badge{opacity:0;transition:opacity 0.15s;}' +
    '.avatar-en-mapa:hover .av-edit-badge{opacity:1;}' +
    '.avatar-en-mapa:hover{transform:scale(1.2);z-index:10;}' +
    '.avatar-en-mapa .status-dot{position:absolute;bottom:1px;right:1px;width:9px;height:9px;border-radius:50%;border:1.5px solid #0F172A;}' +
    '.status-dot.online{background:#10B981;box-shadow:0 0 6px #10B981;}' +
    '.status-dot.offline{background:#4B5563;}' +
    '.mapa-tooltip-box{position:fixed;background:rgba(8,15,30,0.98);border:1px solid var(--tooltip-color,#3B82F6);border-radius:12px;padding:14px 16px;z-index:99999;pointer-events:none;min-width:220px;box-shadow:0 8px 32px rgba(0,0,0,0.6);animation:tooltipIn 0.15s ease;}' +
    '@keyframes tooltipIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}' +
    '.tooltip-nombre{font-size:14px;font-weight:800;color:#F1F5F9;margin-bottom:4px;}' +
    '.tooltip-turno{font-size:11px;color:#64748B;margin-bottom:10px;letter-spacing:0.5px;}' +
    '.tooltip-stats{display:grid;grid-template-columns:1fr 1fr;gap:6px;}' +
    '.tooltip-stat{background:rgba(255,255,255,0.05);border-radius:8px;padding:6px 8px;text-align:center;}' +
    '.tooltip-stat-val{font-size:15px;font-weight:800;display:block;}' +
    '.tooltip-stat-lbl{font-size:9px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;}' +
    '.ausentes-panel{background:rgba(8,15,30,0.95);border:1px solid rgba(239,68,68,0.25);border-radius:16px;display:flex;flex-direction:column;overflow:hidden;}' +
    '.ausentes-header{padding:16px 18px 14px;border-bottom:1px solid rgba(239,68,68,0.15);background:rgba(239,68,68,0.06);}' +
    '.ausentes-titulo{font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#EF4444;display:flex;align-items:center;gap:8px;}' +
    '.ausentes-lista{overflow-y:auto;flex:1;padding:12px;display:flex;flex-direction:column;gap:8px;}' +
    '.ausente-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.12);border-radius:10px;transition:all 0.2s;}' +
    '.ausente-item:hover{background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.3);}' +
    '.ausente-info{flex:1;overflow:hidden;}' +
    '.ausente-nombre{font-size:12px;font-weight:700;color:#F1F5F9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '.ausente-dept{font-size:10px;color:#64748B;margin-top:2px;}' +
    '.dept-filtros{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;}' +
    '.dept-filtro-btn{padding:4px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border:1px solid;background:transparent;transition:all 0.2s;color:#94A3B8;border-color:rgba(255,255,255,0.1);}' +
    '.dept-filtro-btn:hover,.dept-filtro-btn.active{color:white;}' +
    '.mapa-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;color:#64748B;font-size:13px;}' +
    '.mapa-spinner{width:36px;height:36px;border:3px solid rgba(59,130,246,0.2);border-top-color:#3B82F6;border-radius:50%;animation:spin 0.8s linear infinite;}' +
    '@keyframes spin{to{transform:rotate(360deg);}}' +
    '@keyframes pulseOnline{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.4);}50%{box-shadow:0 0 0 4px rgba(16,185,129,0);}}' +
    '.avatar-en-mapa .status-dot.online{animation:pulseOnline 2s ease-in-out infinite;}' +
    '</style>' +

    '<div class="mapa-wrapper">' +
      '<div class="mapa-central">' +
        '<div class="mapa-header">' +
          '<span class="mapa-titulo">🏢 Plano de Instalaciones</span>' +
          '<div class="mapa-stats">' +
            '<span class="stat-badge presentes" id="mapa-cnt-presentes">● 0 presentes</span>' +
            '<span class="stat-badge ausentes" id="mapa-cnt-ausentes">● 0 ausentes</span>' +
          '</div>' +
        '</div>' +
        '<div class="dept-filtros" id="dept-filtros"></div>' +
        '<div class="plano-grid" id="plano-grid">' +
          '<div class="mapa-loading" style="grid-column:span 3;height:400px;"><div class="mapa-spinner"></div><span>Cargando mapa...</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="ausentes-panel">' +
        '<div class="ausentes-header">' +
          '<div class="ausentes-titulo"><span>⚫</span> Ausentes hoy<span id="ausentes-count" style="margin-left:auto;font-size:18px;color:#EF4444;">0</span></div>' +
        '</div>' +
        '<div class="ausentes-lista" id="ausentes-lista"><div class="mapa-loading"><div class="mapa-spinner"></div></div></div>' +
      '</div>' +
    '</div>';

  let tooltipEl = null;

  window.mostrarTooltipMapa = function(el, empleado, deptConfig) {
    ocultarTooltipMapa();
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'mapa-tooltip-box';
    tooltipEl.style.setProperty('--tooltip-color', deptConfig.color);
    tooltipEl.style.setProperty('--tooltip-glow', deptConfig.glow);

    const asistencia = empleado.asistenciaHoy || '—';
    const retardos = empleado.retardosMes !== undefined ? empleado.retardosMes : '—';
    const faltas = empleado.faltasMes !== undefined ? empleado.faltasMes : '—';
    const colorHoy = asistencia === 'PRESENTE' ? '#10B981' : '#EF4444';
    const iconoHoy = asistencia === 'PRESENTE' ? '✅' : '❌';

    tooltipEl.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
        crearAvatarElement(empleado.nombre, 54) +
        '<div>' +
          '<div class="tooltip-nombre">' + empleado.nombre.split(' ').slice(0,2).join(' ') + '</div>' +
          '<div class="tooltip-turno">' + (empleado.turno || 'Sin turno') + ' · ' + deptConfig.icon + ' ' + empleado.departamento + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="tooltip-stats">' +
        '<div class="tooltip-stat"><span class="tooltip-stat-val" style="color:' + colorHoy + ';">' + iconoHoy + '</span><span class="tooltip-stat-lbl">Hoy</span></div>' +
        '<div class="tooltip-stat"><span class="tooltip-stat-val" style="color:#F59E0B;">' + retardos + '</span><span class="tooltip-stat-lbl">Retardos</span></div>' +
        '<div class="tooltip-stat" style="grid-column:span 2;"><span class="tooltip-stat-val" style="color:#EF4444;">' + faltas + '</span><span class="tooltip-stat-lbl">Faltas este mes</span></div>' +
      '</div>';

    document.body.appendChild(tooltipEl);

    const rect = el.getBoundingClientRect();
    const tw = tooltipEl.offsetWidth;
    const th = tooltipEl.offsetHeight;
    let left = rect.left + rect.width / 2 - tw / 2;
    let top = rect.top - th - 12;
    if (top < 8) top = rect.bottom + 12;
    if (left < 8) left = 8;
    if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
  };

  window.ocultarTooltipMapa = function() {
    if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
  };

  cargarDatosEmpleadosMapa();
}

function cargarDatosEmpleadosMapa() {
  google.script.run
    .withSuccessHandler(function(rawTurnos) {
      const rTurnos = safeResult(rawTurnos);
      if (rTurnos.error) return;
      google.script.run
        .withSuccessHandler(function(rawMetricas) {
          const rMetricas = safeResult(rawMetricas);
          if (rMetricas.error) return;
          google.script.run
            .withSuccessHandler(function(rawResumen) {
              const rResumen = safeResult(rawResumen);
              procesarDatosMapa(rTurnos, rMetricas, rResumen.error ? null : rResumen);
            })
            .withFailureHandler(function() { procesarDatosMapa(rTurnos, rMetricas, null); })
            .getSheetData('RESUMEN_MENSUAL');
        })
        .withFailureHandler(function() {})
        .getSheetData('METRICAS_DIARIAS');
    })
    .withFailureHandler(function() {})
    .getSheetData('TURNOS_DEFAULT');
}

function procesarDatosMapa(rTurnos, rMetricas, rResumen) {
  const hoy = getFechaHoyMexico();

  const hT = rTurnos.headers;
  const iNombreT = encontrarColumnaDeNombres(hT);
  const iDeptT = hT.findIndex(function(h) { return h.toString().toLowerCase().includes('departamento'); });
  const iTurnoT = hT.findIndex(function(h) { return h.toString().toLowerCase() === 'turno'; });

  const hM = rMetricas.headers;
  const iNombreM = encontrarColumnaDeNombres(hM);
  const iFechaM = hM.indexOf('Fecha');
  const iFaltaM = hM.indexOf('Es Falta');
  const iInhabilM = hM.indexOf('Es Día Inhábil');
  const iVacacionesM = hM.indexOf('Es Vacaciones');
  const iEnfermedadM = hM.indexOf('Es Enfermedad');

  const registrosHoy = rMetricas.data.filter(function(row) {
    const f = row[iFechaM];
    if (!f) return false;
    const fechaRow = f instanceof Date ? f : new Date(f);
    const fechaLocal = new Date(fechaRow.getTime() + (-6 * 60 * 60 * 1000));
    return fechaLocal.toISOString().split('T')[0] === hoy;
  });

  const presentesHoy = new Set(
    registrosHoy
      .filter(function(r) { return r[iFaltaM] !== 'SÍ' && r[iInhabilM] !== 'SÍ' && r[iVacacionesM] !== 'SÍ' && r[iEnfermedadM] !== 'SÍ'; })
      .map(function(r) { return (r[iNombreM] || '').toString().trim(); })
  );

  const resumenMap = {};
  if (rResumen) {
    const hR = rResumen.headers;
    const iNR = encontrarColumnaDeNombres(hR);
    const iRetR = hR.indexOf('Días Retardo');
    const iFalR = hR.indexOf('Días Falta');
    rResumen.data.forEach(function(row) {
      const n = (row[iNR] || '').toString().trim();
      if (n) resumenMap[n] = { retardosMes: row[iRetR] !== undefined ? row[iRetR] : 0, faltasMes: row[iFalR] !== undefined ? row[iFalR] : 0 };
    });
  }

  const empleados = rTurnos.data
    .filter(function(row) { return row[iNombreT] && row[iNombreT].toString().trim() !== ''; })
    .map(function(row) {
      const nombre = row[iNombreT].toString().trim();
      const dept = iDeptT !== -1 ? (row[iDeptT] || '').toString().trim().toUpperCase() : '';
      const turno = iTurnoT !== -1 ? (row[iTurnoT] || '').toString().trim() : '';
      const presente = presentesHoy.has(nombre);
      const resumen = resumenMap[nombre] || { retardosMes: 0, faltasMes: 0 };
      return { nombre, departamento: dept || 'SIN DEPTO', turno, asistenciaHoy: presente ? 'PRESENTE' : 'AUSENTE', retardosMes: resumen.retardosMes, faltasMes: resumen.faltasMes };
    });

  // ── Construir DEPARTAMENTOS_CONFIG dinámicamente desde los datos reales ──
  const deptosUnicos = [];
  empleados.forEach(function(emp) {
    if (emp.departamento && deptosUnicos.indexOf(emp.departamento) === -1) {
      deptosUnicos.push(emp.departamento);
    }
  });
  deptosUnicos.sort();
  construirDeptConfig(deptosUnicos);

  renderMapaConDatos(empleados);
}

function renderMapaConDatos(empleados) {
  const presentes = empleados.filter(function(e) { return e.asistenciaHoy === 'PRESENTE'; });
  const ausentes = empleados.filter(function(e) { return e.asistenciaHoy === 'AUSENTE'; });

  document.getElementById('mapa-cnt-presentes').textContent = '● ' + presentes.length + ' presentes';
  document.getElementById('mapa-cnt-ausentes').textContent = '● ' + ausentes.length + ' ausentes';
  document.getElementById('ausentes-count').textContent = ausentes.length;

  const porDept = {};
  for (const key of Object.keys(DEPARTAMENTOS_CONFIG)) porDept[key] = [];

  empleados.forEach(function(emp) {
    const dept = emp.departamento.toUpperCase();
    if (porDept[dept] !== undefined) {
      porDept[dept].push(emp);
    } else {
      // Depto desconocido — agregar al config dinámicamente
      if (!DEPARTAMENTOS_CONFIG[dept]) {
        var idx = Object.keys(DEPARTAMENTOS_CONFIG).length;
        var paleta = DEPT_PALETA[idx % DEPT_PALETA.length];
        DEPARTAMENTOS_CONFIG[dept] = {
          icon: DEPT_ICONOS[dept] || '🏢',
          color: paleta.color,
          bg: 'rgba(' + paleta.glow + ',0.12)',
          border: 'rgba(' + paleta.glow + ',0.4)',
          glow: paleta.glow
        };
      }
      porDept[dept] = porDept[dept] || [];
      porDept[dept].push(emp);
    }
  });

  // Filtros — sin template literals anidados
  const filtrosEl = document.getElementById('dept-filtros');
  let filtrosHTML = '<button class="dept-filtro-btn active" onclick="filtrarDeptMapa(\'TODOS\', this)" style="border-color:rgba(59,130,246,0.4);color:#3B82F6;">Todos</button>';
  Object.entries(DEPARTAMENTOS_CONFIG).forEach(function(entry) {
    const k = entry[0];
    const v = entry[1];
    filtrosHTML += '<button class="dept-filtro-btn" onclick="filtrarDeptMapa(\'' + k + '\', this)" style="border-color:' + v.border + ';" data-color="' + v.color + '">' + v.icon + ' ' + k + '</button>';
  });
  filtrosEl.innerHTML = filtrosHTML;

  renderBloquesDept(porDept, empleados);

  // Panel ausentes — sin template literals anidados
  const listaEl = document.getElementById('ausentes-lista');
  if (ausentes.length === 0) {
    listaEl.innerHTML = '<div style="text-align:center;padding:32px 16px;color:#10B981;"><div style="font-size:32px;margin-bottom:8px;">🎉</div><div style="font-size:13px;font-weight:700;">¡Todos presentes!</div></div>';
  } else {
    let ausentesHTML = '';
    ausentes.forEach(function(emp) {
      const dc = DEPARTAMENTOS_CONFIG[emp.departamento] || Object.values(DEPARTAMENTOS_CONFIG)[0] || { icon: '🏢', color: '#64748B', glow: '100,116,139' };
      const faltasHTML = emp.faltasMes > 0 ? '<div>' + emp.faltasMes + 'F</div>' : '';
      const retardosHTML = emp.retardosMes > 0 ? '<div style="color:#F59E0B;">' + emp.retardosMes + 'R</div>' : '';
      ausentesHTML += '<div class="ausente-item">' +
        crearAvatarElement(emp.nombre, 48) +
        '<div class="ausente-info">' +
          '<div class="ausente-nombre">' + emp.nombre.split(' ').slice(0,2).join(' ') + '</div>' +
          '<div class="ausente-dept">' + dc.icon + ' ' + emp.departamento + '</div>' +
        '</div>' +
        '<div style="font-size:10px;color:#EF4444;font-weight:700;text-align:right;">' + faltasHTML + retardosHTML + '</div>' +
      '</div>';
    });
    listaEl.innerHTML = ausentesHTML;
  }

  window._mapaEmpleados = empleados;
  window._mapaPorDept = porDept;
}

function renderBloquesDept(porDept, todosEmpleados) {
  const grid = document.getElementById('plano-grid');
  let gridHTML = '';

  Object.entries(DEPARTAMENTOS_CONFIG).forEach(function(entry) {
    const nombre = entry[0];
    const cfg = entry[1];
    const empleadosDept = porDept[nombre] || [];
    const presentesDept = empleadosDept.filter(function(e) { return e.asistenciaHoy === 'PRESENTE'; });
    const totalDept = empleadosDept.length;
    const spanClass = cfg.w === 3 ? 'span-3' : cfg.w === 2 ? 'span-2' : '';
    const pct = totalDept > 0 ? Math.round((presentesDept.length / totalDept) * 100) : 0;

    let avatarsHTML = '';
    presentesDept.slice(0, 12).forEach(function(emp) {
      const empJSON = JSON.stringify(emp).replace(/"/g, '&quot;');
      const cfgJSON = JSON.stringify(cfg).replace(/"/g, '&quot;');
      var empNombre = emp.nombre.replace(/'/g, "\\'");
      avatarsHTML += '<div class="avatar-en-mapa" onmouseenter="mostrarTooltipMapa(this, ' + empJSON + ', ' + cfgJSON + ')" onmouseleave="ocultarTooltipMapa()" onclick="ocultarTooltipMapa();window.abrirSelectorAvatar(\'' + empNombre + '\')" style="cursor:pointer;overflow:visible;">' +
        crearAvatarElementConDepto(emp.nombre, 51, nombre) +
        '<div class="status-dot online"></div>' +
        '<div class="av-edit-badge" style="position:absolute;top:-3px;right:-3px;width:13px;height:13px;border-radius:50%;background:#3B82F6;display:flex;align-items:center;justify-content:center;font-size:7px;color:white;border:1.5px solid #0F172A;z-index:5;pointer-events:none;">✎</div>' +
      '</div>';
    });

    const extra = presentesDept.length > 12
      ? '<div style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#94A3B8;">+' + (presentesDept.length - 12) + '</div>'
      : '';

    const sinPresentes = presentesDept.length === 0
      ? '<span style="font-size:11px;color:#374151;font-style:italic;">Sin presentes</span>'
      : '';

    gridHTML += '<div class="dept-bloque ' + spanClass + '" style="background:' + cfg.bg + ';border-color:' + cfg.border + ';box-shadow:inset 0 0 40px rgba(' + cfg.glow + ',0.05);" data-dept="' + nombre + '">' +
      '<div class="dept-header">' +
        '<span class="dept-icon">' + cfg.icon + '</span>' +
        '<span class="dept-nombre" style="color:' + cfg.color + ';">' + nombre + '</span>' +
        '<span class="dept-count" style="color:' + cfg.color + ';">' + presentesDept.length + '/' + totalDept + '</span>' +
      '</div>' +
      '<div style="height:3px;background:rgba(255,255,255,0.06);border-radius:2px;margin-bottom:10px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + cfg.color + ';border-radius:2px;transition:width 0.6s ease;"></div></div>' +
      '<div class="avatares-zona">' + avatarsHTML + extra + sinPresentes + '</div>' +
    '</div>';
  });

  grid.innerHTML = gridHTML;
}

window.filtrarDeptMapa = function(dept, btn) {
  document.querySelectorAll('.dept-filtro-btn').forEach(function(b) {
    b.classList.remove('active');
    b.style.color = '#94A3B8';
    b.style.background = 'transparent';
  });
  btn.classList.add('active');
  btn.style.color = btn.dataset.color || '#3B82F6';
  btn.style.background = 'rgba(255,255,255,0.05)';

  const bloques = document.querySelectorAll('.dept-bloque');
  if (dept === 'TODOS') {
    bloques.forEach(function(b) { b.style.opacity = '1'; });
  } else {
    bloques.forEach(function(b) { b.style.opacity = b.dataset.dept === dept ? '1' : '0.25'; });
  }
};