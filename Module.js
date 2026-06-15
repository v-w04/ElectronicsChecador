// ⭐ Variables globales del módulo. Declaradas explícitamente en window para
// evitar ReferenceError cuando se leen antes de la primera asignación.
//
// - window.currentModule  → nombre del módulo abierto ('faltas', 'retardos', etc)
//                           o null si está cerrado. Lo lee Sidebar.js, WebApp.js
//                           y loadCurrentModule() (el botón Refrescar).
// - window.pendingRequest → ID de la petición GAS en curso. Sirve para descartar
//                           respuestas de peticiones viejas si el usuario abre
//                           otro módulo antes de que termine la anterior.
if (typeof window.currentModule  === 'undefined') window.currentModule  = null;
if (typeof window.pendingRequest === 'undefined') window.pendingRequest = null;

function openModule(moduleName) {
  window.currentModule = moduleName;
  const popup     = document.getElementById('module-popup');
  const container = document.getElementById('popup-container');
  const scrollY   = window.scrollY;
  popup.classList.add('active');
  window.scrollTo(0, scrollY);
  const isGirlyMode = document.body.classList.contains('girly-mode');
  popup.style.backgroundColor = isGirlyMode ? '#0a0015' : '#0F172A';
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando datos...</p></div>';
  history.pushState({ module: moduleName }, '', '#' + moduleName);

  switch(moduleName) {
    case 'faltas':              loadModule('METRICAS_DIARIAS', 'Faltas', renderFaltas, true); break;
    case 'enfermedades':        loadEnfermedades(); break;
    case 'retardos':            loadModule('METRICAS_DIARIAS', 'Retardos', renderRetardos, true); break;
    case 'alertas':             loadModule('ALERTAS', 'Alertas', renderAlertas, true); break;
    case 'excesos':             loadModule('METRICAS_DIARIAS', 'Excesos Desayuno/Comida', renderExcesos, true); break;
    case 'vacaciones':          loadModule('METRICAS_DIARIAS', 'Vacaciones', renderVacaciones, true); break;
    case 'gym':                 loadModule('GYM', 'GYM — Bono por Asistencia', renderGym, false); break;
    case 'resumen-mensual':     loadModule('RESUMEN_MENSUAL', 'Resumen Mensual', renderResumenMensual, true); break;
    case 'bono-puntualidad':    loadBonoPuntualidad(); break;
    case 'top-horas-extra':     loadRankingCompleto('horas-extra'); break;
    case 'top-excesos-comida':  loadRankingCompleto('excesos-comida'); break;
    case 'top-retardos':        loadRankingCompleto('retardos'); break;
    case 'top-faltas':          loadRankingCompleto('faltas'); break;
    case 'inyectar-checadores':     renderInyectarChecadores(); break;
    case 'inyectar-eventualidades': renderInyectarEventualidades(); break;
    case 'inyectar-incidencias':    renderInyectarIncidencias(); break;
    case 'empleados':           loadModule('TURNOS_DEFAULT', 'Empleados', renderEmpleados, true); break;
    case 'departamentos':       loadModule('TURNOS_DEFAULT', 'Departamentos', renderDepartamentos, true); break;
    case 'incidencias':         renderIncidencias(); break;
    case 'mapa':                renderModuloMapa(); break;
    case 'oficina':             renderModuloOficina(); break;
  }
}

function loadModule(sheetName, title, renderFunction, usarFiltros) {
  if (window.pendingRequest) window.pendingRequest = null;
  document.getElementById('popup-title').textContent = title;
  if (usarFiltros) agregarControlesFiltros();

  const requestId = Date.now();
  window.pendingRequest = requestId;

  google.script.run
    .withSuccessHandler(raw => {
      const result = safeResult(raw);
      if (window.pendingRequest !== requestId) return;
      if (result.error === true) {
        document.getElementById('popup-container').innerHTML =
          '<div style="text-align:center;padding:40px;color:var(--danger);">❌ ' + result.message + '</div>';
        window.pendingRequest = null;
        return;
      }
      renderFunction(result);
      window.pendingRequest = null;
    })
    .withFailureHandler(err => {
      if (window.pendingRequest !== requestId) return;
      document.getElementById('popup-container').innerHTML =
        '<div style="text-align:center;padding:40px;color:var(--danger);">❌ Error: ' + err.message + '</div>';
      window.pendingRequest = null;
    })
    .getSheetData(sheetName);
}

function loadRankingCompleto(tipo) {
  if (window.pendingRequest) window.pendingRequest = null;
  const requestId = Date.now();
  window.pendingRequest = requestId;
  const titles = {
    'horas-extra':   'Horas Extra - Todos los Empleados',
    'excesos-comida':'Excesos Comida - Todos los Empleados',
    'retardos':      'Retardos - Todos los Empleados',
    'faltas':        'Faltas - Todos los Empleados'
  };
  document.getElementById('popup-title').textContent = titles[tipo];

  google.script.run
    .withSuccessHandler(raw => {
      const result = safeResult(raw);
      if (window.pendingRequest !== requestId) return;
      if (result.error === true) {
        document.getElementById('popup-container').innerHTML =
          '<div style="text-align:center;padding:40px;color:var(--danger);">❌ ' + result.message + '</div>';
        return;
      }
      renderRankingCompleto(result, tipo);
      window.pendingRequest = null;
    })
    .withFailureHandler(err => {
      if (window.pendingRequest !== requestId) return;
      document.getElementById('popup-container').innerHTML =
        '<div style="text-align:center;padding:40px;color:var(--danger);">❌ Error: ' + err.message + '</div>';
      window.pendingRequest = null;
    })
    .getSheetData(tipo === 'retardos' || tipo === 'faltas' ? 'RESUMEN_MENSUAL' : 'METRICAS_DIARIAS');
}

function closeModulePopup() {
  window.currentModule = null;
  document.getElementById('module-popup').classList.remove('active');
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.module === 'dashboard');
  });
}

function loadCurrentModule() {
  // El botón Refrescar de la topbar debe traer datos frescos, no del cache.
  // Si hay un módulo abierto, lo reabrimos para que vuelva a llamar GAS.
  // Si está el dashboard, lo recargamos con forzar=true.
  if (window.currentModule) openModule(window.currentModule);
  else loadDashboard(true);
}

function showLoading() {
  const container = document.getElementById('module-container');
  if (container) container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando datos...</p></div>';
}

function hideLoading() {
  const container = document.getElementById('module-container');
  if (container) container.innerHTML = '';
}

function loadEnfermedades() {
  if (window.pendingRequest) window.pendingRequest = null;
  document.getElementById('popup-title').textContent = 'Enfermedades';
  agregarControlesFiltros();
  const requestId = Date.now();
  window.pendingRequest = requestId;

  google.script.run
    .withSuccessHandler(raw => {
      const result = safeResult(raw);
      if (window.pendingRequest !== requestId) return;
      if (result.error === true) {
        document.getElementById('popup-container').innerHTML =
          '<div style="text-align:center;padding:40px;color:var(--danger);">❌ ' + result.message + '</div>';
        window.pendingRequest = null;
        return;
      }
      renderEnfermedades(result);
      window.pendingRequest = null;
    })
    .withFailureHandler(err => {
      if (window.pendingRequest !== requestId) return;
      document.getElementById('popup-container').innerHTML =
        '<div style="text-align:center;padding:40px;color:var(--danger);">❌ Error: ' + err.message + '</div>';
      window.pendingRequest = null;
    })
    .getEnfermedades();
}
