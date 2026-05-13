// ============================================================================
// TOOLTIPS DE GAUGES
// ============================================================================

const datosGauges = {
  total: [], retardos: [], faltas: [], alertas: [], vacaciones: [],
  'horas-extra': [], hoy: [], criticos: [], bono: [], promedio: []
};

function toggleGaugeTooltip(gaugeId) {
  const tooltip = document.getElementById('tooltip-' + gaugeId);
  if (!tooltip) { console.warn('⚠️ Tooltip no encontrado:', gaugeId); return; }

  document.querySelectorAll('.gauge-tooltip.active').forEach(t => {
    if (t.id !== 'tooltip-' + gaugeId) t.classList.remove('active');
  });

  const isActive = tooltip.classList.contains('active');
  if (isActive) {
    tooltip.classList.remove('active');
  } else {
    tooltip.classList.add('active');
    setTimeout(() => { tooltip.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
    cargarDatosTooltip(gaugeId);
  }
}

function cerrarGaugeTooltip(gaugeId) {
  const tooltip = document.getElementById('tooltip-' + gaugeId);
  if (tooltip) tooltip.classList.remove('active');
}

function cargarDatosTooltip(gaugeId) {
  const content = document.getElementById('tooltip-' + gaugeId + '-content');
  if (!content) return;
  content.innerHTML = '<div class="gauge-tooltip-empty">⏳ Cargando...</div>';

  const fechaFiltro = fechaSeleccionada || getFechaHoyMexico();

  google.script.run
    .withSuccessHandler(function(result) {
      if (result.error || !result.data) {
        content.innerHTML = '<div class="gauge-tooltip-empty">❌ Error cargando datos</div>';
        return;
      }
      renderizarTooltipContent(gaugeId, result, fechaFiltro, content);
    })
    .withFailureHandler(function(err) {
      content.innerHTML = '<div class="gauge-tooltip-empty">❌ Error cargando datos</div>';
    })
    .getSheetData('METRICAS_DIARIAS');
}

function renderizarTooltipContent(gaugeId, result, fechaFiltro, content) {
  const headers = result.headers;
  const data = result.data;

  const datosFecha = data.filter(function(row) {
    const fechaRow = row[headers.indexOf('Fecha')];
    if (!fechaRow) return false;
    return new Date(fechaRow).toISOString().split('T')[0] === fechaFiltro;
  });

  const idxNombre = encontrarColumnaDeNombres(headers);
  const idxRetardo = headers.indexOf('Es Retardo');
  const idxFalta = headers.indexOf('Es Falta');
  const idxVacaciones = headers.indexOf('Es Vacaciones');
  const idxHorasExtra = headers.indexOf('Horas Extra');
  const idxMinRetardo = headers.indexOf('Min. Retardo');

  var empleados = [];

  if (gaugeId === 'retardos') {
    empleados = datosFecha.filter(function(row) { return row[idxRetardo] === 'SÍ'; })
      .map(function(row) { return { nombre: row[idxNombre], detalle: (row[idxMinRetardo] || 0) + ' min de retardo' }; });

  } else if (gaugeId === 'faltas') {
    empleados = datosFecha.filter(function(row) { return row[idxFalta] === 'SÍ'; })
      .map(function(row) { return { nombre: row[idxNombre], detalle: 'Falta registrada' }; });

  } else if (gaugeId === 'vacaciones') {
    empleados = datosFecha.filter(function(row) { return row[idxVacaciones] === 'SÍ'; })
      .map(function(row) { return { nombre: row[idxNombre], detalle: 'De vacaciones' }; });

  } else if (gaugeId === 'hoy') {
    var idxEntrada = headers.indexOf('🚪 Entrada');
    var idxSalida = headers.indexOf('🚪 Salida');
    if (idxEntrada === -1) idxEntrada = headers.findIndex(function(h) { return h && h.toString().includes('Entrada'); });
    if (idxSalida === -1) idxSalida = headers.findIndex(function(h) { return h && h.toString().includes('Salida'); });

    var empleadosQueVinieron = datosFecha.filter(function(row) {
      var entrada = row[idxEntrada];
      var salida = row[idxSalida];
      return (entrada && entrada !== '' && entrada !== null) || (salida && salida !== '' && salida !== null);
    });

    var nombresUnicos = [...new Set(empleadosQueVinieron.map(function(row) { return row[idxNombre]; }))];
    empleados = nombresUnicos.map(function(nombre) { return { nombre: nombre, detalle: 'Presente' }; });

  } else if (gaugeId === 'incidencias') {
    google.script.run
      .withSuccessHandler(function(incidenciasResult) {
        if (incidenciasResult.error || !incidenciasResult.incidencias) {
          content.innerHTML = '<div class="gauge-tooltip-empty">✅ Sin incidencias</div>';
          return;
        }
        var incidencias = incidenciasResult.incidencias;
        if (incidencias.length === 0) { content.innerHTML = '<div class="gauge-tooltip-empty">✅ Sin incidencias de empleados</div>'; return; }

        var html = '';
        incidencias.forEach(function(inc) {
          var icono = '⚠️';
          if (inc.actividad.includes('Uniforme')) icono = '👔';
          if (inc.actividad.includes('Botas')) icono = '🥾';
          if (inc.actividad.includes('Celular')) icono = '📱';
          html += '<div class="gauge-tooltip-item">' +
            crearAvatarElement(inc.empleado, 24) +
            '<div style="flex:1;">' +
              '<div style="font-weight:600;color:#F1F5F9;">' + inc.empleado + '</div>' +
              '<div style="font-size:11px;color:#F59E0B;margin-top:2px;">' + icono + ' ' + inc.actividad + '</div>' +
              '<div style="font-size:9px;color:#64748B;margin-top:2px;">' + inc.fecha + '</div>' +
            '</div>' +
          '</div>';
        });
        content.innerHTML = html;
      })
      .withFailureHandler(function() { content.innerHTML = '<div class="gauge-tooltip-empty">❌ Error cargando</div>'; })
      .getIncidenciasEmpleados(fechaFiltro);
    return;
  }

  if (empleados.length === 0) { content.innerHTML = '<div class="gauge-tooltip-empty">✅ Sin registros</div>'; return; }

  var html = '';
  empleados.forEach(function(emp) {
    html += '<div class="gauge-tooltip-item">' +
      crearAvatarElement(emp.nombre, 24) +
      '<div style="flex:1;">' +
        '<div style="font-weight:600;color:#F1F5F9;">' + emp.nombre + '</div>' +
        '<div style="font-size:10px;color:#64748B;">' + emp.detalle + '</div>' +
      '</div>' +
    '</div>';
  });
  content.innerHTML = html;
}

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
  createParticles();

  window._inicializarDashboard = function() {
    if (window._dashboardListo) return;
    window._dashboardListo = true;
    setupNavigation();
    initializeGauges();
    resetKPIValues();
    loadDashboard();
    if (typeof setupKeyboardShortcuts === 'function') setupKeyboardShortcuts();
    if (typeof updateLiveTime === 'function') { updateLiveTime(); setInterval(updateLiveTime, 1000); }
    setTimeout(ajustarGaugesMobile, 800);
    setTimeout(forzarDosColumnasMovil, 100);
    window.addEventListener('resize', forzarDosColumnasMovil);
    document.querySelectorAll('.nav-item').forEach(function(item) {
      item.addEventListener('click', function() {
        if (window.innerWidth <= 768) {
          var sidebar = document.querySelector('.sidebar');
          var btn = document.getElementById('mobile-menu-btn');
          if (sidebar) sidebar.classList.remove('active');
          if (btn) btn.innerHTML = '<i class="fas fa-bars"></i>';
        }
      });
    });
  };
});
