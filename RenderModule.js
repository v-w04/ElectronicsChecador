// ⭐ Variables globales del módulo de render.
// Declaradas explícitamente en window con guard para evitar ReferenceError
// cuando OTRO archivo intenta leerlas, o cuando una función entra a una
// rama que LEE la variable antes de asignarla (típico en renderAlertas y
// renderFaltas que checan `if (!window.currentData || !window.currentData.originalData)`).
//
// - window.currentData: { headers, data, originalData } — payload de la
//   vista actual, usado para filtrar/refrescar sin volver a llamar a GAS.
// - window.currentRenderFunction: referencia a la función de render activa,
//   usada por los filtros para re-pintar con los datos filtrados.
if (typeof window.currentData         === 'undefined') window.currentData         = null;
if (typeof window.currentRenderFunction === 'undefined') window.currentRenderFunction = null;
var currentData         = window.currentData;
var currentRenderFunction = window.currentRenderFunction;

// Render Faltas — dividido por quincenas
function renderFaltas(result) {
  if (!result || !result.data || result.data.length === 0) {
    document.getElementById('popup-container').innerHTML = '<div style="text-align:center;padding:40px;">ℹ️ No hay datos de faltas</div>';
    return;
  }
  if (!window.currentData || !window.currentData.originalData || window.currentData.originalData.length === 0) {
    currentData = { headers: result.headers, data: result.data.slice(), originalData: result.data.slice() };
  } else { window.currentData.headers = result.headers; window.currentData.data = result.data.slice(); }
  currentRenderFunction = renderFaltas;
  const container = document.getElementById('popup-container');
  const headers = result.headers;
  const data = result.data;
  const idxNombre = encontrarColumnaDeNombres(headers);
  const idxFecha  = headers.indexOf('Fecha');
  const idxFalta  = headers.indexOf('Es Falta');
  const idxInhab  = headers.indexOf('Es Día Inhábil');
  const idxVac    = headers.indexOf('Es Vacaciones');
  const idxEnf    = headers.indexOf('Es Enfermedad');

  const faltas = data.filter(function(row) {
    if (row[idxFalta] !== 'SÍ') return false;
    if (idxInhab !== -1 && row[idxInhab] === 'SÍ') return false;
    if (idxVac   !== -1 && row[idxVac]   === 'SÍ') return false;
    if (idxEnf   !== -1 && row[idxEnf]   === 'SÍ') return false;
    return true;
  });
  if (faltas.length === 0) { container.innerHTML = '<div style="text-align:center;padding:40px;">✅ No hay faltas registradas</div>'; return; }

  // Agrupar por empleado → { Q1: [fechas], Q2: [fechas] }
  const empleados = {};
  faltas.forEach(function(row) {
    const nombre = (row[idxNombre] || '').toString().trim(); if (!nombre) return;
    const fechaRaw = row[idxFecha];
    const fechaStr = typeof fechaRaw === 'string' ? fechaRaw.substring(0,10)
                   : (fechaRaw instanceof Date ? fechaRaw.toISOString().split('T')[0] : '');
    const dia = parseInt((fechaStr.split('-')[2] || '0'), 10);
    const q   = dia <= 15 ? 'Q1' : 'Q2';
    if (!empleados[nombre]) empleados[nombre] = { Q1: [], Q2: [] };
    empleados[nombre][q].push(fechaStr);
  });

  function fmtF(s) {
    if (!s) return '';
    const p = s.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s;
  }

  function seccionQ(fechas, qLabel, color) {
    if (!fechas || fechas.length === 0) return '';
    const filas = fechas.sort().map(function(f) {
      return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(51,65,85,0.25);font-size:12px;">' +
        '<span style="color:#94A3B8;">' + fmtF(f) + '</span>' +
        '<span style="color:#EF4444;font-weight:700;">❌</span></div>';
    }).join('');
    return '<div style="margin-bottom:10px;">' +
      '<div style="padding:3px 8px;background:' + color + ';border-radius:5px;font-size:10px;font-weight:800;color:#fff;letter-spacing:1px;margin-bottom:6px;">' + qLabel + ' (' + fechas.length + ')</div>' +
      filas + '</div>';
  }

  let html = '<div class="employees-grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr));">';
  Object.keys(empleados).sort(function(a,b) {
    return (empleados[b].Q1.length + empleados[b].Q2.length) - (empleados[a].Q1.length + empleados[a].Q2.length);
  }).forEach(function(nombre) {
    const emp = empleados[nombre];
    const total = emp.Q1.length + emp.Q2.length;
    const cuerpo = seccionQ(emp.Q1, '1ª QUINCENA  1–15', '#1E3A5F') +
                   seccionQ(emp.Q2, '2ª QUINCENA  16–fin', '#3B1F5F');
    html += '<div class="employee-card">' +
      '<div class="employee-name" style="display:flex;align-items:center;gap:12px;">' + crearAvatarElement(nombre, 40) + '<span style="font-weight:700;">' + nombre + '</span></div>' +
      '<div class="employee-stats">' +
        '<div class="stat-row" style="margin-bottom:10px;"><span class="label">Total Faltas:</span><span class="value" style="color:#EF4444;font-size:20px;font-weight:700;">' + total + '</span></div>' +
        '<div style="max-height:260px;overflow-y:auto;">' + cuerpo + '</div>' +
      '</div>' +
      '<span class="badge badge-danger">CRÍTICO</span>' +
    '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// Render Retardos — dividido por quincenas
function renderRetardos(result) {
  if (!result || !result.data || result.data.length === 0) {
    document.getElementById('popup-container').innerHTML = '<div style="text-align:center;padding:40px;">ℹ️ No hay datos de retardos</div>';
    return;
  }
  if (!window.currentData || !window.currentData.originalData || window.currentData.originalData.length === 0) {
    currentData = { headers: result.headers, data: result.data.slice(), originalData: result.data.slice() };
  } else { window.currentData.headers = result.headers; window.currentData.data = result.data.slice(); }
  currentRenderFunction = renderRetardos;
  const container = document.getElementById('popup-container');
  const headers = result.headers;
  const data = result.data;
  const idxNombre    = encontrarColumnaDeNombres(headers);
  const idxFecha     = headers.indexOf('Fecha');
  const idxRetardo   = headers.indexOf('Es Retardo');
  const idxMinRetardo= headers.indexOf('Min. Retardo');
  const idxInhab     = headers.indexOf('Es Día Inhábil');
  const idxVac       = headers.indexOf('Es Vacaciones');
  const idxEnf       = headers.indexOf('Es Enfermedad');
  const idxEntrada   = headers.findIndex(function(h){ return h && h.toString().includes('Entrada') && !h.toString().includes('Clasificación'); });

  const retardos = data.filter(function(row) {
    if (row[idxRetardo] !== 'SÍ') return false;
    if (idxInhab !== -1 && row[idxInhab] === 'SÍ') return false;
    if (idxVac   !== -1 && row[idxVac]   === 'SÍ') return false;
    if (idxEnf   !== -1 && row[idxEnf]   === 'SÍ') return false;
    return true;
  });
  if (retardos.length === 0) { container.innerHTML = '<div style="text-align:center;padding:40px;">✅ No hay retardos registrados</div>'; return; }

  // Agrupar por empleado → { Q1: [{fecha,min,hora}], Q2: [...] }
  const empleados = {};
  retardos.forEach(function(row) {
    const nombre = (row[idxNombre] || '').toString().trim(); if (!nombre) return;
    const fechaRaw = row[idxFecha];
    const fechaStr = typeof fechaRaw === 'string' ? fechaRaw.substring(0,10)
                   : (fechaRaw instanceof Date ? fechaRaw.toISOString().split('T')[0] : '');
    const dia = parseInt((fechaStr.split('-')[2] || '0'), 10);
    const q   = dia <= 15 ? 'Q1' : 'Q2';
    const min  = parseFloat(row[idxMinRetardo]) || 0;
    const hora = idxEntrada !== -1 ? (row[idxEntrada] || '') : '';
    if (!empleados[nombre]) empleados[nombre] = { Q1: [], Q2: [] };
    empleados[nombre][q].push({ fecha: fechaStr, minutos: min, hora: hora });
  });

  function fmtF(s) { if (!s) return ''; const p=s.split('-'); return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:s; }

  function descuento(n) {
    if (n < 3) return '';
    const med = Math.floor(n/3), dias = Math.floor(med/2), medio = med%2!==0;
    const txt = (dias>0&&medio)?dias+' día(s) y medio':(dias>0?dias+' día(s)':'medio día');
    return '<div style="padding:5px 8px;background:rgba(239,68,68,0.12);border-radius:6px;font-size:11px;color:#EF4444;font-weight:700;margin-bottom:6px;">⚠️ Descuento: ' + txt + '</div>';
  }

  function seccionQ(lista, qLabel, color) {
    if (!lista || lista.length === 0) return '';
    const filas = lista.slice().sort(function(a,b){return a.fecha.localeCompare(b.fecha);}).map(function(d) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(51,65,85,0.25);font-size:12px;">' +
        '<span style="color:#94A3B8;">' + fmtF(d.fecha) + (d.hora?' <span style="color:#64748B;font-size:10px;">(' + d.hora + ')</span>':'') + '</span>' +
        '<span style="color:#F59E0B;font-weight:700;">' + d.minutos.toFixed(0) + ' min</span></div>';
    }).join('');
    return '<div style="margin-bottom:10px;">' +
      '<div style="padding:3px 8px;background:' + color + ';border-radius:5px;font-size:10px;font-weight:800;color:#fff;letter-spacing:1px;margin-bottom:6px;">' + qLabel + ' (' + lista.length + ')</div>' +
      descuento(lista.length) + filas + '</div>';
  }

  let html = '<div class="employees-grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr));">';
  Object.keys(empleados).sort(function(a,b) {
    return (empleados[b].Q1.length+empleados[b].Q2.length)-(empleados[a].Q1.length+empleados[a].Q2.length);
  }).forEach(function(nombre) {
    const emp = empleados[nombre];
    const total = emp.Q1.length + emp.Q2.length;
    const totalMin = [...emp.Q1,...emp.Q2].reduce(function(s,r){return s+r.minutos;},0);
    const cuerpo = seccionQ(emp.Q1,'1ª QUINCENA  1–15','#1E3A5F') +
                   seccionQ(emp.Q2,'2ª QUINCENA  16–fin','#3B1F5F');
    html += '<div class="employee-card">' +
      '<div class="employee-name" style="display:flex;align-items:center;gap:12px;">' + crearAvatarElement(nombre, 40) + '<span style="font-weight:700;">' + nombre + '</span></div>' +
      '<div class="employee-stats">' +
        '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
          '<div class="stat-row" style="flex:1;margin:0;"><span class="label">Retardos:</span><span class="value" style="color:#F59E0B;font-size:18px;font-weight:700;">' + total + '</span></div>' +
          '<div class="stat-row" style="flex:1;margin:0;"><span class="label">Total min:</span><span class="value" style="color:#F59E0B;">' + totalMin.toFixed(0) + '</span></div>' +
        '</div>' +
        '<div style="max-height:280px;overflow-y:auto;">' + cuerpo + '</div>' +
      '</div>' +
      '<span class="badge ' + (total >= 3 ? 'badge-danger' : 'badge-warning') + '">' + (total >= 3 ? 'CRÍTICO' : 'ALERTA') + '</span>' +
    '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// Render Excesos — dividido por quincenas
function renderExcesos(result) {
  const container = document.getElementById('popup-container');
  if (!result || !result.data || result.data.length === 0) { container.innerHTML = '<div class="no-data">ℹ️ No hay datos disponibles</div>'; return; }
  currentData = { headers: result.headers, data: result.data.slice(), originalData: result.data.slice() };
  currentRenderFunction = renderExcesos;
  const headers = result.headers;
  const data = result.data;
  const idxNombre = encontrarColumnaDeNombres(headers);
  const idxFecha  = headers.indexOf('Fecha');
  const idxTurno  = headers.indexOf('Turno');
  const idxMinDes = headers.indexOf('Min. Desayuno');
  const idxMinCom = headers.indexOf('Min. Comida');
  const idxExcDes = headers.indexOf('Excedió Desayuno');
  const idxExcCom = headers.indexOf('Excedió Comida');
  const idxInhab  = headers.indexOf('Es Día Inhábil');
  const idxVac    = headers.indexOf('Es Vacaciones');
  const idxEnf    = headers.indexOf('Es Enfermedad');

  google.script.run
    .withSuccessHandler(function(configResult) { _procesarExcesos(data, headers, configResult, container); })
    .withFailureHandler(function() { _procesarExcesos(data, headers, null, container); })
    .getSheetData('CONFIG_TURNOS');
}

function _procesarExcesos(data, headers, configResult, container) {
  const idxNombre = encontrarColumnaDeNombres(headers);
  const idxFecha  = headers.indexOf('Fecha');
  const idxTurno  = headers.indexOf('Turno');
  const idxMinDes = headers.indexOf('Min. Desayuno');
  const idxMinCom = headers.indexOf('Min. Comida');
  const idxExcDes = headers.indexOf('Excedió Desayuno');
  const idxExcCom = headers.indexOf('Excedió Comida');
  const idxInhab  = headers.indexOf('Es Día Inhábil');
  const idxVac    = headers.indexOf('Es Vacaciones');
  const idxEnf    = headers.indexOf('Es Enfermedad');

  const limitesPorTurno = {};
  if (configResult && configResult.data) {
    configResult.data.forEach(function(row) { if (row[0]) limitesPorTurno[row[0]] = { des: row[8] || 25, com: row[12] || 65 }; });
  }

  function fmtF(s) { if (!s) return ''; const p=s.split('-'); return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:s; }

  // Agrupar por empleado → { Q1: { desayuno:[exc], comida:[exc] }, Q2: {...} }
  const empleados = {};

  data.forEach(function(row) {
    const nombre = (row[idxNombre] || '').toString().trim(); if (!nombre) return;
    if (idxInhab !== -1 && row[idxInhab] === 'SÍ') return;
    if (idxVac   !== -1 && row[idxVac]   === 'SÍ') return;
    if (idxEnf   !== -1 && row[idxEnf]   === 'SÍ') return;

    const fechaRaw = row[idxFecha];
    const fechaStr = typeof fechaRaw === 'string' ? fechaRaw.substring(0,10)
                   : (fechaRaw instanceof Date ? fechaRaw.toISOString().split('T')[0] : '');
    const dia = parseInt((fechaStr.split('-')[2]||'0'),10);
    const q   = dia <= 15 ? 'Q1' : 'Q2';
    const lim = limitesPorTurno[row[idxTurno]] || { des: 25, com: 65 };

    if (!empleados[nombre]) empleados[nombre] = { Q1:{des:[],com:[]}, Q2:{des:[],com:[]} };

    const minDes = parseFloat(row[idxMinDes]) || 0;
    if (minDes > 0 && (row[idxExcDes]==='SÍ'||row[idxExcDes]==='SI')) {
      const ex = Math.round(minDes - lim.des);
      if (ex > 0) empleados[nombre][q].des.push({ fecha: fechaStr, total: Math.round(minDes), limite: lim.des, exceso: ex });
    }
    const minCom = parseFloat(row[idxMinCom]) || 0;
    if (minCom > 0 && (row[idxExcCom]==='SÍ'||row[idxExcCom]==='SI')) {
      const ex2 = Math.round(minCom - lim.com);
      if (ex2 > 0) empleados[nombre][q].com.push({ fecha: fechaStr, total: Math.round(minCom), limite: lim.com, exceso: ex2 });
    }
  });

  // Filtrar empleados sin excesos reales
  const nombres = Object.keys(empleados).filter(function(n) {
    const e=empleados[n];
    return e.Q1.des.length||e.Q1.com.length||e.Q2.des.length||e.Q2.com.length;
  });

  if (nombres.length === 0) { container.innerHTML = '<div class="no-data" style="text-align:center;padding:40px;">✅ No hay excesos registrados</div>'; return; }

  function filaExceso(exc, icono, color) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(51,65,85,0.2);font-size:11px;">' +
      '<span style="color:#94A3B8;">' + icono + ' ' + fmtF(exc.fecha) + '</span>' +
      '<span style="color:' + color + ';font-weight:700;">+' + exc.exceso + ' min</span>' +
    '</div>';
  }

  function seccionQ(qData, qLabel, color) {
    const tieneAlgo = qData.des.length || qData.com.length;
    if (!tieneAlgo) return '';
    const totalExceso = [...qData.des,...qData.com].reduce(function(s,e){return s+e.exceso;},0);
    let filas = '';
    if (qData.des.length) filas += qData.des.sort(function(a,b){return a.fecha.localeCompare(b.fecha);}).map(function(e){return filaExceso(e,'🥐','#F59E0B');}).join('');
    if (qData.com.length) filas += qData.com.sort(function(a,b){return a.fecha.localeCompare(b.fecha);}).map(function(e){return filaExceso(e,'🍽️','#EF4444');}).join('');
    return '<div style="margin-bottom:10px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 8px;background:' + color + ';border-radius:5px;margin-bottom:6px;">' +
        '<span style="font-size:10px;font-weight:800;color:#fff;letter-spacing:1px;">' + qLabel + '</span>' +
        '<span style="font-size:10px;font-weight:700;color:#fff;">' + totalExceso + ' min exceso</span>' +
      '</div>' + filas + '</div>';
  }

  let html = '<div class="employees-grid">';
  nombres.sort(function(a,b) {
    function tot(n){const e=empleados[n];return e.Q1.des.length+e.Q1.com.length+e.Q2.des.length+e.Q2.com.length;}
    return tot(b)-tot(a);
  }).forEach(function(nombre) {
    const emp = empleados[nombre];
    const allExc = [...emp.Q1.des,...emp.Q1.com,...emp.Q2.des,...emp.Q2.com];
    const totalExceso = allExc.reduce(function(s,e){return s+e.exceso;},0);
    const totalInc = allExc.length;
    const cuerpo = seccionQ(emp.Q1,'1ª QUINCENA  1–15','#1E3A5F') +
                   seccionQ(emp.Q2,'2ª QUINCENA  16–fin','#3B1F5F');
    html += '<div class="employee-card">' +
      '<div class="employee-name" style="display:flex;align-items:center;gap:12px;">' + crearAvatarElement(nombre, 40) + '<span style="font-weight:700;">' + nombre + '</span></div>' +
      '<div class="employee-stats">' +
        '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
          '<div class="stat-row" style="flex:1;margin:0;"><span class="label">Exceso total:</span><span class="value" style="color:#F59E0B;font-weight:700;">' + totalExceso + ' min</span></div>' +
          '<div class="stat-row" style="flex:1;margin:0;"><span class="label">Incidencias:</span><span class="value">' + totalInc + '</span></div>' +
        '</div>' +
        '<div style="max-height:280px;overflow-y:auto;">' + cuerpo + '</div>' +
      '</div>' +
      '<span class="badge ' + (totalExceso > 60 ? 'badge-danger' : 'badge-warning') + '">' + (totalExceso > 60 ? '🚨 CRÍTICO' : '🍽️ EXCESO') + '</span>' +
    '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderVacaciones(result) {
  if (!result || !result.data || result.data.length === 0) { document.getElementById('popup-container').innerHTML = '<div style="text-align:center;padding:40px;">ℹ️ No hay datos de vacaciones</div>'; return; }
  if (!window.currentData || !window.currentData.originalData || window.currentData.originalData.length === 0) {
    currentData = { headers: result.headers, data: result.data.slice(), originalData: result.data.slice() };
  } else { window.currentData.headers = result.headers; window.currentData.data = result.data.slice(); }
  currentRenderFunction = renderVacaciones;
  const container = document.getElementById('popup-container');
  const headers = result.headers;
  const data = result.data;
  const idxNombre = encontrarColumnaDeNombres(headers);
  const idxFecha = headers.indexOf('Fecha');
  const idxVacaciones = headers.indexOf('Es Vacaciones');
  const vacaciones = data.filter(row => row[idxVacaciones] === 'SÍ' || row[idxVacaciones] === 'SI' || row[idxVacaciones] === true);
  if (vacaciones.length === 0) { container.innerHTML = '<div style="text-align:center;padding:40px;">✅ No hay empleados de vacaciones actualmente</div>'; return; }
  const empleados = {};
  vacaciones.forEach(row => {
    const nombre = row[idxNombre];
    if (!empleados[nombre]) empleados[nombre] = { fechas: [], totalDias: 0 };
    empleados[nombre].fechas.push(row[idxFecha]);
    empleados[nombre].totalDias++;
  });
  const empleadosOrdenados = Object.keys(empleados).sort();
  const todasLasFechas = vacaciones.map(row => new Date(row[idxFecha]));
  const fechaMin = new Date(Math.min(...todasLasFechas));
  const fechaMax = new Date(Math.max(...todasLasFechas));
  let html = renderCalendarioVacaciones(empleados, fechaMin, fechaMax);
  const totalEmpleados = empleadosOrdenados.length;
  const totalDiasVacaciones = Object.values(empleados).reduce((sum, emp) => sum + emp.totalDias, 0);
  const resumen = '<div style="background:rgba(16,185,129,0.1);border:2px solid var(--success);border-radius:12px;padding:20px;margin-bottom:24px;"><div style="display:flex;justify-content:space-around;text-align:center;"><div><div style="font-size:32px;font-weight:700;color:var(--success);">' + totalEmpleados + '</div><div style="color:var(--text-secondary);font-size:14px;">Empleados</div></div><div style="width:1px;background:var(--border-color);"></div><div><div style="font-size:32px;font-weight:700;color:var(--success);">' + totalDiasVacaciones + '</div><div style="color:var(--text-secondary);font-size:14px;">Días Totales</div></div><div style="width:1px;background:var(--border-color);"></div><div><div style="font-size:32px;font-weight:700;color:var(--success);">' + (totalDiasVacaciones / totalEmpleados).toFixed(1) + '</div><div style="color:var(--text-secondary);font-size:14px;">Promedio/Empleado</div></div></div></div>';
  html += '<div class="employees-grid">';
  Promise.all([
    new Promise((resolve, reject) => { google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getConfigTurnos(); }),
    new Promise((resolve, reject) => { google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getEmpleadosConFechaContratacion(); })
  ]).then(([configResult, empleadosResult]) => {
    empleadosOrdenados.forEach(nombre => { html += renderTarjetaVacaciones(nombre, empleados[nombre], configResult, empleadosResult); });
    html += '</div>';
    container.innerHTML = resumen + html;
  }).catch(() => {
    empleadosOrdenados.forEach(nombre => { html += renderTarjetaVacaciones(nombre, empleados[nombre], null, null); });
    html += '</div>';
    container.innerHTML = resumen + html;
  });
}

function renderCalendarioVacaciones(empleados, fechaMin, fechaMax) {
  const meses = [];
  let currentDate = new Date(fechaMin.getFullYear(), fechaMin.getMonth(), 1);
  const endDate = new Date(fechaMax.getFullYear(), fechaMax.getMonth() + 1, 0);
  while (currentDate <= endDate) { meses.push(new Date(currentDate)); currentDate.setMonth(currentDate.getMonth() + 1); }
  let html = '<div style="background:rgba(30,41,59,0.25);backdrop-filter:blur(8px);border:1px solid var(--border-color);border-radius:16px;padding:24px;margin-bottom:32px;"><h3 style="margin-bottom:20px;color:var(--text-primary);">📅 Calendario de Vacaciones</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;">';
  meses.forEach(mes => { html += renderMesCalendario(mes, empleados); });
  html += '</div></div>';
  return html;
}

function renderMesCalendario(mes, empleados) {
  const nombreMes = mes.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  const primerDia = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const ultimoDia = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
  let html = '<div style="border:1px solid rgba(148,163,184,0.2);border-radius:8px;padding:12px;"><div style="font-size:14px;font-weight:700;text-align:center;margin-bottom:12px;color:var(--primary);text-transform:capitalize;">' + nombreMes + '</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">';
  ['D','L','M','M','J','V','S'].forEach(d => { html += '<div style="text-align:center;font-size:11px;color:var(--text-secondary);font-weight:600;padding:4px;">' + d + '</div>'; });
  for (let i = 0; i < primerDia.getDay(); i++) html += '<div></div>';
  for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
    const fechaActual = new Date(mes.getFullYear(), mes.getMonth(), dia);
    const fechaStr = fechaActual.toISOString().split('T')[0];
    const enVac = [];
    for (const [nombre, emp] of Object.entries(empleados)) {
      if (emp.fechas.some(f => new Date(f).toISOString().split('T')[0] === fechaStr)) enVac.push(nombre);
    }
    const esVac = enVac.length > 0;
    const badge = enVac.length > 1 ? '<div style="position:absolute;top:-4px;right:-4px;background:var(--danger);border-radius:50%;width:14px;height:14px;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700;">' + enVac.length + '</div>' : '';
    html += '<div style="text-align:center;padding:6px 4px;font-size:12px;background:' + (esVac ? 'rgba(16,185,129,0.6)' : 'rgba(51,65,85,0.2)') + ';border-radius:4px;color:' + (esVac ? '#fff' : 'var(--text-secondary)') + ';font-weight:' + (esVac ? '700' : '400') + ';cursor:' + (esVac ? 'pointer' : 'default') + ';position:relative;"' + (esVac ? ' title="' + enVac.join(', ') + '"' : '') + '>' + dia + badge + '</div>';
  }
  html += '</div></div>';
  return html;
}

function renderTarjetaVacaciones(nombre, emp, configResult, empleadosResult) {
  const fechasOrdenadas = emp.fechas.sort((a, b) => new Date(a) - new Date(b));
  const fechaInicio = new Date(fechasOrdenadas[0]);
  const fechaFin = new Date(fechasOrdenadas[fechasOrdenadas.length - 1]);
  const rangoTexto = fechaInicio.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) + ' - ' + fechaFin.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  const detallesHTML = fechasOrdenadas.map(f => {
    const ff = new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(51,65,85,0.3);font-size:13px;"><span style="color:var(--text-secondary);">' + ff + '</span><span style="color:var(--success);font-weight:600;"></span></div>';
  }).join('');
  let vacacionesInfo = '';
  if (configResult && !configResult.error && empleadosResult && !empleadosResult.error) {
    const fechaContratacion = empleadosResult.empleados[nombre];
    if (fechaContratacion) {
      const años = calcularAñosTrabajados(fechaContratacion);
      const diasCorrp = calcularDiasVacaciones(años, configResult);
      const diasRest = diasCorrp - emp.totalDias;
      vacacionesInfo = '<div style="margin-top:12px;padding:10px;background:rgba(59,130,246,0.08);border-radius:8px;font-size:13px;"><div style="display:flex;justify-content:space-between;"><span style="color:var(--text-secondary);">Años:</span><span style="font-weight:600;">' + años + '</span></div><div style="display:flex;justify-content:space-between;"><span style="color:var(--text-secondary);">Le corresponden:</span><span style="color:var(--success);font-weight:600;">' + diasCorrp + '</span></div><div style="display:flex;justify-content:space-between;border-top:1px solid rgba(148,163,184,.3);margin-top:6px;padding-top:6px;"><span style="font-weight:600;">Restantes:</span><span style="font-weight:700;color:' + (diasRest >= 0 ? 'var(--success)' : 'var(--danger)') + ';">' + diasRest + '</span></div></div>';
    }
  }
  return '<div class="employee-card"><div class="employee-name" style="display:flex;align-items:center;gap:12px;">' + crearAvatarElement(nombre, 40) + '<span style="font-weight:700;">' + nombre + '</span></div><div class="employee-stats"><div class="stat-row"><span class="label">Periodo:</span><span class="value" style="font-size:12px;">' + rangoTexto + '</span></div><div class="stat-row"><span class="label">Días tomando:</span><span class="value" style="color:var(--success);font-size:18px;font-weight:700;">' + emp.totalDias + '</span></div>' + vacacionesInfo + '<div style="margin-top:14px;max-height:200px;overflow-y:auto;"><div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;font-weight:600;text-transform:uppercase;">Detalles por día:</div>' + detallesHTML + '</div></div><span class="badge badge-success">VACACIONES</span></div>';
}

function calcularAñosTrabajados(fechaContratacion) {
  const fechaContr = new Date(fechaContratacion);
  const hoy = new Date();
  let años = hoy.getFullYear() - fechaContr.getFullYear();
  const mesesDif = hoy.getMonth() - fechaContr.getMonth();
  if (mesesDif < 0 || (mesesDif === 0 && hoy.getDate() < fechaContr.getDate())) años--;
  return Math.max(0, años);
}

function calcularDiasVacaciones(añosTrabajados, configResult) {
  if (!configResult || !configResult.data) return 0;
  const idxAños = configResult.headers.indexOf('Años trabajados') || 15;
  const idxDias = configResult.headers.indexOf('Vacaciones') || 16;
  for (let i = 0; i < configResult.data.length; i++) {
    if (añosTrabajados <= (parseInt(configResult.data[i][idxAños]) || 0)) return parseInt(configResult.data[i][idxDias]) || 0;
  }
  return parseInt(configResult.data[configResult.data.length - 1][idxDias]) || 0;
}

function renderEnfermedades(result) {
  const container = document.getElementById('popup-container');
  if (!result || result.error || !result.enfermedades || result.enfermedades.length === 0) { container.innerHTML = '<div style="text-align:center;padding:40px;">✅ No hay registros de enfermedades en el período procesado</div>'; return; }
  currentRenderFunction = renderEnfermedades;
  const empleados = {};
  result.enfermedades.forEach(function(e) { if (!empleados[e.nombre]) empleados[e.nombre] = []; empleados[e.nombre].push(e.fecha); });
  if (Object.keys(empleados).length === 0) { container.innerHTML = '<div style="text-align:center;padding:40px;">✅ No hay registros de enfermedades en el período procesado</div>'; return; }
  const empleadosOrdenados = Object.keys(empleados).sort((a, b) => a.localeCompare(b, 'es'));
  let html = '<div class="employees-grid">';
  empleadosOrdenados.forEach(nombre => {
    const fechas = empleados[nombre];
    const fechasFormateadas = fechas.slice(0, 5).map(f => new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })).join(', ') + (fechas.length > 5 ? '...' : '');
    html += '<div class="employee-card"><div class="employee-name" style="display:flex;align-items:center;gap:12px;">' + crearAvatarElement(nombre, 40) + '<span>' + nombre + '</span></div><div class="employee-stats"><div class="stat-row"><span class="label">🏥 Total Días Enfermedad:</span><span class="value" style="color:#F59E0B;font-size:18px;font-weight:700;">' + fechas.length + '</span></div><div class="stat-row"><span class="label">📅 Fechas:</span><span class="value" style="font-size:12px;color:#94A3B8;">' + fechasFormateadas + '</span></div></div><span class="badge badge-warning">🏥 ENFERMEDAD</span></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderAlertas(result) {
  // result viene de la hoja ALERTAS (Tipo, ID, Nombre, Mes, Cantidad, Mensaje, Severidad)
  if (!window.currentData || !window.currentData.originalData || window.currentData.originalData.length === 0) {
    if (result && result.data) currentData = { headers: result.headers, data: result.data.slice(), originalData: result.data.slice() };
  } else if (result && result.data) {
    window.currentData.headers = result.headers; window.currentData.data = result.data.slice();
  }
  currentRenderFunction = renderAlertas;
  const container = document.getElementById('popup-container');
  container.innerHTML = '<div style="text-align:center;padding:40px;">⏳ Cargando alertas...</div>';

  // Cargar METRICAS_DIARIAS (fuente principal: faltas, retardos, excesos día a día)
  // e incidencias en paralelo
  var rMetricas = null, rIncidencias = null;
  var pendientes = 2;

  function continuar() {
    if (--pendientes > 0) return;
    _construirAlertas(result, rMetricas, rIncidencias, container);
  }

  google.script.run
    .withSuccessHandler(function(raw) { rMetricas = safeResult(raw); continuar(); })
    .withFailureHandler(function() { rMetricas = null; continuar(); })
    .getSheetData('METRICAS_DIARIAS');

  google.script.run
    .withSuccessHandler(function(raw) { rIncidencias = raw; continuar(); })
    .withFailureHandler(function() { rIncidencias = null; continuar(); })
    .getIncidenciasEmpleados('todas');
}

function _construirAlertas(resultAlertas, rM, rIncidencias, container) {
  // ── Rango de fechas del período analizado ─────────────────────────────
  var strMin = null, strMax = null;
  var hM = [], dataM = [];
  if (rM && !rM.error && rM.data && rM.data.length > 0) {
    hM = rM.headers || []; dataM = rM.data;
    const iFM = hM.indexOf('Fecha');
    dataM.forEach(function(row) {
      const f = row[iFM]; if (!f) return;
      var d; try { d = new Date(f); } catch(e) { return; }
      if (isNaN(d.getTime())) return;
      const s = d.toISOString().split('T')[0];
      if (!strMin || s < strMin) strMin = s;
      if (!strMax || s > strMax) strMax = s;
    });
  }

  // ── Índices METRICAS_DIARIAS ──────────────────────────────────────────
  const iNomM   = encontrarColumnaDeNombres(hM);
  const iFechaM = hM.indexOf('Fecha');
  const iFaltaM = hM.indexOf('Es Falta');
  const iRetM   = hM.indexOf('Es Retardo');
  const iVacM   = hM.indexOf('Es Vacaciones');
  const iInhabM = hM.indexOf('Es Día Inhábil');
  const iEnfM   = hM.indexOf('Es Enfermedad');
  const iMinDes = hM.indexOf('Min. Desayuno');
  const iMinCom = hM.indexOf('Min. Comida');
  const iExcDes = hM.indexOf('Excedió Desayuno');
  const iExcCom = hM.indexOf('Excedió Comida');
  const iMinRet = hM.indexOf('Min. Retardo');
  const iEntrada = hM.findIndex(function(h) { return h && h.toString().includes('Entrada') && !h.toString().includes('Clasificación'); });

  function fmtFecha(f) {
    if (!f) return '';
    var s = typeof f === 'string' ? f : (f instanceof Date ? f.toISOString() : '');
    s = s.substring(0, 10);
    var parts = s.split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : s;
  }

  // quincena: 'Q1' si día <= 15, 'Q2' si día >= 16, 'SIN_FECHA' si no hay fecha
  function quincena(fechaStr) {
    if (!fechaStr) return 'SIN_FECHA';
    var d = parseInt((fechaStr.split('-')[2] || '0'), 10);
    return d <= 15 ? 'Q1' : 'Q2';
  }

  // ── Estructura: alertasPorEmpleado[nombre][quincena] = [alertas] ──────
  // quincenas: 'Q1', 'Q2', 'SIN_FECHA' (para alertas sin fecha exacta: acumulados, excesos)
  var alertasPorEmpleado = {};

  function addAlerta(nombre, tipo, fechaStr, mensaje) {
    if (!nombre) return;
    if (!alertasPorEmpleado[nombre]) alertasPorEmpleado[nombre] = { Q1: [], Q2: [], SIN_FECHA: [] };
    var q = quincena(fechaStr);
    alertasPorEmpleado[nombre][q].push({ tipo: tipo, fecha: fmtFecha(fechaStr), mensaje: mensaje || '' });
  }

  // ── Acumuladores ──────────────────────────────────────────────────────
  var faltasPorEmp      = {}; // { nombre: { Q1:[fechas], Q2:[fechas] } }
  var retardosPorEmp    = {}; // { nombre: { Q1:[{fecha,min,hora}], Q2:[...] } }
  var excDesayunoPorEmp = {}; // { nombre: { Q1: min, Q2: min } }
  var excComidaPorEmp   = {}; // { nombre: { Q1: min, Q2: min } }

  dataM.forEach(function(row) {
    const nombre = (row[iNomM] || '').toString().trim(); if (!nombre) return;
    if (iInhabM !== -1 && row[iInhabM] === 'SÍ') return;
    if (iVacM   !== -1 && row[iVacM]   === 'SÍ') return;
    if (iEnfM   !== -1 && row[iEnfM]   === 'SÍ') return;

    const fechaRaw = row[iFechaM] || '';
    const fechaStr = typeof fechaRaw === 'string' ? fechaRaw.substring(0,10) :
                     (fechaRaw instanceof Date ? fechaRaw.toISOString().split('T')[0] : '');
    const q = quincena(fechaStr);

    if (iFaltaM !== -1 && row[iFaltaM] === 'SÍ') {
      if (!faltasPorEmp[nombre]) faltasPorEmp[nombre] = { Q1: [], Q2: [] };
      faltasPorEmp[nombre][q] = faltasPorEmp[nombre][q] || [];
      faltasPorEmp[nombre][q].push(fechaStr);
    }

    if (iRetM !== -1 && row[iRetM] === 'SÍ') {
      var min = iMinRet !== -1 ? (parseInt(row[iMinRet]) || 0) : 0;
      var hora = iEntrada !== -1 ? (row[iEntrada] || '') : '';
      if (!retardosPorEmp[nombre]) retardosPorEmp[nombre] = { Q1: [], Q2: [] };
      retardosPorEmp[nombre][q] = retardosPorEmp[nombre][q] || [];
      retardosPorEmp[nombre][q].push({ fecha: fechaStr, minutos: min, hora: hora });
    }

    if (iExcDes !== -1 && (row[iExcDes] === 'SÍ' || row[iExcDes] === 'SI')) {
      var minD = parseFloat(row[iMinDes]) || 0;
      if (minD > 0) {
        if (!excDesayunoPorEmp[nombre]) excDesayunoPorEmp[nombre] = { Q1: 0, Q2: 0 };
        excDesayunoPorEmp[nombre][q] = (excDesayunoPorEmp[nombre][q] || 0) + minD;
      }
    }

    if (iExcCom !== -1 && (row[iExcCom] === 'SÍ' || row[iExcCom] === 'SI')) {
      var minC = parseFloat(row[iMinCom]) || 0;
      if (minC > 0) {
        if (!excComidaPorEmp[nombre]) excComidaPorEmp[nombre] = { Q1: 0, Q2: 0 };
        excComidaPorEmp[nombre][q] = (excComidaPorEmp[nombre][q] || 0) + minC;
      }
    }
  });

  // ── Faltas ────────────────────────────────────────────────────────────
  Object.keys(faltasPorEmp).forEach(function(nombre) {
    var data = faltasPorEmp[nombre];
    ['Q1','Q2'].forEach(function(q) {
      (data[q] || []).forEach(function(f) {
        addAlerta(nombre, 'FALTA', f, 'Falta injustificada');
      });
      var n = (data[q] || []).length;
      if (n >= 3) addAlerta(nombre, 'FALTAS_CRÍTICAS', null, n + ' faltas en ' + q + ' — nivel crítico');
    });
  });

  // ── Retardos ──────────────────────────────────────────────────────────
  Object.keys(retardosPorEmp).forEach(function(nombre) {
    var data = retardosPorEmp[nombre];
    ['Q1','Q2'].forEach(function(q) {
      var lista = data[q] || [];
      lista.forEach(function(r) {
        var msg = 'Llegó tarde' + (r.hora ? ' (' + r.hora + ')' : '') + (r.minutos > 0 ? ' — ' + r.minutos + ' min' : '');
        addAlerta(nombre, 'RETARDO', r.fecha, msg);
      });
      if (lista.length >= 3) {
        var medios = Math.floor(lista.length / 3);
        var dias = Math.floor(medios / 2), medio = medios % 2 !== 0;
        var desc = (dias > 0 && medio) ? dias + ' día(s) y medio' : (dias > 0 ? dias + ' día(s)' : 'medio día');
        addAlerta(nombre, 'RETARDOS_ACUMULADOS', null, lista.length + ' retardos en ' + q + ' → descuento: ' + desc);
      }
    });
  });

  // ── Excesos desayuno ──────────────────────────────────────────────────
  Object.keys(excDesayunoPorEmp).forEach(function(nombre) {
    var data = excDesayunoPorEmp[nombre];
    ['Q1','Q2'].forEach(function(q) {
      var total = data[q] || 0;
      if (total > 15) addAlerta(nombre, 'EXCESO_DESAYUNO', null, Math.round(total) + ' min acumulados en desayuno (' + q + ')');
    });
  });

  // ── Excesos comida ────────────────────────────────────────────────────
  Object.keys(excComidaPorEmp).forEach(function(nombre) {
    var data = excComidaPorEmp[nombre];
    ['Q1','Q2'].forEach(function(q) {
      var total = data[q] || 0;
      if (total > 30) addAlerta(nombre, 'EXCESO_COMIDA', null, Math.round(total) + ' min acumulados en comida (' + q + ')');
    });
  });

  // ── Incidencias ───────────────────────────────────────────────────────
  if (rIncidencias && rIncidencias.incidencias) {
    rIncidencias.incidencias.forEach(function(inc) {
      const nombre = (inc.empleado || '').toString().trim(); if (!nombre) return;
      if (strMin && strMax && inc.fecha) {
        const f = inc.fecha.length >= 10 ? inc.fecha.substring(0,10) : inc.fecha;
        if (f < strMin || f > strMax) return;
      }
      addAlerta(nombre, 'INCIDENCIA', inc.fecha ? inc.fecha.substring(0,10) : '', inc.actividad || 'INCIDENCIA');
    });
  }

  // ── Hoja ALERTAS (solo tipos no duplicados: FALTAS_QUINCENA, etc.) ────
  if (resultAlertas && resultAlertas.data && resultAlertas.headers) {
    const hA = resultAlertas.headers;
    const idxTipoA = hA.indexOf('Tipo'), idxNomA = encontrarColumnaDeNombres(hA);
    const idxMsgA  = hA.indexOf('Mensaje'), idxMesA = hA.indexOf('Mes');
    resultAlertas.data.forEach(function(row) {
      const tipo = (row[idxTipoA] || '').toString();
      if (['RETARDOS','FALTAS'].indexOf(tipo) !== -1) return;
      if (tipo.includes('SIN_SALIDA')) return;
      const nombre = (row[idxNomA] || '').toString().trim(); if (!nombre) return;
      addAlerta(nombre, tipo, null, (row[idxMsgA] || '').toString());
    });
  }

  // ── Render ────────────────────────────────────────────────────────────
  if (Object.keys(alertasPorEmpleado).length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;">✅ No hay alertas activas en el período</div>';
    return;
  }

  const ICONOS = { 'FALTA':'❌','FALTAS_CRÍTICAS':'🚨','RETARDO':'⏰','RETARDOS_ACUMULADOS':'⏰','EXCESO_DESAYUNO':'🥐','EXCESO_COMIDA':'🍽️','INCIDENCIA':'🚨' };
  const CTIPO  = { 'FALTA':'#EF4444','FALTAS_CRÍTICAS':'#DC2626','RETARDO':'#F59E0B','RETARDOS_ACUMULADOS':'#EF4444','EXCESO_DESAYUNO':'#F59E0B','EXCESO_COMIDA':'#F59E0B','INCIDENCIA':'#EF4444' };

  // Determinar rango de quincenas del período para mostrar solo las que aplican
  var tieneQ1 = strMin && parseInt(strMin.split('-')[2],10) <= 15;
  var tieneQ2 = strMax && parseInt(strMax.split('-')[2],10) >= 16;
  // Si el período abarca ambas quincenas, mostrar ambas; si no, solo la que toca
  if (!strMin) { tieneQ1 = true; tieneQ2 = true; }

  function renderSeccionQ(alertas, qLabel, color) {
    if (!alertas || alertas.length === 0) return '';
    return '<div style="margin-bottom:8px;padding:4px 8px;background:' + color + ';border-radius:6px;font-size:10px;font-weight:800;letter-spacing:1px;color:#fff;">' + qLabel + '</div>' +
      alertas.map(function(a) {
        var ic = ICONOS[a.tipo] || '⚠️', ct = CTIPO[a.tipo] || '#F59E0B';
        return '<div style="padding:8px 10px;background:rgba(15,23,42,0.4);border-radius:7px;border-left:3px solid ' + ct + ';margin-bottom:5px;">' +
          '<div style="display:flex;align-items:center;gap:7px;margin-bottom:3px;">' +
            '<span>' + ic + '</span>' +
            '<span style="font-weight:700;color:' + ct + ';font-size:11px;text-transform:uppercase;letter-spacing:.4px;">' + a.tipo.replace(/_/g,' ') + '</span>' +
            (a.fecha ? '<span style="margin-left:auto;font-size:10px;color:#94A3B8;">📅 ' + a.fecha + '</span>' : '') +
          '</div>' +
          '<div style="font-size:11px;color:#CBD5E1;line-height:1.4;">' + a.mensaje + '</div>' +
        '</div>';
      }).join('');
  }

  const periodoLabel = strMin && strMax
    ? '<div style="font-size:11px;color:#64748B;">Período: ' + fmtFecha(strMin) + ' al ' + fmtFecha(strMax) + '</div>'
    : '';

  const empleadosOrdenados = Object.keys(alertasPorEmpleado).sort(function(a,b){return a.localeCompare(b,'es');});
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' + periodoLabel +
    '<button onclick="renderAlertas(currentData||{})" style="padding:8px 16px;background:linear-gradient(135deg,#3B82F6,#2563EB);border:none;border-radius:8px;color:white;font-weight:700;font-size:12px;cursor:pointer;">↻ Recargar</button>' +
    '</div><div class="employees-grid">';

  empleadosOrdenados.forEach(function(nombre) {
    var bloques = alertasPorEmpleado[nombre];
    var todasQ1 = bloques.Q1 || [], todasQ2 = bloques.Q2 || [], todasSF = bloques.SIN_FECHA || [];
    var total = todasQ1.length + todasQ2.length + todasSF.length;
    if (total === 0) return;

    var tieneCriticas = [].concat(todasQ1,todasQ2,todasSF).some(function(a) {
      return ['FALTA','FALTAS_CRÍTICAS','RETARDOS_ACUMULADOS','INCIDENCIA'].some(function(t){return a.tipo.includes(t);});
    });
    var color = tieneCriticas ? '#EF4444' : '#F59E0B';

    // Secciones por quincena
    var secQ1 = (tieneQ1 || todasQ1.length > 0) ? renderSeccionQ(todasQ1, '1ª QUINCENA  (1–15)', '#1E3A5F') : '';
    var secQ2 = (tieneQ2 || todasQ2.length > 0) ? renderSeccionQ(todasQ2, '2ª QUINCENA (16–fin)', '#3B1F5F') : '';
    // Alertas sin quincena específica (acumulados de período completo, hoja ALERTAS, etc.)
    var secSF = todasSF.length > 0 ? renderSeccionQ(todasSF, 'PERÍODO COMPLETO', '#1F3D2F') : '';

    html += '<div class="employee-card">' +
      '<div class="employee-name" style="display:flex;align-items:center;gap:12px;">' + crearAvatarElement(nombre, 40) +
        '<span style="font-weight:700;">' + nombre + '</span>' +
      '</div>' +
      '<div class="employee-stats">' +
        '<div class="stat-row" style="background:' + (tieneCriticas?'rgba(239,68,68,0.1)':'rgba(245,158,11,0.1)') + ';padding:8px 10px;border-radius:8px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="font-size:11px;color:#94A3B8;font-weight:600;">Total alertas</span>' +
          '<span style="color:' + color + ';font-size:20px;font-weight:700;">' + total + '</span>' +
        '</div>' +
        '<div style="max-height:360px;overflow-y:auto;padding-right:4px;">' +
          secQ1 + secQ2 + secSF +
        '</div>' +
      '</div>' +
      '<span class="badge ' + (tieneCriticas?'badge-danger':'badge-warning') + '">' + (tieneCriticas?'CRÍTICO':'ALERTA') + ' (' + total + ')</span>' +
    '</div>';
  });

  html += '</div>';
  container.innerHTML = html;
}



function renderModuloEnConstruccion(nombreModulo) {
  const popup = document.getElementById('module-popup');
  const container = document.getElementById('popup-container');
  popup.classList.add('active');
  document.getElementById('popup-title').textContent = nombreModulo;
  container.innerHTML = '<div style="text-align:center;padding:80px 20px;"><div style="font-size:80px;margin-bottom:24px;animation:bounce 2s infinite;">🚧</div><h2 style="font-size:28px;font-weight:700;margin-bottom:12px;color:var(--text-primary);">Módulo en Construcción</h2><p style="font-size:16px;color:var(--text-secondary);margin-bottom:32px;max-width:500px;margin-left:auto;margin-right:auto;line-height:1.6;">El módulo de <strong>' + nombreModulo + '</strong> estará disponible próximamente.</p><div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:12px;padding:20px;max-width:500px;margin:0 auto;"><div style="font-size:14px;color:var(--text-secondary);line-height:1.8;">✅ Interfaz en desarrollo<br>✅ Base de datos en configuración<br>✅ Funcionalidades en pruebas</div></div></div>';
}

function loadBonoPuntualidad() {
  // ⭐ Usar window.pendingRequest para evitar ReferenceError. La primera vez
  // que se ejecuta esta función, leer `pendingRequest` (sin declarar) tira
  // ReferenceError. window.pendingRequest es seguro: undefined si no existe.
  if (window.pendingRequest) window.pendingRequest = null;
  const requestId = Date.now();
  window.pendingRequest = requestId;
  document.getElementById('popup-title').textContent = 'Bono de Puntualidad';
  google.script.run
    .withSuccessHandler(function(result) {
      if (window.pendingRequest !== requestId) return;
      if (result.error) { document.getElementById('popup-container').innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);">❌ Error: ' + result.message + '</div>'; return; }
      renderBonoPuntualidad(result);
      window.pendingRequest = null;
    })
    .withFailureHandler(function(err) {
      if (window.pendingRequest !== requestId) return;
      document.getElementById('popup-container').innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);">❌ Error: ' + err.message + '</div>';
      window.pendingRequest = null;
    })
    .getBonoPuntualidad();
}

function renderBonoPuntualidad(result) {
  const container = document.getElementById('popup-container');
  if (!result || result.error || !result.metadata) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);">❌ ' + (result ? result.message : 'No se recibieron datos') + '</div>';
    return;
  }
  currentData = { headers: result.headers || [], data: result.data || [], originalData: result.data || [] };
  currentRenderFunction = renderBonoPuntualidad;

  const res = result.metadata.resultado;
  if (!res) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);">❌ Sin datos de quincenas</div>';
    return;
  }

  function tarjetaResumen(icon, label, val, color) {
    return '<div style="flex:1;background:rgba(30,41,59,0.6);border:1px solid ' + color + '33;border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:10px;">' +
      '<span style="font-size:24px;">' + icon + '</span>' +
      '<div><div style="font-size:10px;color:#94A3B8;font-weight:700;letter-spacing:1px;text-transform:uppercase;">' + label + '</div>' +
      '<div style="font-size:28px;font-weight:800;color:' + color + ';">' + val + '</div></div>' +
    '</div>';
  }

  function renderEmpBono(emp) {
    return '<div class="ranking-item" style="margin-bottom:6px;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        crearAvatarElement(emp.nombre, 36) +
        '<div style="font-size:13px;font-weight:600;color:#F1F5F9;">' + emp.nombre + '</div>' +
      '</div>' +
      '<span class="ranking-badge badge-success" style="white-space:nowrap;font-size:11px;">✅ BONO</span>' +
    '</div>';
  }

  function renderEmpTol(emp) {
    var dets = (emp.detalles || []).map(function(d) {
      return '<span style="display:inline-block;padding:2px 8px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:4px;font-size:10px;color:#F59E0B;margin:2px;">📅 ' + d.fecha + ' ' + d.hora + '</span>';
    }).join('');
    return '<div class="ranking-item" style="flex-direction:column;align-items:flex-start;gap:5px;margin-bottom:8px;">' +
      '<div style="display:flex;align-items:center;gap:10px;width:100%;">' +
        crearAvatarElement(emp.nombre, 36) +
        '<div style="flex:1;font-size:13px;font-weight:600;color:#F1F5F9;">' + emp.nombre + '</div>' +
        '<span class="ranking-badge badge-warning" style="white-space:nowrap;font-size:11px;">⚠️ TOL</span>' +
      '</div>' +
      (dets ? '<div style="padding-left:46px;margin-top:2px;">' + dets + '</div>' : '') +
    '</div>';
  }

  function columnaQ(qKey, qLabel, colorBono, colorTol, bgBono, bgTol) {
    var bonoList  = res[qKey].bono;
    var tolList   = res[qKey].tolerancia;
    return '<div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px;">' +
      // Header quincena
      '<div style="font-size:13px;font-weight:800;letter-spacing:.8px;color:#F1F5F9;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.08);">' + qLabel + '</div>' +

      // Sub-header BONO
      '<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:' + colorBono + ';text-transform:uppercase;margin-bottom:8px;">🏆 BONO PERFECTO (' + bonoList.length + ')</div>' +
      (bonoList.length === 0
        ? '<div style="font-size:11px;color:#4B5563;padding:8px 0;margin-bottom:12px;">Sin empleados con bono</div>'
        : '<div style="margin-bottom:14px;">' + bonoList.map(renderEmpBono).join('') + '</div>'
      ) +

      // Separador
      '<div style="height:1px;background:rgba(255,255,255,0.06);margin-bottom:12px;"></div>' +

      // Sub-header TOLERANCIA
      '<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:' + colorTol + ';text-transform:uppercase;margin-bottom:8px;">⚠️ TOLERANCIA (' + tolList.length + ')</div>' +
      (tolList.length === 0
        ? '<div style="font-size:11px;color:#4B5563;padding:8px 0;">Sin empleados en tolerancia</div>'
        : tolList.map(renderEmpTol).join('')
      ) +
    '</div>';
  }

  var q1Bono = res.Q1.bono.length, q1Tol = res.Q1.tolerancia.length;
  var q2Bono = res.Q2.bono.length, q2Tol = res.Q2.tolerancia.length;

  var html =
    // ── Resumen 4 tarjetas ──
    '<div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;">' +
      tarjetaResumen('🏆', '1ª Quincena — Bono', q1Bono, '#10B981') +
      tarjetaResumen('⚠️', '1ª Quincena — Tolerancia', q1Tol, '#F59E0B') +
      tarjetaResumen('🏆', '2ª Quincena — Bono', q2Bono, '#10B981') +
      tarjetaResumen('⚠️', '2ª Quincena — Tolerancia', q2Tol, '#F59E0B') +
    '</div>' +

    // ── Dos columnas: Q1 | Q2 ──
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
      columnaQ('Q1', '🔵 1ª QUINCENA  (días 1–15)', '#10B981', '#F59E0B') +
      columnaQ('Q2', '🟣 2ª QUINCENA  (días 16–fin)', '#10B981', '#F59E0B') +
    '</div>';

  container.innerHTML = html;
}

