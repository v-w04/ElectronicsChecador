// ============================================================================
// WIDGETS DE PRODUCTIVIDAD
// ============================================================================

function loadProductivityWidgets() {
  if (typeof _cacheResumen !== 'undefined' && _cacheResumen) {
    updateProductivityWidgets(_cacheResumen);
    return;
  }
  google.script.run
    .withSuccessHandler(raw => {
      const result = safeResult(raw);
      if (result.error === true) return;
      if (typeof _cacheResumen !== 'undefined') _cacheResumen = result;
      updateProductivityWidgets(result);
    })
    .withFailureHandler(err => { console.error('❌ Error al cargar widgets:', err); })
    .getSheetData('RESUMEN_MENSUAL');
}

function updateProductivityWidgets(result) {
  if (result.error || !result.data) return;
  const fechaFiltro = fechaSeleccionada || getFechaHoyMexico();
  const headers = result.headers;
  const data = result.data;
  const idxNombre = headers.indexOf('Nombre');
  const idxDiasPuntuales = headers.indexOf('Días Puntuales');
  const idxDiasTrabajados = headers.indexOf('Días Trabajados');
  const idxDiasRetardo = headers.indexOf('Días Retardo');
  const idxDiasFalta = headers.indexOf('Días Falta');

  google.script.run
    .withSuccessHandler(resultHoy => {
      if (resultHoy.error || !resultHoy.data) return;
      const datosFecha = resultHoy.data.filter(row => {
        const fechaRow = row[resultHoy.headers.indexOf('Fecha')];
        if (!fechaRow) return false;
        const fechaRowObj = fechaRow instanceof Date ? fechaRow : new Date(fechaRow);
        const fechaLocal = new Date(fechaRowObj.getTime() + (-6 * 60 * 60 * 1000));
        return fechaLocal.toISOString().split('T')[0] === fechaFiltro;
      });
      const idxEntrada = resultHoy.headers.findIndex(h => {
        if (!h) return false;
        const s = h.toString().trim();
        return s === '▶️ Entrada' || s === 'Entrada';
      });
      const idxNombreFecha = resultHoy.headers.indexOf('Nombre');
      const empleadosEsperados = [...new Set(datosFecha.map(r => r[idxNombreFecha]))];
      const totalEmpleadosEsperados = empleadosEsperados.length;
      const empleadosPresentes = datosFecha.filter(row => {
        const entrada = row[idxEntrada];
        return entrada && entrada !== '' && entrada !== null;
      });
      const nombresPresentes   = [...new Set(empleadosPresentes.map(r => r[idxNombreFecha]))];
      const asistenciaFecha    = nombresPresentes.length;
      const pctAsistenciaFecha = totalEmpleadosEsperados > 0
        ? (asistenciaFecha / totalEmpleadosEsperados) * 100 : 0;
      setTimeout(() => {
        updateGauge('hoy', pctAsistenciaFecha, asistenciaFecha, totalEmpleadosEsperados);
      }, 300);
    })
    .withFailureHandler(err => { console.error('❌ Error cargando datos de hoy:', err); })
    .getSheetData('METRICAS_DIARIAS');

  loadTendenciaSemanal();
}

function loadTendenciaSemanal() {
  google.script.run
    .withSuccessHandler(rawTurnos => {
      const rTurnos = safeResult(rawTurnos);
      if (rTurnos.error) return;
      google.script.run
        .withSuccessHandler(rawMetricas => {
          const rMetricas = safeResult(rawMetricas);
          if (rMetricas.error) return;
          renderTendenciaSemanal(rMetricas, rTurnos);
        })
        .withFailureHandler(err => console.error('❌ Error tendencia métricas:', err))
        .getSheetData('METRICAS_DIARIAS');
    })
    .withFailureHandler(err => console.error('❌ Error tendencia turnos:', err))
    .getSheetData('TURNOS_DEFAULT');
}

