// Update KPIs con animación de gauges - SOLO DATOS DE HOY
function updateKPIs(result) {
  console.log('🎯 updateKPIs llamada con:', result);
  if (!result) { handleError('Respuesta vacía del servidor'); return; }
  if (result.error) { handleError(result.message); return; }
  if (!result.data || !result.headers) { handleError('Datos incompletos recibidos'); return; }

  const data = result.data;
  const headers = result.headers;
  
  const fechaFiltro = fechaSeleccionada || getFechaHoyMexico();
  const datosFecha = data.filter(row => {
    const fechaRow = row[headers.indexOf('Fecha')];
    if (!fechaRow) return false;
    const fechaStr = new Date(fechaRow).toISOString().split('T')[0];
    return fechaStr === fechaFiltro;
  });

  const idxRetardo    = headers.indexOf('Es Retardo');
  const idxFalta      = headers.indexOf('Es Falta');
  const idxVacaciones = headers.indexOf('Es Vacaciones');
  const idxHorasExtra = headers.indexOf('Horas Extra');

  let retardos = 0, faltas = 0, vacaciones = 0, horasExtra = 0;

  datosFecha.forEach(row => {
    if (row[idxRetardo]    === 'SÍ') retardos++;
    if (row[idxFalta]      === 'SÍ') faltas++;
    if (row[idxVacaciones] === 'SÍ') vacaciones++;
    const horas = parseFloat(row[idxHorasExtra]) || 0;
    if (horas > 0) horasExtra += horas;
  });

  const idxEntrada = headers.findIndex(h => h && h.toString().includes('Entrada') && !h.toString().includes('Clasificación'));
  const idxSalida  = headers.findIndex(h => h && h.toString().includes('Salida')  && !h.toString().includes('Clasificación') && !h.toString().includes('Desayuno') && !h.toString().includes('Comida'));
  const idxNombre  = encontrarColumnaDeNombres(headers);

  const todosEmpleados          = [...new Set(datosFecha.map(row => row[idxNombre]))];
  const totalEmpleadosEsperados = todosEmpleados.length;
  const empleadosQueVinieron    = datosFecha.filter(row => row[idxEntrada] || row[idxSalida]);
  const nombresPresentes        = [...new Set(empleadosQueVinieron.map(row => row[idxNombre]))];
  const totalPresentes          = nombresPresentes.length;
  const totalRegistrosFecha     = totalPresentes;

  const pctRetardos   = totalEmpleadosEsperados > 0 ? (retardos   / totalEmpleadosEsperados) * 100 : 0;
  const pctFaltas     = totalEmpleadosEsperados > 0 ? (faltas     / totalEmpleadosEsperados) * 100 : 0;
  const pctVacaciones = totalEmpleadosEsperados > 0 ? (vacaciones / totalEmpleadosEsperados) * 100 : 0;

  setTimeout(() => {
    updateGauge('retardos',   pctRetardos,   retardos,   totalRegistrosFecha);
    updateGauge('faltas',     pctFaltas,     faltas,     totalRegistrosFecha);
    updateGauge('vacaciones', pctVacaciones, vacaciones, totalRegistrosFecha);
  }, 300);

  google.script.run
    .withSuccessHandler(result => {
      if (!result.error) {
        const alertasFecha = result.data.filter(row => {
          const fechaRow = row[result.headers.indexOf('Fecha')];
          if (!fechaRow) return false;
          return new Date(fechaRow).toISOString().split('T')[0] === fechaFiltro;
        });
        const alertasCount = alertasFecha.length;
        const pctAlertas = totalRegistrosFecha > 0 ? Math.min((alertasCount / totalRegistrosFecha) * 100, 100) : 0;
      }
    })
    .withFailureHandler(err => console.error('❌ Error alertas:', err))
    .getSheetData('ALERTAS');

  if (window._loadingIncidencias) return;
  window._loadingIncidencias = true;

  google.script.run
    .withSuccessHandler(incResult => {
      window._loadingIncidencias = false;
      if (incResult.error) {
        document.getElementById('kpi-incidencias-display').textContent = '0';
        updateGauge('incidencias', 0, 0, null);
        return;
      }
      const totalIncidencias = incResult.total || 0;
      const pctIncidencias = totalEmpleadosEsperados > 0 ? (totalIncidencias / totalEmpleadosEsperados) * 100 : 0;
      setTimeout(() => {
        updateGauge('incidencias', pctIncidencias, totalIncidencias, totalEmpleadosEsperados);
      }, 300);
    })
    .withFailureHandler(function(err) {
      window._loadingIncidencias = false;
      document.getElementById('kpi-incidencias-display').textContent = '0';
      updateGauge('incidencias', 0, 0, null);
    })
    .getIncidenciasEmpleados(fechaFiltro);

  hideLoading();
}

function updateGauge(id, percentage, value, total) {
  percentage = Math.max(0, Math.min(100, percentage));

  const gaugePath   = document.getElementById('gauge-'      + id);
  const needle      = document.getElementById('needle-'     + id);
  const percentageEl= document.getElementById('percentage-' + id);
  const displayEl   = document.getElementById((id === 'horas-extra' ? 'kpi-horas-extra-display' : 'kpi-' + id + '-display'));

  if (!gaugePath || !needle || !percentageEl) return;

  const circumference = 251.2;
  const offset = circumference - (circumference * percentage / 100);
  gaugePath.style.transition = 'stroke-dashoffset 2.5s cubic-bezier(0.4, 0, 0.2, 1)';
  gaugePath.style.strokeDashoffset = offset;

  const angle = -90 + (percentage * 1.8);
  needle.style.transition = 'transform 2.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
  needle.style.transform  = 'rotate(' + angle + 'deg)';

  if (id === 'horas-extra') {
    percentageEl.textContent = value.toFixed(1) + 'h';
    if (displayEl) displayEl.textContent = value.toFixed(1) + 'h';
  } else {
    percentageEl.textContent = Math.round(percentage) + '%';
    if (displayEl) displayEl.textContent = value;
    if (total !== null && total !== undefined) {
      const totalEl = document.getElementById('kpi-' + id + '-total');
      if (totalEl) totalEl.textContent = total;
    }
  }

  if (displayEl && id !== 'horas-extra') {
    animateCounter(displayEl, 0, value, 1500);
  }
}

function animateCounter(element, start, end, duration) {
  const range = end - start;
  const startTime = performance.now();
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function update(currentTime) {
    const elapsed  = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current  = start + (range * easeOutCubic(progress));
    element.textContent = Math.round(current);
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = end;
      element.style.transform = 'scale(1.1)';
      setTimeout(() => { element.style.transform = 'scale(1)'; }, 200);
    }
  }
  element.style.transition = 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
  requestAnimationFrame(update);
}

function initializeGauges() {
  ['retardos','faltas','vacaciones','hoy','incidencias'].forEach(id => {
    const gaugePath    = document.getElementById('gauge-'      + id);
    const needle       = document.getElementById('needle-'     + id);
    const percentageEl = document.getElementById('percentage-' + id);
    if (gaugePath && needle && percentageEl) {
      gaugePath.style.strokeDashoffset = '251.2';
      needle.style.transform = 'rotate(-90deg)';
      percentageEl.textContent = id === 'horas-extra' ? '0h' : '0%';
    }
  });
}

function resetKPIValues() {
  ['kpi-hoy-display','kpi-retardos-display','kpi-faltas-display','kpi-vacaciones-display','kpi-incidencias-display'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = id.includes('horas-extra') ? '0h' : '0';
  });
}