// ============================================================================
// BONOS POSITIVOS — Reconocimientos por quincena
// ============================================================================
// Muestra 3 secciones en un solo módulo:
//   💰 Bono Puntualidad — quien ganó bono perfecto esta quincena
//   🎂 Bono Cumpleañero — quien cumple años en esta quincena
//   💪 Bono Gym         — quien llegó al umbral de visitas este mes
// ============================================================================
function loadBonos() {
  if (window.pendingRequest) window.pendingRequest = null;
  const requestId = Date.now();
  window.pendingRequest = requestId;
  document.getElementById('popup-title').textContent = '🏆 Bonos';

  google.script.run
    .withSuccessHandler(function(result) {
      if (window.pendingRequest !== requestId) return;
      if (!result || !result.ok) {
        document.getElementById('popup-container').innerHTML =
          '<div style="text-align:center;padding:40px;color:var(--danger);">❌ Error: ' +
          (result && result.message ? result.message : 'No se pudo cargar') + '</div>';
        window.pendingRequest = null;
        return;
      }
      renderBonos(result);
      window.pendingRequest = null;
    })
    .withFailureHandler(function(err) {
      if (window.pendingRequest !== requestId) return;
      document.getElementById('popup-container').innerHTML =
        '<div style="text-align:center;padding:40px;color:var(--danger);">❌ Error: ' + err.message + '</div>';
      window.pendingRequest = null;
    })
    .getBonosPositivos();
}