function renderTendenciaSemanal(result, rTurnos) {
  if (typeof Chart === 'undefined') { setTimeout(() => renderTendenciaSemanal(result, rTurnos), 500); return; }
  if (result.error || !result.data) return;
  const headers = result.headers;
  const data    = result.data;
  const idxFecha   = headers.indexOf('Fecha');
  const idxNombre  = headers.indexOf('Nombre');
  const idxFalta   = headers.indexOf('Es Falta');
  const idxInhabil = headers.indexOf('Es Día Inhábil');
  const hT       = rTurnos.headers;
  const iNombreT = hT.indexOf('Empleado');
  const iDeptT   = hT.findIndex(h => h.toString().toUpperCase().includes('DEPARTAMENTO'));
  const nombreADept = {};
  const normalizar = str => str.toString().trim().replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').toUpperCase();
  rTurnos.data.forEach(row => {
    const nombre = normalizar(row[iNombreT] || '');
    const dept   = (row[iDeptT] || 'OTRO').toString().trim().toUpperCase();
    if (nombre) nombreADept[nombre] = dept;
  });
  const depts = [...new Set(Object.values(nombreADept))].filter(Boolean).sort();
  const todasFechas = [...new Set(data.map(row => {
    if (!row[idxFecha]) return null;
    return new Date(row[idxFecha]).toISOString().split('T')[0];
  }).filter(Boolean))].sort();
  const fechasLaborales = todasFechas.filter(f => {
    const [y, m, d] = f.split('-').map(Number);
    const dia = new Date(y, m - 1, d, 12).getDay();
    return dia >= 1 && dia <= 5;
  });
  const ultimosDias = fechasLaborales.slice(-14);
  const labels = ultimosDias;
  const datosPorDept = {};
  depts.forEach(dept => {
    datosPorDept[dept] = ultimosDias.map(fechaStr => {
      const registrosDia = data.filter(row => {
        if (!row[idxFecha]) return false;
        return new Date(row[idxFecha]).toISOString().split('T')[0] === fechaStr;
      });
      const delDept = registrosDia.filter(row => nombreADept[normalizar(row[idxNombre] || '')] === dept);
      const total = delDept.length;
      if (total === 0) return null;
      const presentes = delDept.filter(row => row[idxFalta] !== 'SÍ' && row[idxInhabil] !== 'SÍ').length;
      return parseFloat(((presentes / total) * 100).toFixed(1));
    });
  });
  const isGirly = document.body.classList.contains('girly-mode');
  const COLORES_FIJOS = {
    'CHOFER':'#F59E0B','COMPRAS':'#10B981','DEVOLUCIONES':'#EF4444',
    'KAMO':'#8B5CF6','OPERACIONES':'#3B82F6','PACKING':'#06B6D4',
    'PICKING':'#F97316','RRHH':'#EC4899','SEGURIDAD':'#84CC16'
  };
  const PALETA_DINAMICA = ['#3B82F6','#10B981','#8B5CF6','#F59E0B','#EF4444','#06B6D4','#EC4899','#84CC16','#F97316','#A855F7'];
  const datasets = depts.map((dept, deptIdx) => {
    const color = isGirly ? '#BA8FFF' : (COLORES_FIJOS[dept] || PALETA_DINAMICA[deptIdx % PALETA_DINAMICA.length]);
    const rgb = color.replace('#','').match(/.{2}/g).map(h=>parseInt(h,16)).join(',');
    return {
      label: dept, data: datosPorDept[dept],
      borderColor: color, backgroundColor: 'rgba(' + rgb + ', 0.08)',
      borderWidth: 2.5, fill: false, tension: 0.4, pointRadius: 4,
      pointBackgroundColor: color, pointBorderColor: color, pointBorderWidth: 2,
      pointHoverRadius: 7, spanGaps: true
    };
  });
  datasets.push({
    label: '', data: ultimosDias.map(() => 100),
    borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'transparent',
    borderWidth: 1.5, borderDash: [6,4], pointRadius: 0, pointHoverRadius: 0,
    fill: false, tension: 0, spanGaps: true
  });
  const ctx = document.getElementById('chartTendenciaSemanal');
  if (!ctx) return;
  if (window.tendenciaChart) window.tendenciaChart.destroy();
  const gridColor = 'rgba(51, 65, 85, 0.3)';
  const tickColor = '#94A3B8';
  window.tendenciaChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 20, bottom: 10, left: 10, right: 20 } },
      scales: {
        y: {
          beginAtZero: false, min: 0, max: 110,
          ticks: { color: tickColor, font: { size: 12, weight: '600' }, callback: v => v <= 100 ? v + '%' : '', stepSize: 20 },
          grid: { color: gridColor, drawBorder: false },
          title: { display: true, text: '% Asistencia', color: '#F1F5F9', font: { size: 13, weight: '700' } }
        },
        x: {
          position: 'top',
          ticks: {
            color: tickColor, font: { size: 11 }, maxRotation: 45, minRotation: 45,
            callback: function(value, index) {
              const fecha = new Date(labels[index] + 'T12:00:00');
              return fecha.toLocaleDateString('es-MX', { weekday: 'short' }) + ' ' + fecha.getDate() + ' ' + fecha.toLocaleDateString('es-MX', { month: 'short' });
            }
          },
          grid: { color: 'rgba(51, 65, 85, 0.15)', drawBorder: false }
        }
      },
      plugins: {
        legend: {
          display: true, position: 'top',
          labels: {
            filter: item => item.text !== '',
            color: '#F1F5F9', font: { size: 12, weight: '600' },
            padding: 16, usePointStyle: true, pointStyleWidth: 10
          }
        },
        tooltip: {
          filter: item => item.dataset.label !== '',
          backgroundColor: 'rgba(15, 23, 42, 0.97)',
          titleColor: '#F1F5F9', bodyColor: '#94A3B8',
          borderColor: 'rgba(59,130,246,0.4)', borderWidth: 1, padding: 14,
          displayColors: true,
          callbacks: {
            title: function(context) {
              if (!context || context.length === 0) return '';
              const idx = context[0].dataIndex;
              if (idx === undefined || !labels[idx]) return '';
              const fecha = new Date(labels[idx] + 'T12:00:00');
              return fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
            },
            label: function(context) {
              const val = context.parsed.y;
              return val !== null ? ' ' + context.dataset.label + ': ' + val + '%' : ' ' + context.dataset.label + ': —';
            }
          }
        }
      }
    }
  });
}

function handleError(error) {
  console.error('❌ Error:', error);
  const message = typeof error === 'string' ? error : error.message || 'Error desconocido';
  const container = document.getElementById('module-container');
  if (container) container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);">❌ Error: ' + message + '</div>';
  hideLoading();
}