function renderBonos(result) {
  const container = document.getElementById('popup-container');
  if (!container) return;

  // Reutilizable para todas las secciones
  function _card(args) {
    // args: { titulo, emoji, color, count, contenido, subtitulo }
    return (
      '<div style="background:rgba(255,255,255,0.04);border:1px solid ' + args.color + '40;' +
        'border-radius:16px;padding:20px;margin-bottom:18px;backdrop-filter:blur(8px);">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;' +
          'padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.08);">' +
          '<div style="font-size:32px;line-height:1;">' + args.emoji + '</div>' +
          '<div style="flex:1;">' +
            '<div style="font-size:18px;font-weight:700;color:' + args.color + ';">' + args.titulo + '</div>' +
            (args.subtitulo ? '<div style="font-size:12px;color:#94A3B8;margin-top:2px;">' + args.subtitulo + '</div>' : '') +
          '</div>' +
          '<div style="font-size:28px;font-weight:800;color:' + args.color + ';">' + args.count + '</div>' +
        '</div>' +
        args.contenido +
      '</div>'
    );
  }

  function _itemLista(texto, detalle, color) {
    return (
      '<div style="display:flex;justify-content:space-between;align-items:center;' +
        'padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:10px;' +
        'margin-bottom:6px;border-left:3px solid ' + color + ';">' +
        '<span style="font-size:14px;color:#E2E8F0;font-weight:500;">' + texto + '</span>' +
        (detalle ? '<span style="font-size:13px;color:#94A3B8;font-weight:600;">' + detalle + '</span>' : '') +
      '</div>'
    );
  }

  function _vacio(msg) {
    return '<div style="text-align:center;padding:20px;color:#64748B;font-style:italic;font-size:13px;">' + msg + '</div>';
  }

  // ── 💰 BONO PUNTUALIDAD ─────────────────────────────────────────────────
  const bonoP = result.bonoPuntualidad || [];
  let contenidoP;
  if (bonoP.length === 0) {
    contenidoP = _vacio('Nadie ha ganado bono perfecto en esta quincena');
  } else {
    contenidoP = bonoP.map(function(e) {
      return _itemLista(e.nombre, e.diasTrabajados + ' días', '#10B981');
    }).join('');
  }
  const tituloP = 'Bono Puntualidad — ' + result.quincena;

  // ── 🎂 CUMPLEAÑEROS ─────────────────────────────────────────────────────
  const cumples = result.cumpleanieros || [];
  let contenidoC;
  if (cumples.length === 0) {
    contenidoC = _vacio('Nadie cumple años en esta quincena');
  } else {
    contenidoC = cumples.map(function(c) {
      const detalle = c.fechaCorta + (c.depto ? ' · ' + c.depto : '');
      return _itemLista('🎂 ' + c.nombre, detalle, '#EC4899');
    }).join('');
  }

  // ── 💪 BONO GYM ─────────────────────────────────────────────────────────
  const gym = result.bonoGym || { ganadores: [], umbral: 15 };
  let contenidoG;
  if (gym.ganadores.length === 0) {
    contenidoG = _vacio('Aún nadie llega al umbral de ' + gym.umbral + ' visitas este mes');
  } else {
    contenidoG = gym.ganadores.map(function(g) {
      return _itemLista('💪 ' + g.nombre, g.visitas + ' visitas', '#3B82F6');
    }).join('');
  }
  const subtituloG = 'Umbral: ' + gym.umbral + '+ visitas en ' + result.mesTexto;

  // ── Header con periodo en curso ────────────────────────────────────────
  const periodoTxt = result.quincena === 'Q1' ? '1ª Quincena (1–15)' : '2ª Quincena (16–fin)';

  let html = '';
  html += '<div style="padding:24px;max-width:900px;margin:0 auto;">';

  // Banner del periodo
  html += '<div style="background:linear-gradient(135deg,#7c3aed20,#3b82f620);border:1px solid #7c3aed40;' +
            'border-radius:16px;padding:18px 24px;margin-bottom:20px;text-align:center;">' +
            '<div style="font-size:13px;color:#A78BFA;font-weight:600;text-transform:uppercase;letter-spacing:1px;">' +
              'Periodo en curso' +
            '</div>' +
            '<div style="font-size:22px;color:#E2E8F0;font-weight:700;margin-top:4px;">' +
              periodoTxt + ' · ' + result.mesTexto +
            '</div>' +
          '</div>';

  html += _card({
    titulo: tituloP,
    emoji: '💰',
    color: '#10B981',
    count: bonoP.length,
    contenido: contenidoP
  });

  html += _card({
    titulo: 'Cumpleañeros · Bono Cumpleañero',
    subtitulo: 'Todos reciben bono cumpleañero',
    emoji: '🎂',
    color: '#EC4899',
    count: cumples.length,
    contenido: contenidoC
  });

  html += _card({
    titulo: 'Bono Gym',
    subtitulo: subtituloG,
    emoji: '💪',
    color: '#3B82F6',
    count: gym.ganadores.length,
    contenido: contenidoG
  });

  html += '</div>';
  container.innerHTML = html;
}


// ============================================================================
// REPORTE QUINCENAL — Envío de reporte por email a cada empleado
// ============================================================================
// Estado del módulo (persiste durante la sesión):
//   window._reporteQuincenal = { mes, anio, quincena, mesTexto, empleados, stats, emailAdminPrueba }
// ============================================================================

function loadReporteQuincenal(mes, anio, quincena) {
  if (window.pendingRequest) window.pendingRequest = null;
  const requestId = Date.now();
  window.pendingRequest = requestId;
  document.getElementById('popup-title').textContent = '📧 Reporte Quincenal';
  document.getElementById('popup-container').innerHTML =
    '<div class="loading"><div class="spinner"></div><p>Cargando empleados y métricas...</p></div>';

  google.script.run
    .withSuccessHandler(function(result) {
      if (window.pendingRequest !== requestId) return;
      if (!result || !result.ok) {
        document.getElementById('popup-container').innerHTML =
          '<div style="text-align:center;padding:40px;color:var(--danger);">❌ ' +
          (result && result.message ? result.message : 'Error desconocido') + '</div>';
        window.pendingRequest = null;
        return;
      }
      window._reporteQuincenal = result;
      renderReporteQuincenal();
      window.pendingRequest = null;
    })
    .withFailureHandler(function(err) {
      if (window.pendingRequest !== requestId) return;
      document.getElementById('popup-container').innerHTML =
        '<div style="text-align:center;padding:40px;color:var(--danger);">❌ ' + err.message + '</div>';
      window.pendingRequest = null;
    })
    .getReporteQuincenalLista(mes || null, anio || null, quincena || null);
}

function renderReporteQuincenal() {
  const container = document.getElementById('popup-container');
  if (!container) return;
  const s = window._reporteQuincenal;
  if (!s) return;

  // ── Selector de mes/quincena ────────────────────────────────────────────
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  let optMeses = '';
  const anioActual = new Date().getFullYear();
  for (let a = anioActual - 1; a <= anioActual; a++) {
    for (let m = 1; m <= 12; m++) {
      ['Q1','Q2'].forEach(function(q) {
        const sel = (a === s.anio && m === s.mes && q === s.quincena) ? ' selected' : '';
        optMeses += '<option value="' + a + '|' + m + '|' + q + '"' + sel + '>' +
                    'Q' + q.charAt(1) + ' ' + meses[m-1] + ' ' + a + '</option>';
      });
    }
  }

  // ── Cards de empleados ──────────────────────────────────────────────────
  let cards = '';
  s.empleados.forEach(function(e) {
    const r = e.resumen;
    const noEmail = !e.tieneEmail;

    // Chips de resumen (más compactos, sin fondo)
    const chips = [];
    if (r.puntuales > 0)  chips.push('<span class="rq-chip rq-chip--ok"><i class="fas fa-check"></i> ' + r.puntuales + '</span>');
    if (r.tolerancia > 0) chips.push('<span class="rq-chip rq-chip--warn"><i class="far fa-clock"></i> ' + r.tolerancia + '</span>');
    if (r.retardos + r.sinBono > 0) chips.push('<span class="rq-chip rq-chip--bad"><i class="fas fa-exclamation"></i> ' + (r.retardos + r.sinBono) + '</span>');
    if (r.faltas > 0)     chips.push('<span class="rq-chip rq-chip--bad"><i class="fas fa-times"></i> ' + r.faltas + '</span>');
    if (r.vacaciones > 0) chips.push('<span class="rq-chip rq-chip--info"><i class="fas fa-umbrella-beach"></i> ' + r.vacaciones + '</span>');

    const emailHtml = noEmail
      ? '<span class="rq-noemail"><i class="fas fa-exclamation-triangle"></i> Sin email registrado</span>'
      : '<span class="rq-email"><i class="far fa-envelope"></i> ' + e.email + '</span>';

    const nombreEsc = e.nombre.replace(/'/g, "\\'");

    cards += (
      '<div class="rq-card">' +
        '<div class="rq-card__info">' +
          '<div class="rq-card__name">' + e.nombre + '</div>' +
          '<div class="rq-card__depto">' + (e.depto || 'SIN DEPTO') + '</div>' +
          '<div class="rq-card__email">' + emailHtml + '</div>' +
          (chips.length ? '<div class="rq-card__chips">' + chips.join('') + '</div>' : '') +
        '</div>' +
        '<div class="rq-card__actions">' +
          '<button class="rq-btn rq-btn--ghost" onclick="_rqPreview(\'' + nombreEsc + '\')" title="Vista previa">' +
            '<i class="far fa-eye"></i>' +
          '</button>' +
          (noEmail
            ? '<button class="rq-btn rq-btn--disabled" disabled title="Sin email"><i class="far fa-paper-plane"></i></button>'
            : '<button class="rq-btn rq-btn--primary" onclick="_rqEnviarUno(\'' + nombreEsc + '\', false)" title="Enviar al empleado">' +
              '<i class="far fa-paper-plane"></i></button>') +
          '<button class="rq-btn rq-btn--ghost-cyan" onclick="_rqEnviarUno(\'' + nombreEsc + '\', true)" title="Enviar prueba a mí">' +
            '<i class="fas fa-flask"></i>' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  });

  // ── Estilos del módulo (inyectados, scoped por prefijo rq-) ─────────────
  const estilos = (
    '<style>' +
      '.rq-wrap{padding:20px;max-width:1080px;margin:0 auto;color:var(--text-primary);}' +
      '.rq-banner{background:linear-gradient(135deg,rgba(59,130,246,0.1),rgba(6,182,212,0.06));' +
                 'border:1px solid rgba(59,130,246,0.2);border-radius:12px;padding:18px 22px;margin-bottom:18px;' +
                 'display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;}' +
      '.rq-banner__label{font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:1px;}' +
      '.rq-banner__title{font-size:20px;color:var(--text-primary);font-weight:700;margin-top:2px;}' +
      '.rq-banner__sub{font-size:12px;color:var(--text-secondary);margin-top:4px;}' +
      '.rq-banner select{background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border-color);' +
                       'border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer;}' +
      '.rq-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}' +
      '.rq-stat{background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:14px;text-align:center;}' +
      '.rq-stat__label{font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;font-weight:600;}' +
      '.rq-stat__value{font-size:22px;font-weight:700;margin-top:2px;color:var(--text-primary);}' +
      '.rq-stat--ok .rq-stat__label{color:var(--success);} .rq-stat--ok .rq-stat__value{color:var(--success);}' +
      '.rq-stat--warn .rq-stat__label{color:var(--warning);} .rq-stat--warn .rq-stat__value{color:var(--warning);}' +
      '.rq-actions{background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;padding:14px;margin-bottom:18px;}' +
      '.rq-actions__label{font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:10px;}' +
      '.rq-actions__row{display:flex;gap:10px;flex-wrap:wrap;}' +
      '.rq-actions__hint{font-size:11px;color:var(--text-secondary);margin-top:8px;font-style:italic;opacity:0.8;}' +
      '.rq-bigbtn{padding:11px 16px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;' +
                'display:inline-flex;align-items:center;gap:8px;transition:all 0.15s;}' +
      '.rq-bigbtn i{font-size:12px;}' +
      '.rq-bigbtn--ghost{background:transparent;color:var(--secondary);border:1px solid rgba(6,182,212,0.4);}' +
      '.rq-bigbtn--ghost:hover{background:rgba(6,182,212,0.1);border-color:var(--secondary);}' +
      '.rq-bigbtn--primary{background:var(--primary);color:#fff;}' +
      '.rq-bigbtn--primary:hover{background:var(--primary-dark);}' +
      '.rq-listlabel{font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:10px;}' +
      '.rq-card{background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:14px 16px;margin-bottom:8px;' +
              'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;transition:border-color 0.15s;}' +
      '.rq-card:hover{border-color:rgba(59,130,246,0.4);}' +
      '.rq-card__info{flex:1;min-width:200px;}' +
      '.rq-card__name{font-size:14px;font-weight:600;color:var(--text-primary);}' +
      '.rq-card__depto{font-size:12px;color:var(--text-secondary);margin-top:1px;}' +
      '.rq-card__email{margin-top:5px;font-size:11px;}' +
      '.rq-email{color:var(--text-secondary);}' +
      '.rq-email i{margin-right:4px;opacity:0.7;}' +
      '.rq-noemail{color:var(--warning);font-style:italic;}' +
      '.rq-noemail i{margin-right:4px;}' +
      '.rq-card__chips{margin-top:8px;display:flex;gap:5px;flex-wrap:wrap;}' +
      '.rq-chip{font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;display:inline-flex;align-items:center;gap:4px;}' +
      '.rq-chip i{font-size:10px;}' +
      '.rq-chip--ok{background:rgba(16,185,129,0.12);color:var(--success);}' +
      '.rq-chip--warn{background:rgba(245,158,11,0.12);color:var(--warning);}' +
      '.rq-chip--bad{background:rgba(239,68,68,0.12);color:var(--danger);}' +
      '.rq-chip--info{background:rgba(59,130,246,0.12);color:var(--primary);}' +
      '.rq-card__actions{display:flex;gap:6px;flex-shrink:0;}' +
      '.rq-btn{width:36px;height:36px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:13px;' +
             'display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s;background:transparent;}' +
      '.rq-btn--ghost{color:var(--primary);border-color:rgba(59,130,246,0.3);}' +
      '.rq-btn--ghost:hover{background:rgba(59,130,246,0.1);border-color:var(--primary);}' +
      '.rq-btn--primary{background:var(--primary);color:#fff;border-color:var(--primary);}' +
      '.rq-btn--primary:hover{background:var(--primary-dark);}' +
      '.rq-btn--ghost-cyan{color:var(--secondary);border-color:rgba(6,182,212,0.3);}' +
      '.rq-btn--ghost-cyan:hover{background:rgba(6,182,212,0.1);border-color:var(--secondary);}' +
      '.rq-btn--disabled{color:var(--text-secondary);border-color:var(--border-color);cursor:not-allowed;opacity:0.5;}' +
    '</style>'
  );

  // ── HTML completo ───────────────────────────────────────────────────────
  const html =
    estilos +
    '<div class="rq-wrap">' +
      // Banner del periodo + selector
      '<div class="rq-banner">' +
        '<div>' +
          '<div class="rq-banner__label">Quincena a reportar</div>' +
          '<div class="rq-banner__title">' +
            (s.quincena === 'Q1' ? '1ª Quincena' : '2ª Quincena') + ' · ' + s.mesTexto +
          '</div>' +
          '<div class="rq-banner__sub">Del ' + s.rango.inicio + ' al ' + s.rango.fin +
            (s.diaPago ? ' · Pago: ' + s.diaPago : '') +
          '</div>' +
        '</div>' +
        '<div>' +
          '<label class="rq-banner__label" style="display:block;margin-bottom:4px;">Cambiar periodo</label>' +
          '<select onchange="_rqCambiarPeriodo(this.value)">' + optMeses + '</select>' +
        '</div>' +
      '</div>' +

      // Stats
      '<div class="rq-stats">' +
        '<div class="rq-stat"><div class="rq-stat__label">Total</div><div class="rq-stat__value">' + s.stats.total + '</div></div>' +
        '<div class="rq-stat rq-stat--ok"><div class="rq-stat__label">Con email</div><div class="rq-stat__value">' + s.stats.conEmail + '</div></div>' +
        '<div class="rq-stat rq-stat--warn"><div class="rq-stat__label">Sin email</div><div class="rq-stat__value">' + s.stats.sinEmail + '</div></div>' +
      '</div>' +

      // Botones envío masivo
      '<div class="rq-actions">' +
        '<div class="rq-actions__label">Envío masivo</div>' +
        '<div class="rq-actions__row">' +
          '<button class="rq-bigbtn rq-bigbtn--ghost" onclick="_rqEnviarMasivo(true)">' +
            '<i class="fas fa-flask"></i> Probar todos: enviar a mí (' + s.emailAdminPrueba + ')' +
          '</button>' +
          '<button class="rq-bigbtn rq-bigbtn--primary" onclick="_rqEnviarMasivo(false)">' +
            '<i class="far fa-paper-plane"></i> Enviar a todos los empleados con email (' + s.stats.conEmail + ')' +
          '</button>' +
          '<button class="rq-bigbtn" onclick="_rqDiagnostico()" ' +
                  'style="background:transparent;color:#F59E0B;border:1px solid rgba(245,158,11,0.4);">' +
            '<i class="fas fa-stethoscope"></i> Diagnosticar permisos email' +
          '</button>' +
        '</div>' +
        '<div class="rq-actions__hint">' +
          'En modo prueba los ' + s.stats.total + ' reportes te llegan a ti para validar antes de enviar a los empleados.' +
        '</div>' +
      '</div>' +

      // Lista de empleados
      '<div class="rq-listlabel">Empleados (' + s.empleados.length + ')</div>' +
      cards +
    '</div>';

  container.innerHTML = html;
}


function _rqCambiarPeriodo(valor) {
  // valor: "anio|mes|quincena"
  const partes = valor.split('|');
  loadReporteQuincenal(parseInt(partes[1], 10), parseInt(partes[0], 10), partes[2]);
}

// ── Diagnóstico: ¿el deployment del web app puede enviar emails? ──
// Llama testEnvioDesdeWebApp() en el backend. Si el deployment NO tiene
// el scope script.send_mail, la respuesta lo dice claramente con la solución.
function _rqDiagnostico() {
  if (!confirm('Se enviará un correo de DIAGNÓSTICO desde el web app a tu email de admin.\n\nEsto verifica si el deployment tiene permisos. ¿Continuar?')) return;

  // Modal de loading
  let modal = document.getElementById('rq-diag-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'rq-diag-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML =
    '<div style="background:#0F172A;color:#E2E8F0;padding:30px 40px;border-radius:14px;max-width:600px;width:100%;">' +
      '<div style="font-size:18px;font-weight:700;margin-bottom:10px;text-align:center;">🔧 Diagnosticando permisos...</div>' +
      '<div style="font-size:13px;color:#94A3B8;margin-bottom:18px;text-align:center;">Verificando si el web app puede enviar emails</div>' +
      '<div class="spinner" style="margin:0 auto;"></div>' +
      '<div id="rq-diag-result" style="margin-top:20px;font-size:13px;"></div>' +
    '</div>';
  document.body.appendChild(modal);

  google.script.run
    .withSuccessHandler(function(result) {
      let html;
      if (result && result.ok) {
        html =
          '<div style="background:#10B98120;border:1px solid #10B98140;border-radius:8px;padding:16px;">' +
            '<div style="font-weight:700;color:#10B981;font-size:15px;margin-bottom:8px;">✅ Permisos OK</div>' +
            '<div style="font-size:13px;line-height:1.6;color:#E2E8F0;">' +
              result.message + '<br>' +
              'Quota restante hoy: <strong>' + result.quotaRestante + '</strong> correos<br>' +
              'Te llegará un correo a: <strong>' + result.destinatario + '</strong>' +
            '</div>' +
          '</div>';
      } else {
        html =
          '<div style="background:#EF444420;border:1px solid #EF444440;border-radius:8px;padding:16px;">' +
            '<div style="font-weight:700;color:#EF4444;font-size:15px;margin-bottom:8px;">❌ Permisos faltantes</div>' +
            '<div style="font-size:13px;line-height:1.6;color:#E2E8F0;">' +
              (result ? result.message : 'Error desconocido') + '<br><br>' +
              '<strong>Detalle del error:</strong><br>' +
              '<code style="background:#000;padding:4px 8px;border-radius:4px;font-size:11px;display:inline-block;margin:4px 0;">' +
                (result && result.errorDetalle ? result.errorDetalle : 'sin detalle') +
              '</code><br><br>' +
              '<strong style="color:#F59E0B;">Cómo arreglarlo:</strong><br>' +
              (result && result.solucion ? result.solucion : '') +
            '</div>' +
          '</div>';
      }
      html += '<button onclick="document.getElementById(\'rq-diag-modal\').remove()" style="margin-top:16px;padding:10px 24px;background:#3B82F6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;width:100%;">Cerrar</button>';
      document.getElementById('rq-diag-result').innerHTML = html;
    })
    .withFailureHandler(function(err) {
      document.getElementById('rq-diag-result').innerHTML =
        '<div style="background:#EF444420;padding:16px;border-radius:8px;color:#FCA5A5;">' +
          '<strong>❌ Error de comunicación:</strong><br>' +
          (err && err.message ? err.message : err) +
        '</div>' +
        '<button onclick="document.getElementById(\'rq-diag-modal\').remove()" style="margin-top:16px;padding:10px 24px;background:#3B82F6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;width:100%;">Cerrar</button>';
    })
    .testEnvioDesdeWebApp();
}

function _rqPreview(nombre) {
  const s = window._reporteQuincenal;
  if (!s) return;
  // Crear modal con loading
  let modal = document.getElementById('rq-preview-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'rq-preview-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML =
    '<div style="background:#fff;width:100%;max-width:760px;max-height:90vh;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;">' +
      '<div style="background:#0F1E3D;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">' +
        '<div style="font-weight:700;">Vista previa · ' + nombre + '</div>' +
        '<button onclick="document.getElementById(\'rq-preview-modal\').remove()" style="background:transparent;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>' +
      '</div>' +
      '<div id="rq-preview-content" style="flex:1;overflow-y:auto;background:#E2E8F0;">' +
        '<div style="text-align:center;padding:60px;color:#64748B;">Cargando reporte...</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  google.script.run
    .withSuccessHandler(function(result) {
      if (!result || !result.ok) {
        document.getElementById('rq-preview-content').innerHTML =
          '<div style="padding:40px;color:#EF4444;text-align:center;">❌ ' +
          (result && result.message ? result.message : 'Error') + '</div>';
        return;
      }
      // Renderizar el HTML del reporte dentro del modal (sandbox via iframe srcdoc)
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'width:100%;height:100%;border:none;min-height:600px;';
      iframe.srcdoc = result.html;
      const content = document.getElementById('rq-preview-content');
      content.innerHTML = '';
      content.appendChild(iframe);
    })
    .withFailureHandler(function(err) {
      document.getElementById('rq-preview-content').innerHTML =
        '<div style="padding:40px;color:#EF4444;text-align:center;">❌ ' + err.message + '</div>';
    })
    .previewReporteQuincenal(nombre, s.mes, s.anio, s.quincena);
}

function _rqEnviarUno(nombre, esPrueba) {
  const s = window._reporteQuincenal;
  if (!s) return;
  const destino = esPrueba ? s.emailAdminPrueba : 'empleado';
  if (!confirm('¿Enviar reporte de ' + nombre + ' a ' + destino + '?')) return;

  google.script.run
    .withSuccessHandler(function(result) {
      if (result && result.ok) {
        alert('✅ Enviado a ' + result.enviadoA);
      } else {
        alert('❌ Error: ' + (result && result.message ? result.message : 'desconocido'));
      }
    })
    .withFailureHandler(function(err) {
      alert('❌ Error de comunicación con backend: ' + (err && err.message ? err.message : err));
    })
    .enviarReporteQuincenalEmpleado(nombre, s.mes, s.anio, s.quincena, !!esPrueba);
}

function _rqEnviarMasivo(esPrueba) {
  const s = window._reporteQuincenal;
  if (!s) return;
  const destinatarios = esPrueba ? s.stats.total + ' reportes a TI (' + s.emailAdminPrueba + ')' : s.stats.conEmail + ' empleados';
  if (!confirm('¿Enviar ' + destinatarios + '?\n\nEsto puede tardar varios segundos. Confirma para continuar.')) return;

  // Modal de progreso CON botón X desde el inicio (por si Apps Script se cuelga
  // y nunca devuelve respuesta — bug conocido de google.script.run con
  // operaciones largas).
  let modal = document.getElementById('rq-envio-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'rq-envio-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML =
    '<div style="background:#0F172A;color:#E2E8F0;padding:30px 40px;border-radius:14px;max-width:500px;width:100%;position:relative;">' +
      '<button onclick="document.getElementById(\'rq-envio-modal\').remove()" ' +
              'style="position:absolute;top:12px;right:12px;background:transparent;border:none;color:#94A3B8;font-size:22px;cursor:pointer;line-height:1;" ' +
              'title="Cerrar">×</button>' +
      '<div style="text-align:center;">' +
        '<div id="rq-envio-titulo" style="font-size:18px;font-weight:700;margin-bottom:10px;">' + (esPrueba ? '🧪 Enviando reportes de PRUEBA...' : '📤 Enviando reportes...') + '</div>' +
        '<div id="rq-envio-subtitulo" style="font-size:13px;color:#94A3B8;margin-bottom:18px;">Por favor no cierres esta ventana</div>' +
        '<div id="rq-envio-spinner" class="spinner" style="margin:0 auto;"></div>' +
        '<div id="rq-envio-result" style="margin-top:16px;font-size:13px;text-align:left;"></div>' +
        '<div id="rq-envio-timeout" style="margin-top:14px;font-size:12px;color:#F59E0B;display:none;">' +
          '⚠️ Está tardando más de lo normal. Si ya recibiste correos, puedes cerrar.' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  // Timeout de 60s: si Apps Script no respondió, mostrar aviso
  const timeoutAviso = setTimeout(function() {
    const aviso = document.getElementById('rq-envio-timeout');
    if (aviso) aviso.style.display = 'block';
  }, 60000);

  google.script.run
    .withSuccessHandler(function(result) {
      clearTimeout(timeoutAviso);

      // Cambiar título/subtítulo y ocultar spinner
      const titulo    = document.getElementById('rq-envio-titulo');
      const subtitulo = document.getElementById('rq-envio-subtitulo');
      const spinner   = document.getElementById('rq-envio-spinner');
      const aviso     = document.getElementById('rq-envio-timeout');
      if (spinner)   spinner.style.display = 'none';
      if (subtitulo) subtitulo.style.display = 'none';
      if (aviso)     aviso.style.display = 'none';

      let html = '';
      if (result && result.ok) {
        const r = result.resultados;
        const huboError = r.fallidos > 0;
        const bgColor   = huboError ? '#F59E0B20' : '#10B98120';
        const titColor  = huboError ? '#F59E0B'   : '#10B981';
        const tituloTxt = huboError ? '⚠️ Envío con errores' : '✅ Envío completado';

        if (titulo) {
          titulo.textContent = tituloTxt;
          titulo.style.color = titColor;
        }

        html =
          '<div style="background:' + bgColor + ';border-radius:8px;padding:14px;margin-top:8px;text-align:left;">' +
            '<div style="font-size:12px;line-height:1.6;">' +
              '✓ Enviados: <strong>' + r.enviados + '</strong><br>' +
              (r.fallidos > 0 ? '✗ Fallidos: <strong style="color:#EF4444;">' + r.fallidos + '</strong><br>' : '') +
              (r.sinEmail > 0 ? '⚠ Sin email: <strong style="color:#F59E0B;">' + r.sinEmail + '</strong><br>' : '') +
            '</div>' +
          '</div>';

        // Detalles de fallos
        const fallidos = (r.detalles || []).filter(function(d) { return d.status === 'error'; });
        if (fallidos.length > 0) {
          html += '<div style="background:#EF444415;border-radius:8px;padding:12px;margin-top:8px;text-align:left;max-height:200px;overflow-y:auto;">' +
                    '<div style="font-weight:700;color:#EF4444;font-size:12px;margin-bottom:6px;">Errores específicos:</div>';
          fallidos.forEach(function(d) {
            html += '<div style="font-size:11px;color:#FCA5A5;margin-bottom:4px;padding:4px 0;border-bottom:1px solid rgba(239,68,68,0.15);">' +
                      '<strong>' + d.nombre + ':</strong> ' + (d.error || 'sin detalle') +
                    '</div>';
          });
          html += '</div>';
        }
      } else {
        if (titulo) { titulo.textContent = '❌ Error'; titulo.style.color = '#EF4444'; }
        html = '<div style="color:#EF4444;margin-top:10px;">' + (result && result.message ? result.message : 'Error desconocido') + '</div>';
      }
      html += '<button onclick="document.getElementById(\'rq-envio-modal\').remove()" style="margin-top:16px;padding:10px 24px;background:#3B82F6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;width:100%;">Cerrar</button>';
      document.getElementById('rq-envio-result').innerHTML = html;
    })
    .withFailureHandler(function(err) {
      clearTimeout(timeoutAviso);
      const titulo    = document.getElementById('rq-envio-titulo');
      const subtitulo = document.getElementById('rq-envio-subtitulo');
      const spinner   = document.getElementById('rq-envio-spinner');
      if (spinner)   spinner.style.display = 'none';
      if (subtitulo) subtitulo.style.display = 'none';
      if (titulo) { titulo.textContent = '❌ Error de comunicación'; titulo.style.color = '#EF4444'; }

      document.getElementById('rq-envio-result').innerHTML =
        '<div style="background:#EF444420;padding:12px;border-radius:8px;color:#FCA5A5;">' +
          (err && err.message ? err.message : err) +
        '</div>' +
        '<button onclick="document.getElementById(\'rq-envio-modal\').remove()" style="margin-top:16px;padding:10px 24px;background:#3B82F6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;width:100%;">Cerrar</button>';
    })
    .enviarReporteQuincenalATodos(s.mes, s.anio, s.quincena, !!esPrueba);
}

function renderRankingCompleto(result, tipo) {
  currentData = { headers: result.headers, data: [...result.data], originalData: [...result.data] };
  currentRenderFunction = function(r) { renderRankingCompleto(r, tipo); };
  const container = document.getElementById('popup-container');
  const headers = result.headers;
  const data = result.data;
  let html = '<div class="ranking-card">';
  if (tipo === 'horas-extra') {
    const idxNombre = encontrarColumnaDeNombres(headers);
    const idxHorasExtra = headers.indexOf('Horas Extra');
    const empleados = {};
    data.forEach(row => {
      const nombre = row[idxNombre];
      const horasExtra = parseFloat(row[idxHorasExtra]) || 0;
      if (horasExtra > 0) {
        if (!empleados[nombre]) empleados[nombre] = { total: 0, dias: 0 };
        empleados[nombre].total += horasExtra;
        empleados[nombre].dias++;
      }
    });
    const ranking = Object.entries(empleados).sort((a, b) => b[1].total - a[1].total);
    ranking.forEach(([nombre, d], index) => {
      const posClass = index === 0 ? 'top1' : index === 1 ? 'top2' : index === 2 ? 'top3' : 'other';
      html += '<div class="ranking-item"><div class="ranking-position ' + posClass + '">' + (index + 1) + '</div><div class="ranking-info"><div class="ranking-name">' + nombre + '</div><div class="ranking-detail">' + d.total.toFixed(2) + ' hrs extra en ' + d.dias + ' días</div></div><span class="ranking-badge badge-success">⭐ ' + d.total.toFixed(1) + 'h</span></div>';
    });
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderIncidencias() {
  document.getElementById('popup-title').textContent = '📋 Incidencias';
  const container = document.getElementById('popup-container');
  container.innerHTML = '<div style="text-align:center;padding:40px;">⏳ Cargando incidencias...</div>';

  // Primero obtener el rango de fechas presente en METRICAS_DIARIAS
  // para acotar incidencias al mismo período que muestra el control de asistencia
  google.script.run
    .withSuccessHandler(function(rawMetricas) {
      const rM = safeResult(rawMetricas);
      // Calcular rango de fechas del período actual en METRICAS_DIARIAS
      var fechaMin = null, fechaMax = null;
      if (!rM.error && rM.data && rM.data.length > 0) {
        const hM = rM.headers || [];
        const iFecha = hM.indexOf('Fecha');
        rM.data.forEach(function(row) {
          const f = row[iFecha];
          if (!f) return;
          var d;
          try { d = new Date(f); } catch(e) { return; }
          if (isNaN(d.getTime())) return;
          // Ajuste timezone GAS (epoch 1899-12-30) ya resuelto server-side
          if (!fechaMin || d < fechaMin) fechaMin = d;
          if (!fechaMax || d > fechaMax) fechaMax = d;
        });
      }

      // Formatear fechas como YYYY-MM-DD para comparar con las de incidencias
      function toYMD(d) {
        if (!d) return null;
        return d.toISOString().split('T')[0];
      }
      const strMin = toYMD(fechaMin);
      const strMax = toYMD(fechaMax);

      google.script.run
        .withSuccessHandler(function(result) {
          if (!result || result.error === true) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);">❌ Error cargando incidencias</div>'; return; }
          if (!result.incidencias || result.incidencias.length === 0) { container.innerHTML = '<div style="text-align:center;padding:40px;">ℹ️ No hay incidencias en el período analizado</div>'; return; }

          const porEmpleado = {};
          result.incidencias.forEach(function(inc) {
            const nombre = (inc.empleado || '').toString().trim(); if (!nombre) return;
            // Filtrar por rango de fechas de METRICAS_DIARIAS
            if (strMin && strMax && inc.fecha) {
              const f = inc.fecha.length >= 10 ? inc.fecha.substring(0, 10) : inc.fecha;
              if (f < strMin || f > strMax) return;
            }
            if (!porEmpleado[nombre]) porEmpleado[nombre] = [];
            porEmpleado[nombre].push({ actividad: inc.actividad || '', fecha: inc.fecha || '' });
          });

          if (Object.keys(porEmpleado).length === 0) {
            const periodoStr = strMin && strMax ? ' (' + strMin + ' al ' + strMax + ')' : '';
            container.innerHTML = '<div style="text-align:center;padding:40px;">ℹ️ No hay incidencias en el período' + periodoStr + '</div>';
            return;
          }

          const iconoPorActividad = function(actividad) {
            const a = (actividad || '').toLowerCase();
            if (a.includes('uniforme')) return '👕';
            if (a.includes('botas')) return '🥾';
            if (a.includes('celular')) return '📵';
            return '⚠️';
          };

          // Cabecera con rango de período
          const periodoLabel = strMin && strMax
            ? '<div style="font-size:11px;color:#64748B;margin-bottom:12px;text-align:right;">Período: ' + strMin + ' al ' + strMax + '</div>'
            : '';

          const empleadosOrdenados = Object.keys(porEmpleado).sort(function(a, b) { return a.localeCompare(b, 'es'); });
          let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
            + periodoLabel
            + '<button onclick="renderIncidencias()" style="padding:10px 20px;background:linear-gradient(135deg,#3B82F6,#2563EB);border:none;border-radius:8px;color:white;font-weight:700;cursor:pointer;"><i class="fas fa-sync"></i> Recargar</button></div><div class="employees-grid">';

          empleadosOrdenados.forEach(function(nombre) {
            const incidencias = porEmpleado[nombre];
            const detallesHTML = incidencias.map(function(inc) {
              // Formatear fecha legible
              var fechaDisplay = inc.fecha || '-';
              if (inc.fecha && inc.fecha.length >= 10) {
                try {
                  // Parsear YYYY-MM-DD sin conversión timezone
                  const parts = inc.fecha.substring(0, 10).split('-');
                  fechaDisplay = parts[2] + '/' + parts[1] + '/' + parts[0];
                } catch(e) {}
              }
              return '<div style="padding:8px;background:rgba(15,23,42,0.4);border-radius:6px;border-left:3px solid #EF4444;margin-bottom:6px;font-size:12px;"><div style="display:flex;justify-content:space-between;"><span style="color:#EF4444;font-weight:700;">' + iconoPorActividad(inc.actividad) + ' ' + (inc.actividad || 'INCIDENCIA') + '</span><span style="color:#94A3B8;">' + fechaDisplay + '</span></div></div>';
            }).join('');
            html += '<div class="employee-card"><div class="employee-name" style="display:flex;align-items:center;gap:12px;">' + crearAvatarElement(nombre, 40) + '<span style="font-weight:700;">' + nombre + '</span></div><div class="employee-stats"><div class="stat-row" style="background:rgba(239,68,68,0.1);padding:8px;border-radius:8px;margin-bottom:8px;"><span class="label" style="font-weight:700;">Total Incidencias:</span><span class="value" style="color:#EF4444;font-size:20px;font-weight:700;">' + incidencias.length + '</span></div><div style="max-height:280px;overflow-y:auto;padding-right:4px;">' + detallesHTML + '</div></div><span class="badge badge-danger">🚨 CRÍTICO</span></div>';
          });
          html += '</div>';
          container.innerHTML = html;
        })
        .withFailureHandler(function(error) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);">❌ ' + error.message + '</div>'; })
        .getIncidenciasEmpleados('todas');
    })
    .withFailureHandler(function() {
      // Si falla cargar métricas, cargar incidencias sin filtro de período
      google.script.run
        .withSuccessHandler(function(result) {
          if (!result || result.incidencias || result.incidencias.length === 0) { container.innerHTML = '<div style="text-align:center;padding:40px;">ℹ️ Sin datos</div>'; return; }
          container.innerHTML = '<div>Sin filtro de período disponible</div>';
        })
        .withFailureHandler(function(e) { container.innerHTML = '<div style="color:var(--danger);padding:40px;">❌ ' + e.message + '</div>'; })
        .getIncidenciasEmpleados('todas');
    })
    .getSheetData('METRICAS_DIARIAS');
}

function inicializarTablaEventualidad(tableId, numColumnas, countId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const columnas = letras.slice(0, numColumnas);
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  columnas.forEach(col => { const th = document.createElement('th'); th.textContent = col; headerRow.appendChild(th); });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  if (tableId === 'table-enfermedades') { for (let i = 0; i < 5; i++) tbody.appendChild(crearFilaEnfermedad()); }
  else if (tableId === 'table-festivos') { for (let i = 0; i < 5; i++) tbody.appendChild(crearFilaFestivo()); }
  else { for (let i = 0; i < 5; i++) tbody.appendChild(crearFilaEditable(numColumnas)); }
  table.appendChild(tbody);
  table.addEventListener('paste', (e) => manejarPasteEventualidad(e, tableId, countId, numColumnas));
  actualizarContador(tableId, countId);
  if (tableId === 'table-enfermedades') cargarNombresEmpleados();
}

function crearFilaEnfermedad() {
  const tr = document.createElement('tr');
  const tdNombre = document.createElement('td');
  tdNombre.innerHTML = '<select class="select-empleado" style="width:100%;padding:6px;background:rgba(15,23,42,0.8);border:1px solid rgba(59,130,246,0.3);color:#F1F5F9;border-radius:4px;font-size:13px;"><option value="">Seleccionar empleado...</option></select>';
  tr.appendChild(tdNombre);
  const tdFecha = document.createElement('td');
  tdFecha.innerHTML = '<input type="date" style="width:100%;padding:6px;background:rgba(15,23,42,0.8);border:1px solid rgba(59,130,246,0.3);color:#F1F5F9;border-radius:4px;font-size:13px;">';
  tr.appendChild(tdFecha);
  const tdTipo = document.createElement('td');
  tdTipo.textContent = 'DIA_COMPLETO';
  tdTipo.style.cssText = 'background:rgba(59,130,246,0.1);text-align:center;font-weight:600;color:var(--primary);';
  tr.appendChild(tdTipo);
  const tdSalio = document.createElement('td');
  tdSalio.textContent = 'NO';
  tdSalio.style.cssText = 'background:rgba(16,185,129,0.1);text-align:center;font-weight:600;color:var(--success);';
  tr.appendChild(tdSalio);
  const tdHora = document.createElement('td');
  tdHora.contentEditable = 'true';
  tdHora.style.cssText = 'text-align:center;';
  tr.appendChild(tdHora);
  [tdNombre, tdFecha, tdHora].forEach(td => { td.addEventListener('change', () => verificarYAgregarFilaEnfermedad(tr)); td.addEventListener('input', () => verificarYAgregarFilaEnfermedad(tr)); });
  return tr;
}

function crearFilaFestivo() {
  const tr = document.createElement('tr');
  const tdFecha = document.createElement('td');
  tdFecha.innerHTML = '<input type="date" class="input-fecha-festivo" style="width:100%;padding:6px;background:rgba(15,23,42,0.8);border:1px solid rgba(236,72,153,0.3);color:#F1F5F9;border-radius:4px;font-size:13px;">';
  tr.appendChild(tdFecha);
  const tdDescripcion = document.createElement('td');
  tdDescripcion.contentEditable = 'true';
  tdDescripcion.style.cssText = 'padding:8px;color:#F1F5F9;';
  tr.appendChild(tdDescripcion);
  [tdFecha, tdDescripcion].forEach(td => { td.addEventListener('change', () => verificarYAgregarFilaFestivo(tr)); td.addEventListener('input', () => verificarYAgregarFilaFestivo(tr)); });
  return tr;
}

function verificarYAgregarFilaFestivo(currentRow) {
  const tbody = currentRow.parentElement;
  const rows = tbody.querySelectorAll('tr');
  const lastRow = rows[rows.length - 1];
  const inputFecha = lastRow.querySelector('.input-fecha-festivo');
  const tdDescripcion = lastRow.children[1];
  if ((inputFecha && inputFecha.value) || (tdDescripcion && tdDescripcion.textContent.trim())) {
    tbody.appendChild(crearFilaFestivo());
    const table = tbody.closest('table');
    actualizarContador(table.id, table.id.replace('table-', 'count-'));
  }
}

function verificarYAgregarFilaEnfermedad(currentRow) {
  const tbody = currentRow.parentElement;
  const rows = tbody.querySelectorAll('tr');
  const lastRow = rows[rows.length - 1];
  const select = lastRow.querySelector('.select-empleado');
  const input = lastRow.querySelector('input[type="date"]');
  if ((select && select.value) || (input && input.value)) {
    tbody.appendChild(crearFilaEnfermedad());
    const table = tbody.closest('table');
    actualizarContador(table.id, table.id.replace('table-', 'count-'));
    cargarNombresEmpleados();
  }
}

function cargarNombresEmpleados() {
  google.script.run
    .withSuccessHandler(function(result) {
      if (!result || result.error === true) return;
      const nombres = result.data.map(row => row[1]).filter(nombre => nombre && nombre.trim() !== '').sort();
      document.querySelectorAll('.select-empleado').forEach(select => {
        const valorActual = select.value;
        select.innerHTML = '<option value="">Seleccionar empleado...</option>';
        nombres.forEach(nombre => { const option = document.createElement('option'); option.value = nombre; option.textContent = nombre; select.appendChild(option); });
        if (valorActual) select.value = valorActual;
      });
    })
    .withFailureHandler(function(error) { console.error('❌ Error:', error); })
    .getSheetData('TURNOS_DEFAULT');
}

function reinicializarTablaEventualidad(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (tableId === 'table-enfermedades') { for (let i = 0; i < 5; i++) tbody.appendChild(crearFilaEnfermedad()); setTimeout(() => { cargarNombresEmpleados(); }, 100); }
  else if (tableId === 'table-festivos') { for (let i = 0; i < 5; i++) tbody.appendChild(crearFilaFestivo()); }
  else { for (let i = 0; i < 5; i++) tbody.appendChild(crearFilaEditable(5)); }
  actualizarContador(tableId, tableId.replace('table-', 'count-'));
}

function inyectarEventualidad(seccion, tableId) {
  const table = document.getElementById(tableId);
  const tbody = table.querySelector('tbody');
  const rows = tbody.querySelectorAll('tr');
  const numColumnas = rows[0] ? rows[0].querySelectorAll('td').length : 5;
  const data = [];
  rows.forEach(row => {
    let rowData = [];
    if (tableId === 'table-enfermedades') {
      const select = row.querySelector('.select-empleado');
      const inputFecha = row.querySelector('input[type="date"]');
      const cells = row.querySelectorAll('td');
      if (select && select.value) rowData = [select.value, inputFecha ? inputFecha.value : '', cells[2] ? cells[2].textContent.trim() : 'DIA_COMPLETO', cells[3] ? cells[3].textContent.trim() : 'NO', cells[4] ? cells[4].textContent.trim() : '-'];
    } else if (tableId === 'table-festivos') {
      const inputFecha = row.querySelector('.input-fecha-festivo');
      const tdDescripcion = row.children[1];
      if (inputFecha && inputFecha.value) rowData = [inputFecha.value, tdDescripcion ? tdDescripcion.textContent.trim() : ''];
    } else {
      const cells = row.querySelectorAll('td');
      for (let i = 0; i < numColumnas && i < cells.length; i++) rowData.push(cells[i].textContent.trim());
    }
    if (rowData.length > 0 && rowData.some(value => value !== '')) data.push(rowData);
  });
  if (data.length === 0) { mostrarNotificacion('error', '⚠️ No hay datos para inyectar'); return; }
  mostrarNotificacion('loading', '📤 Inyectando ' + data.length + ' filas en ' + seccion + '...');
  google.script.run
    .withSuccessHandler(function(result) {
      if (!result) return;
      if (result.error) { mostrarNotificacion('error', '❌ Error: ' + result.message); }
      else { mostrarNotificacion('success', '✅ ' + result.rowsWritten + ' filas agregadas'); reinicializarTablaEventualidad(tableId); }
    })
    .withFailureHandler(function(error) { mostrarNotificacion('error', '❌ Error: ' + error.message); })
    .inyectarEventualidades(seccion, data);
}

function limpiarTablaEventualidad(tableId, numColumnas, countId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  for (let i = 0; i < 5; i++) tbody.appendChild(crearFilaEditable(numColumnas));
  actualizarContador(tableId, countId);
  mostrarNotificacion('success', '🗑️ Tabla limpiada');
}

// ============================================================================
// RENDER GYM — Bono por asistencia al gimnasio
// ============================================================================
// Hoja GYM:  Col A=ID, B=Nombre, C=Día del bono, D+=un mes por columna.
// Valor de columna-mes = cantidad de visitas al gym ese mes.
// Regla:  >=15 visitas = BONO (verde) | <15 = SIN BONO (rojo) | 0 = sin registros
// ============================================================================

// ============================================================================
// RENDER GYM — Bono por asistencia al gimnasio
// ============================================================================
// Hoja GYM:  Col A=ID, B=Nombre, C=Día del bono, D+=un mes por columna.
// Valor de columna-mes = cantidad de visitas al gym ese mes.
// Regla:  >=umbral visitas = BONO (verde) | <umbral = SIN BONO (rojo) | 0 = sin registros
// El umbral es DINÁMICO — se carga del backend (CONFIG_GYM) y es editable
// desde el botón "⚙️ Cambiar umbral" en el panel.
// ============================================================================

// Umbral cacheado en memoria — se carga del backend cuando se abre GYM
window._umbralGym = window._umbralGym || 15;

function renderGym(result) {
  const container = document.getElementById('popup-container');
  if (!container) return;

  if (!result || result.error || !result.data || result.data.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;">ℹ️ La hoja GYM está vacía o no existe</div>';
    return;
  }

  // ⭐ Cargar umbral actual del backend antes de renderizar
  // (solo la primera vez por sesión; después usa el cacheado)
  if (!window._umbralGymCargado) {
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando configuración GYM...</p></div>';
    google.script.run
      .withSuccessHandler(function(resp) {
        if (resp && resp.ok && resp.umbral) {
          window._umbralGym = resp.umbral;
        }
        window._umbralGymCargado = true;
        _renderGymContenido(result);
      })
      .withFailureHandler(function() {
        // Si falla, usar default 15 y seguir
        window._umbralGymCargado = true;
        _renderGymContenido(result);
      })
      .getUmbralGym();
    return;
  }

  _renderGymContenido(result);
}

function _renderGymContenido(result) {
  const container = document.getElementById('popup-container');
  if (!container) return;

  currentData = { headers: result.headers, data: result.data.slice(), originalData: result.data.slice() };
  currentRenderFunction = renderGym;

  const headers = result.headers;
  const data    = result.data;
  const idxNombre = 1, idxDia = 2, idxMesInicio = 3;
  const UMBRAL = window._umbralGym || 15;

  if (headers.length - idxMesInicio < 1) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;">ℹ️ La hoja GYM no tiene columnas de mes</div>';
    return;
  }

  // Normaliza el encabezado de un mes. Puede venir como "abr 2026", Date, o
  // ISO string "2026-04-01T..." (GAS convierte Dates a ISO al enviar al frontend).
  const MS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  function normalizarHeaderMes(h) {
    if (!h) return '';
    if (h instanceof Date) return MS[h.getMonth()] + ' ' + h.getFullYear();
    const str = h.toString().trim();
    const iso = str.match(/^(\d{4})-(\d{2})-\d{2}/);
    if (iso) return MS[parseInt(iso[2],10) - 1] + ' ' + iso[1];
    return str;
  }
  const mesesLabels = headers.slice(idxMesInicio).map(normalizarHeaderMes);

  // Índice del mes actual (para resaltarlo)
  const ahora = new Date();
  const mesActualTxt = MS[ahora.getMonth()] + ' ' + ahora.getFullYear();
  let idxMesActual = -1;
  mesesLabels.forEach(function(l, i) {
    if (l.toLowerCase() === mesActualTxt.toLowerCase()) idxMesActual = i;
  });

  const empleados = data.map(function(row) {
    return {
      nombre: (row[idxNombre] || '').toString().trim(),
      diaBono: parseInt(row[idxDia], 10) || 0,
      visitas: row.slice(idxMesInicio).map(function(v) { return parseInt(v, 10) || 0; })
    };
  }).filter(function(e) { return e.nombre; });

  if (empleados.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;">ℹ️ No hay empleados registrados en GYM</div>';
    return;
  }

  empleados.sort(function(a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });

  // KPIs del mes actual
  let kTotal = empleados.length, kBono = 0, kSin = 0, kCero = 0;
  if (idxMesActual !== -1) {
    empleados.forEach(function(e) {
      const v = e.visitas[idxMesActual];
      if (v === 0) kCero++; else if (v >= UMBRAL) kBono++; else kSin++;
    });
  }

  function kpi(icon, label, val, color) {
    return '<div style="flex:1;min-width:130px;background:rgba(30,41,59,0.6);border:1px solid ' + color +
      '33;border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px;">' +
      '<span style="font-size:22px;">' + icon + '</span><div>' +
      '<div style="font-size:10px;color:#94A3B8;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">' + label + '</div>' +
      '<div style="font-size:24px;font-weight:800;color:' + color + ';">' + val + '</div></div></div>';
  }

  // ⭐ BARRA SUPERIOR: KPIs + botón de umbral
  let html =
    '<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:stretch;">' +
      kpi('💪', 'Registrados', kTotal, '#3B82F6') +
      kpi('🏆', 'Con bono', kBono, '#10B981') +
      kpi('❌', 'Sin bono', kSin, '#EF4444') +
      kpi('⚪', 'Sin registros', kCero, '#64748B') +
      // Botón de configuración del umbral
      '<button onclick="abrirModalUmbralGym()" ' +
        'style="flex:0 0 auto;min-width:140px;background:linear-gradient(135deg,rgba(59,130,246,0.2),rgba(139,92,246,0.2));' +
        'border:1px solid rgba(59,130,246,0.5);border-radius:10px;padding:10px 14px;cursor:pointer;color:#7fdfff;' +
        'font-weight:700;font-size:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;' +
        'transition:all 0.2s;" ' +
        'onmouseover="this.style.background=\'linear-gradient(135deg,rgba(59,130,246,0.35),rgba(139,92,246,0.35))\';this.style.transform=\'translateY(-2px)\'" ' +
        'onmouseout="this.style.background=\'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(139,92,246,0.2))\';this.style.transform=\'translateY(0)\'">' +
        '<span style="font-size:18px;">⚙️</span>' +
        '<span style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">Umbral: <b style="font-size:14px;color:#F1F5F9;">' + UMBRAL + '</b></span>' +
      '</button>' +
    '</div>';

  if (idxMesActual !== -1) {
    html += '<div style="font-size:11px;color:#94A3B8;margin-bottom:14px;">📅 Mes actual: <b style="color:#F1F5F9;">' + mesesLabels[idxMesActual] + '</b> · Bono se gana con <b style="color:#10B981;">' + UMBRAL + '+ visitas</b></div>';
  }

  // Grid de tarjetas — una por empleado, con los meses en chips horizontales
  html += '<div class="employees-grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr));">';

  empleados.forEach(function(emp) {
    const chips = emp.visitas.map(function(v, i) {
      const esActual = i === idxMesActual;
      let color, bg;
      if (v === 0)         { color = '#64748B'; bg = 'rgba(100,116,139,0.12)'; }
      else if (v >= UMBRAL){ color = '#10B981'; bg = 'rgba(16,185,129,0.14)'; }
      else                 { color = '#EF4444'; bg = 'rgba(239,68,68,0.14)'; }
      return '<div style="flex:1;min-width:64px;text-align:center;padding:6px 4px;border-radius:7px;background:' + bg +
        ';' + (esActual ? 'outline:2px solid ' + color + '88;' : '') + '">' +
        '<div style="font-size:9px;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">' + mesesLabels[i] + '</div>' +
        '<div style="font-size:18px;font-weight:800;color:' + color + ';line-height:1.2;">' + v + '</div>' +
        '<div style="font-size:8px;color:' + color + ';opacity:0.7;">visitas</div>' +
      '</div>';
    }).join('');

    let badge = '';
    if (idxMesActual !== -1) {
      const vA = emp.visitas[idxMesActual];
      if (vA >= UMBRAL)  badge = '<span class="badge badge-success">🏆 BONO</span>';
      else if (vA === 0) badge = '<span class="badge" style="background:rgba(100,116,139,0.2);color:#94A3B8;">SIN REGISTROS</span>';
      else               badge = '<span class="badge badge-danger">❌ SIN BONO (' + vA + '/' + UMBRAL + ')</span>';
    }

    html += '<div class="employee-card">' +
      '<div class="employee-name" style="display:flex;align-items:center;gap:10px;">' +
        crearAvatarElement(emp.nombre, 38) +
        '<span style="font-weight:700;font-size:13px;">' + emp.nombre + '</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;margin:8px 0;font-size:11px;color:#94A3B8;">' +
        '📆 Día de entrega del bono: <b style="color:#7fdfff;font-size:14px;">' + emp.diaBono + '</b>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' + chips + '</div>' +
      badge +
    '</div>';
  });

  html += '</div>';
  container.innerHTML = html;
}

// ============================================================================
// MODAL para cambiar el umbral del GYM
// ============================================================================
function abrirModalUmbralGym() {
  // Quitar modal previo si existe
  const previo = document.getElementById('modal-umbral-gym');
  if (previo) previo.remove();

  const umbralActual = window._umbralGym || 15;

  const overlay = document.createElement('div');
  overlay.id = 'modal-umbral-gym';
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;' +
    'display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);' +
    'animation:fadeIn 0.2s ease;';

  overlay.innerHTML =
    '<div style="background:linear-gradient(135deg,#1E293B,#0F172A);' +
      'border:1px solid rgba(59,130,246,0.4);border-radius:16px;padding:28px;' +
      'width:420px;max-width:92vw;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +

      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">' +
        '<div style="width:44px;height:44px;background:linear-gradient(135deg,#3B82F6,#8B5CF6);' +
          'border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;">🏋️</div>' +
        '<div>' +
          '<div style="font-size:18px;font-weight:800;color:#F1F5F9;">Umbral del bono GYM</div>' +
          '<div style="font-size:12px;color:#94A3B8;">Visitas mínimas para ganar bono</div>' +
        '</div>' +
      '</div>' +

      '<div style="background:rgba(15,23,42,0.6);border:1px solid rgba(59,130,246,0.2);' +
        'border-radius:12px;padding:16px;margin-bottom:16px;">' +
        '<div style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:8px;">' +
          'Valor actual</div>' +
        '<div style="display:flex;align-items:center;gap:14px;">' +
          '<input type="number" id="input-umbral-gym" value="' + umbralActual + '" min="1" max="31" ' +
            'style="flex:1;background:#0F172A;border:2px solid rgba(59,130,246,0.4);' +
            'border-radius:10px;padding:14px;color:#F1F5F9;font-size:28px;font-weight:800;' +
            'text-align:center;outline:none;transition:border-color 0.2s;" ' +
            'onfocus="this.style.borderColor=\'#3B82F6\'" ' +
            'onblur="this.style.borderColor=\'rgba(59,130,246,0.4)\'">' +
          '<div style="font-size:11px;color:#64748B;line-height:1.4;">visitas\nmínimas\nal mes</div>' +
        '</div>' +
      '</div>' +

      '<div style="font-size:11px;color:#64748B;margin-bottom:18px;line-height:1.5;">' +
        '💡 Este valor afecta a TODOS los meses y a TODOS los empleados. ' +
        'Al cambiarlo, se recalcula quién gana bono y quién no en tiempo real.' +
      '</div>' +

      '<div id="modal-umbral-status" style="display:none;font-size:12px;text-align:center;' +
        'padding:10px;border-radius:8px;margin-bottom:14px;"></div>' +

      '<div style="display:flex;gap:10px;">' +
        '<button onclick="document.getElementById(\'modal-umbral-gym\').remove()" ' +
          'style="flex:1;padding:12px;background:rgba(100,116,139,0.2);border:1px solid rgba(100,116,139,0.4);' +
          'border-radius:10px;color:#94A3B8;font-weight:700;cursor:pointer;font-size:13px;transition:all 0.2s;" ' +
          'onmouseover="this.style.background=\'rgba(100,116,139,0.35)\'" ' +
          'onmouseout="this.style.background=\'rgba(100,116,139,0.2)\'">' +
          'Cancelar' +
        '</button>' +
        '<button id="btn-guardar-umbral" onclick="guardarUmbralGym()" ' +
          'style="flex:2;padding:12px;background:linear-gradient(135deg,#10B981,#059669);border:none;' +
          'border-radius:10px;color:white;font-weight:800;cursor:pointer;font-size:13px;transition:all 0.2s;" ' +
          'onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 6px 16px rgba(16,185,129,0.4)\'" ' +
          'onmouseout="this.style.transform=\'translateY(0)\';this.style.boxShadow=\'none\'">' +
          '💾 Guardar y aplicar' +
        '</button>' +
      '</div>' +
    '</div>';

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
  setTimeout(function() { document.getElementById('input-umbral-gym').focus(); }, 100);

  // Enter para guardar
  document.getElementById('input-umbral-gym').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') guardarUmbralGym();
    if (e.key === 'Escape') document.getElementById('modal-umbral-gym').remove();
  });
}

function guardarUmbralGym() {
  const input = document.getElementById('input-umbral-gym');
  const status = document.getElementById('modal-umbral-status');
  const btn = document.getElementById('btn-guardar-umbral');
  if (!input) return;

  const nuevoValor = parseInt(input.value, 10);
  if (isNaN(nuevoValor) || nuevoValor < 1 || nuevoValor > 31) {
    status.style.display = 'block';
    status.style.background = 'rgba(239,68,68,0.15)';
    status.style.border = '1px solid rgba(239,68,68,0.4)';
    status.style.color = '#FCA5A5';
    status.textContent = '❌ El umbral debe ser un número entre 1 y 31';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '⏳ Guardando...';
  btn.style.opacity = '0.7';

  google.script.run
    .withSuccessHandler(function(resp) {
      if (resp && resp.ok) {
        window._umbralGym = resp.umbral;
        status.style.display = 'block';
        status.style.background = 'rgba(16,185,129,0.15)';
        status.style.border = '1px solid rgba(16,185,129,0.4)';
        status.style.color = '#6EE7B7';
        status.textContent = '✅ Umbral actualizado a ' + resp.umbral + ' visitas';

        // Cerrar el modal y recargar el módulo GYM con el nuevo umbral
        setTimeout(function() {
          const modal = document.getElementById('modal-umbral-gym');
          if (modal) modal.remove();
          // Re-render usando currentData en cache (sin volver a llamar GAS)
          if (window.currentData && window.currentRenderFunction === renderGym) {
            _renderGymContenido({
              headers: window.currentData.headers,
              data: window.currentData.originalData
            });
          }
        }, 800);
      } else {
        status.style.display = 'block';
        status.style.background = 'rgba(239,68,68,0.15)';
        status.style.border = '1px solid rgba(239,68,68,0.4)';
        status.style.color = '#FCA5A5';
        status.textContent = '❌ ' + (resp && resp.message ? resp.message : 'Error al guardar');
        btn.disabled = false;
        btn.innerHTML = '💾 Guardar y aplicar';
        btn.style.opacity = '1';
      }
    })
    .withFailureHandler(function(err) {
      status.style.display = 'block';
      status.style.background = 'rgba(239,68,68,0.15)';
      status.style.border = '1px solid rgba(239,68,68,0.4)';
      status.style.color = '#FCA5A5';
      status.textContent = '❌ ' + (err && err.message ? err.message : 'Error de conexión');
      btn.disabled = false;
      btn.innerHTML = '💾 Guardar y aplicar';
      btn.style.opacity = '1';
    })
    .setUmbralGym(nuevoValor);
}
