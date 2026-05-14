// Guardia por si Avatares.html no cargó primero
if (typeof fechaSeleccionada === 'undefined') var fechaSeleccionada = null;

// Cache de datos para evitar llamadas repetitivas a GAS
var _cacheMetricas   = null;
var _cacheTurnos     = null;
var _cacheResumen    = null;
var _cacheFecha      = null;
var _dashboardLoading = false; // flag para evitar cargas simultáneas

function _invalidarCache() {
  _cacheMetricas = null;
  _cacheTurnos   = null;
  _cacheResumen  = null;
  _cacheFecha    = null;
}

function getFechaHoyMexico() {
  const now = new Date();
  const offset = -6;
  const local = new Date(now.getTime() + offset * 60 * 60 * 1000);
  return local.toISOString().split('T')[0];
}

function loadDashboard(forzar) {
  if (_dashboardLoading) return; // ya hay una carga en curso
  _dashboardLoading = true;

  // Si se pide forzar (después de procesarAsistenciasCompleto, click en Refrescar,
  // etc.), invalidar el cache para que se pidan datos frescos a GAS.
  if (forzar) _invalidarCache();

  showLoading();
  initializeGauges();
  resetKPIValues();

  const inputFecha = document.getElementById('fecha-dashboard');
  if (inputFecha) {
    if (!fechaSeleccionada) fechaSeleccionada = getFechaHoyMexico();
    const hoy = getFechaHoyMexico();
    inputFecha.value = fechaSeleccionada || hoy;
    inputFecha.max = hoy;
    actualizarInfoFecha(fechaSeleccionada || hoy);
  }

  const fechaActual = fechaSeleccionada || getFechaHoyMexico();

  // Si ya tenemos caché válido para esta fecha, reusar
  if (_cacheMetricas && _cacheTurnos && _cacheFecha === fechaActual) {
    updateKPIs(_cacheMetricas);
    if (_cacheResumen) updateProductivityWidgets(_cacheResumen);
    cargarMapaDashboardConDatos(_cacheTurnos, _cacheMetricas);
    loadTendenciaSemanal();
    _dashboardLoading = false;  // ← faltaba liberar el flag al usar cache
    return;
  }

  // Una sola llamada a METRICAS_DIARIAS, luego encadenar el resto
  google.script.run
    .withSuccessHandler(function(rawMetricas) {
      _dashboardLoading = false;
      const rMetricas = safeResult(rawMetricas);
      if (rMetricas.error) { handleError(rMetricas.message); return; }
      _cacheMetricas = rMetricas;
      _cacheFecha    = fechaActual;

      updateKPIs(rMetricas);

      // Cargar TURNOS_DEFAULT una sola vez
      google.script.run
        .withSuccessHandler(function(rawTurnos) {
          const rTurnos = safeResult(rawTurnos);
          if (!rTurnos.error) {
            _cacheTurnos = rTurnos;
            cargarMapaDashboardConDatos(rTurnos, rMetricas);
          }
        })
        .withFailureHandler(function() {})
        .getSheetData('TURNOS_DEFAULT');

      // Cargar RESUMEN para productividad
      google.script.run
        .withSuccessHandler(function(rawResumen) {
          const rResumen = safeResult(rawResumen);
          if (!rResumen.error) {
            _cacheResumen = rResumen;
            updateProductivityWidgets(rResumen);
          }
        })
        .withFailureHandler(function() {})
        .getSheetData('RESUMEN_MENSUAL');
    })
    .withFailureHandler(function(e) { _dashboardLoading = false; handleError(e); })
    .getSheetData('METRICAS_DIARIAS');

  // Avatar overrides (no bloquea el resto)
  google.script.run
    .withSuccessHandler(function(overrides) {
      if (overrides && typeof overrides === 'object') {
        window._avatarOverrides = overrides;
      }
    })
    .withFailureHandler(function() {})
    .getAvatarOverrides();
}

function cargarMapaDashboardConDatos(rTurnos, rMetricas) {
  procesarMapaDashboard(rTurnos, rMetricas);
}

function cargarMapaDashboard() {
  // Versión legacy — usa caché si existe
  if (_cacheTurnos && _cacheMetricas) {
    cargarMapaDashboardConDatos(_cacheTurnos, _cacheMetricas);
    return;
  }
  google.script.run
    .withSuccessHandler(function(overrides) {
      if (overrides && typeof overrides === 'object') window._avatarOverrides = overrides;
      google.script.run
        .withSuccessHandler(function(rawTurnos) {
          const rTurnos = safeResult(rawTurnos);
          if (rTurnos.error) return;
          _cacheTurnos = rTurnos;
          google.script.run
            .withSuccessHandler(function(rawMetricas) {
              const rMetricas = safeResult(rawMetricas);
              if (rMetricas.error) return;
              _cacheMetricas = rMetricas;
              procesarMapaDashboard(rTurnos, rMetricas);
            })
            .withFailureHandler(function() {})
            .getSheetData('METRICAS_DIARIAS');
        })
        .withFailureHandler(function() {})
        .getSheetData('TURNOS_DEFAULT');
    })
    .withFailureHandler(function() {})
    .getAvatarOverrides();
}

function procesarMapaDashboard(rTurnos, rMetricas) {
  const hoy = fechaSeleccionada || getFechaHoyMexico();

  const hT = rTurnos.headers;
  const iNombreT = encontrarColumnaDeNombres(hT);
  const iDeptT = hT.findIndex(function(h) { return h.toString().toUpperCase().includes('DEPARTAMENTO'); });

  let iHorarioT = hT.indexOf('TURNO');
  if (iHorarioT === -1) iHorarioT = hT.findIndex(function(h) { return h.toString() === 'TURNO'; });
  if (iHorarioT === -1) iHorarioT = hT.findIndex(function(h) { return h.toString().toUpperCase().includes('HORARIO'); });
  if (iHorarioT === -1) iHorarioT = 3;

  const hM = rMetricas.headers;
  const iNombreM = encontrarColumnaDeNombres(hM);
  const iFechaM = hM.indexOf('Fecha');
  const iFaltaM = hM.indexOf('Es Falta');
  const iInhabilM = hM.indexOf('Es Día Inhábil');
  const iVacacionesM = hM.indexOf('Es Vacaciones');
  const iEnfermedadM = hM.indexOf('Es Enfermedad');
  const iEntradaM = hM.findIndex(function(h) { return h.toString().includes('Entrada') && !h.toString().includes('Clasificación'); });

  const registrosHoy = rMetricas.data.filter(function(row) {
    const f = row[iFechaM];
    if (!f) return false;
    const fechaRow = f instanceof Date ? f : new Date(f);
    const fechaLocal = new Date(fechaRow.getTime() + (-6 * 60 * 60 * 1000));
    return fechaLocal.toISOString().split('T')[0] === hoy;
  });

  function normalizarNombre(nombre) {
    if (!nombre) return '';
    return nombre.toString().trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  }

  function parsearHoraGAS(valor) {
    if (!valor) return null;
    const str = (valor instanceof Date) ? valor.toISOString() : valor.toString();
    const match = str.match(/T?(\d{1,2}):(\d{2})/);
    if (match) return match[1].padStart(2, '0') + ':' + match[2];
    return null;
  }

  const entradaHoyMap = {};
  registrosHoy.forEach(function(r) {
    const nombreOriginal = (r[iNombreM] || '').toString().trim();
    const nombreNorm = normalizarNombre(nombreOriginal);
    const horaParseada = parsearHoraGAS(r[iEntradaM]);
    if (nombreNorm && horaParseada) {
      entradaHoyMap[nombreNorm] = horaParseada;
      entradaHoyMap[nombreOriginal] = horaParseada;
    }
  });

  const presentesHoyNorm = new Set();
  const presentesHoyOriginal = new Set();
  registrosHoy
    .filter(function(r) { return r[iFaltaM] !== 'SÍ' && r[iInhabilM] !== 'SÍ' && r[iVacacionesM] !== 'SÍ' && r[iEnfermedadM] !== 'SÍ'; })
    .forEach(function(r) {
      const nombreOriginal = (r[iNombreM] || '').toString().trim();
      presentesHoyNorm.add(normalizarNombre(nombreOriginal));
      presentesHoyOriginal.add(nombreOriginal);
    });

  const faltasMesMap = {};
  rMetricas.data.forEach(function(row) {
    const n = normalizarNombre(row[iNombreM]);
    if (!n) return;
    if (!faltasMesMap[n]) faltasMesMap[n] = 0;
    if (row[iFaltaM] === 'SÍ') faltasMesMap[n]++;
  });

  const empleados = rTurnos.data
    .filter(function(row) { return row[iNombreT] && row[iNombreT].toString().trim() !== ''; })
    .map(function(row) {
      const nombreOriginal = row[iNombreT].toString().trim().replace(/\u00A0/g, ' ');
      const nombreNorm = normalizarNombre(nombreOriginal);
      const horaEntrada = entradaHoyMap[nombreNorm] || entradaHoyMap[nombreOriginal] || null;
      const horarioValue = iHorarioT !== -1 ? row[iHorarioT] : null;
      const horario = horarioValue ? horarioValue.toString().trim() : '—';
      const estaPresente = presentesHoyNorm.has(nombreNorm) || presentesHoyOriginal.has(nombreOriginal);

      // Resolver departamento con varios fallbacks
      var deptRaw = iDeptT !== -1 ? row[iDeptT] : null;
      var deptStr = deptRaw == null ? '' : deptRaw.toString().trim();
      if (!deptStr) {
        // Empleado sin departamento — loguear para que el admin lo identifique
        console.warn('⚠️ Empleado sin DEPARTAMENTO en TURNOS_DEFAULT:', nombreOriginal, '(ID:', row[0] + ')');
        deptStr = 'SIN DEPTO';
      }

      return {
        id: row[0],
        nombre: nombreOriginal,
        departamento: deptStr.toUpperCase(),
        horario,
        cumpleanos: row[5] || null,
        fechaContratacion: row[6] || null,
        horaEntrada,
        faltasMes: faltasMesMap[nombreNorm] || 0,
        status: estaPresente ? 'online' : 'offline'
      };
    });

  window._mapaEmpleadosDashboard = empleados;
  renderMapaDashboard(empleados);
}

function renderMapaDashboard(empleados) {
  const container = document.getElementById('mapa-marcadores');
  if (!container) return;

  container.style.cssText = 'width:100%;background:rgba(15,23,42,0.8);border:2px solid rgba(59,130,246,0.3);border-radius:12px;padding:16px;height:auto;min-height:unset;box-sizing:border-box;';

  const porDept = {};
  empleados.forEach(function(emp) {
    const dept = emp.departamento.toUpperCase() || 'SIN DEPTO';
    if (!porDept[dept]) porDept[dept] = [];
    porDept[dept].push(emp);
  });

  // ⭐ Sin template literals anidados — construir con concatenación
  let deptHTML = '';
  // Paleta dinámica para deptos sin config previa
  var _paleta = ['#3B82F6','#10B981','#8B5CF6','#F59E0B','#EF4444','#06B6D4','#EC4899','#84CC16','#F97316','#A855F7'];
  var _iconos = { 'CHOFER':'🚛','CHOFERES':'🚛','COMPRAS':'🛒','DEVOLUCIONES':'↩️','KAM':'⚙️','ALMACENES':'🏭','OPERACIONES':'🏭','PACKING':'📦','PICKING':'🔍','PROYECTO':'🎯','PROYECTOS':'🎯','RRHH':'👥','SEGURIDAD':'🛡️','SISTEMAS':'💻','VENTAS':'💰','LOGISTICA':'📬' };

  function _cfgDepto(nombre, idx) {
    if (typeof DEPARTAMENTOS_CONFIG !== 'undefined' && DEPARTAMENTOS_CONFIG[nombre]) return DEPARTAMENTOS_CONFIG[nombre];
    var color = _paleta[idx % _paleta.length];
    return { icon: _iconos[nombre] || '🏢', color: color, bg: 'rgba(0,0,0,0.15)', border: 'rgba(255,255,255,0.1)' };
  }

  Object.keys(porDept).sort().forEach(function(nombre, idx) {
    const cfg = _cfgDepto(nombre, idx);
    const emps = porDept[nombre] || [];
    const presentes = emps.filter(function(e) { return e.status === 'online'; });
    const total = emps.length;
    const pct = total > 0 ? Math.round((presentes.length / total) * 100) : 0;

    let avatarsHTML = '';
    presentes.forEach(function(emp) {
      const primerNombre = emp.nombre.trim().replace(/\s+/g, ' ').split(' ')[0];
      avatarsHTML +=
        '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;transition:transform 0.2s;"' +
          ' title="' + emp.nombre + ' · ' + emp.departamento + '"' +
          ' onmouseover="this.style.transform=\'scale(1.15)\'"' +
          ' onmouseout="this.style.transform=\'scale(1)\'"' +
          ' onclick="mostrarModalEmpleado(\'' + emp.id + '\',\'' + emp.nombre.replace(/'/g, "\\'") + '\',\'' + emp.departamento + '\')">' +
          '<div style="position:relative;">' +
            crearAvatarElement(emp.nombre, 78) +
            '<div style="position:absolute;bottom:2px;right:2px;width:12px;height:12px;border-radius:50%;background:#10B981;border:2px solid #0F172A;box-shadow:0 0 6px #10B981;"></div>' +
          '</div>' +
          '<span style="font-size:14px;color:#94A3B8;font-weight:600;text-align:center;white-space:nowrap;">' + primerNombre + '</span>' +
        '</div>';
    });

    const sinPresentes = presentes.length === 0 ? '<span style="font-size:10px;color:#4B5563;font-style:italic;">Sin presentes</span>' : '';

    deptHTML +=
      '<div style="background:' + cfg.bg + ';border:1px solid ' + cfg.border + ';border-radius:10px;padding:10px 12px;box-sizing:border-box;">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">' +
          '<span style="font-size:14px;">' + cfg.icon + '</span>' +
          '<span style="font-size:13px;font-weight:800;letter-spacing:1px;color:' + cfg.color + ';text-transform:uppercase;">' + nombre + '</span>' +
          '<span style="margin-left:auto;font-size:13px;font-weight:700;color:' + cfg.color + ';">' + presentes.length + '/' + total + '</span>' +
        '</div>' +
        '<div style="height:2px;background:rgba(255,255,255,0.06);border-radius:2px;margin-bottom:8px;overflow:hidden;">' +
          '<div style="height:100%;width:' + pct + '%;background:' + cfg.color + ';border-radius:2px;transition:width 0.6s;"></div>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;">' +
          avatarsHTML + sinPresentes +
        '</div>' +
      '</div>';
  });

  const ausentes = empleados.filter(function(e) { return e.status === 'offline'; });
  let ausentesHTML = '';
  ausentes.forEach(function(emp) {
    const primerNombre = emp.nombre.trim().replace(/\s+/g, ' ').split(' ')[0];
    ausentesHTML +=
      '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;transition:all 0.2s;opacity:0.4;filter:grayscale(1);"' +
        ' title="' + emp.nombre + ' · ' + emp.departamento + '"' +
        ' onmouseover="this.style.opacity=\'0.7\';this.style.transform=\'scale(1.1)\'"' +
        ' onmouseout="this.style.opacity=\'0.4\';this.style.transform=\'scale(1)\'"' +
        ' onclick="mostrarModalEmpleado(\'' + emp.id + '\',\'' + emp.nombre.replace(/'/g, "\\'") + '\',\'' + emp.departamento + '\')">' +
        '<div style="position:relative;">' +
          crearAvatarElement(emp.nombre, 78) +
          '<div style="position:absolute;bottom:1px;right:1px;width:8px;height:8px;border-radius:50%;background:#4B5563;border:1.5px solid #0F172A;"></div>' +
        '</div>' +
        '<span style="font-size:14px;color:#4B5563;font-weight:600;text-align:center;white-space:nowrap;">' + primerNombre + '</span>' +
      '</div>';
  });

  const gridCols = window.innerWidth <= 768 ? '1fr' : 'repeat(3,1fr)';
  const ausentesVacio = '<span style="font-size:11px;color:#10B981;font-style:italic;">🎉 ¡Todos presentes!</span>';

  container.innerHTML =
    '<div style="display:grid;grid-template-columns:' + gridCols + ';gap:10px;margin-bottom:16px;align-items:start;">' +
      deptHTML +
    '</div>' +
    '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:14px;">' +
      '<div style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#4B5563;margin-bottom:10px;">⚫ Ausentes (' + ausentes.length + ')</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;">' +
        (ausentes.length === 0 ? ausentesVacio : ausentesHTML) +
      '</div>' +
    '</div>';
}

function mostrarModalEmpleado(id, nombre, departamento) {
  const emp = (window._mapaEmpleadosDashboard || []).find(function(e) { return e.nombre === nombre; }) || {};
  const dc = DEPARTAMENTOS_CONFIG[(departamento || '').toUpperCase()] || Object.values(DEPARTAMENTOS_CONFIG)[0] || { icon: '🏢', color: '#64748B', border: 'rgba(100,116,139,0.4)' };

  let cumpleanosTexto = '';
  let contratacionTexto = '';
  let antiguedadTexto = '';

  if (emp.cumpleanos) {
    try { cumpleanosTexto = new Date(emp.cumpleanos).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }); } catch(e) {}
  }
  if (emp.fechaContratacion) {
    try {
      const fc = new Date(emp.fechaContratacion);
      contratacionTexto = fc.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
      const hoy = new Date();
      let años = hoy.getFullYear() - fc.getFullYear();
      let meses = hoy.getMonth() - fc.getMonth();
      let dias = hoy.getDate() - fc.getDate();
      if (dias < 0) { meses--; dias += new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate(); }
      if (meses < 0) { años--; meses += 12; }
      if (años > 0 || meses > 0) {
        antiguedadTexto = (años > 0 ? años + ' año' + (años !== 1 ? 's' : '') : '')
          + (años > 0 && meses > 0 ? ', ' : '')
          + (meses > 0 ? meses + ' mes' + (meses !== 1 ? 'es' : '') : '');
      } else {
        antiguedadTexto = dias + ' día' + (dias !== 1 ? 's' : '');
      }
    } catch(e) {}
  }

  // ⭐ Sin template literals anidados
  let extraHTML = '';
  if (cumpleanosTexto || contratacionTexto) {
    extraHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">' +
        '<div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">' +
          '<div style="font-size:15px;font-weight:800;color:#F1F5F9;">' + (cumpleanosTexto ? '🎂 ' + cumpleanosTexto : '—') + '</div>' +
          '<div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Cumpleaños</div>' +
        '</div>' +
        '<div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">' +
          '<div style="font-size:14px;font-weight:800;color:#F1F5F9;">' + (contratacionTexto || '—') + '</div>' +
          '<div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Contratación</div>' +
        '</div>' +
      '</div>';
    if (antiguedadTexto) {
      extraHTML +=
        '<div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:12px;text-align:center;margin-bottom:8px;">' +
          '<div style="font-size:16px;font-weight:800;color:#3B82F6;">⏱️ ' + antiguedadTexto + '</div>' +
          '<div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Antigüedad</div>' +
        '</div>';
    }
  }

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);z-index:10001;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s ease;';

  modal.innerHTML =
    '<div style="background:rgba(15,23,42,0.98);border:2px solid ' + dc.color + ';border-radius:16px;max-width:760px;width:95%;max-height:90vh;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);animation:slideUp 0.3s ease;display:flex;flex-direction:column;">' +
      '<div style="display:flex;align-items:center;gap:14px;padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">' +
        '<div style="position:relative;flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:6px;">' +
          crearAvatarElement(nombre, 84) +
          '<button onclick="abrirSelectorAvatar(\'' + nombre.replace(/'/g, "\\'") + '\')" style="background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.4);border-radius:6px;color:#3B82F6;font-size:10px;font-weight:700;cursor:pointer;padding:3px 8px;white-space:nowrap;">✎ Cambiar</button>' +
        '</div>' +
        '<div style="flex:1;">' +
          '<div style="font-size:18px;font-weight:800;color:#F1F5F9;">' + nombre + '</div>' +
          '<div style="font-size:13px;color:' + dc.color + ';margin-top:2px;">' + dc.icon + ' ' + departamento + '</div>' +
          '<div style="font-size:12px;color:#64748B;margin-top:2px;">ID: ' + id + '</div>' +
        '</div>' +
        '<button id="btn-cerrar-modal-emp" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#94A3B8;width:36px;height:36px;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;flex:1;overflow:hidden;">' +
        '<div style="padding:20px;border-right:1px solid rgba(255,255,255,0.06);overflow-y:auto;display:flex;flex-direction:column;justify-content:space-between;gap:16px;">' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
            '<div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">' +
              '<div style="font-size:15px;font-weight:800;color:#F1F5F9;white-space:nowrap;">' + (emp.horario || '—') + '</div>' +
              '<div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Horario</div>' +
            '</div>' +
            '<div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">' +
              '<div style="font-size:15px;font-weight:800;color:' + (emp.horaEntrada ? '#10B981' : '#4B5563') + ';white-space:nowrap;">' + (emp.horaEntrada || '—') + '</div>' +
              '<div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Entrada hoy</div>' +
            '</div>' +
          '</div>' +
          extraHTML +
          '<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15);border-radius:10px;padding:12px;text-align:center;">' +
            '<div style="font-size:30px;font-weight:800;color:#EF4444;">' + (emp.faltasMes !== undefined ? emp.faltasMes : '—') + '</div>' +
            '<div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Faltas este mes</div>' +
          '</div>' +
        '</div>' +
        '<div style="padding:20px;overflow-y:auto;">' +
          '<div id="modal-emp-resumen">' +
            '<div style="text-align:center;padding:40px;color:#64748B;">' +
              '<div style="width:24px;height:24px;border:2px solid rgba(59,130,246,0.3);border-top-color:#3B82F6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 8px;"></div>' +
              'Cargando resumen mensual...' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
  modal.querySelector('#btn-cerrar-modal-emp').onclick = function() { modal.remove(); };
  document.body.appendChild(modal);

  // Cargar resumen mensual
  google.script.run
    .withSuccessHandler(function(raw) {
      const result = safeResult(raw);
      const el = document.getElementById('modal-emp-resumen');
      if (!el) return;
      if (result.error || !result.data) { el.innerHTML = ''; return; }

      const h = result.headers;
      const iNombre    = encontrarColumnaDeNombres(h);
      const iDiasTrab  = h.indexOf('Días Trabajados');
      const iDiasPunt  = h.indexOf('Días Puntuales');
      const iDiasTol   = h.indexOf('Días Tolerancia');
      const iDiasRet   = h.indexOf('Días Retardo');
      const iDiasFalta = h.indexOf('Días Falta');
      const iDiasVac   = h.indexOf('Días Vacaciones');
      const iDiasEnf   = h.indexOf('Días Enfermedad');
      const iTotalHrs  = h.indexOf('Total Horas');
      const iPunt      = h.indexOf('% Puntualidad');

      const fila = result.data.find(function(row) {
        return (row[iNombre] || '').toString().trim().toLowerCase() === nombre.toLowerCase();
      });

      if (!fila) { el.innerHTML = '<div style="text-align:center;padding:20px;color:#64748B;">Sin datos de resumen mensual</div>'; return; }

      const diasTrab  = fila[iDiasTrab]  || 0;
      const diasPunt  = fila[iDiasPunt]  || 0;
      const diasTol   = fila[iDiasTol]   || 0;
      const diasRet   = fila[iDiasRet]   || 0;
      const diasFalta = fila[iDiasFalta] || 0;
      const diasVac   = fila[iDiasVac]   || 0;
      const diasEnf   = fila[iDiasEnf]   || 0;
      const totalHrs  = parseFloat(fila[iTotalHrs]) || 0;
      const pctPunt   = parseFloat(fila[iPunt]) * 100 || 0;

      const badgeColor = diasFalta > 2 ? '#EF4444' : diasRet > 5 ? '#F59E0B' : '#10B981';
      const badgeText  = diasFalta > 2 ? '🚨 CRÍTICO' : diasRet > 5 ? '⚠️ ADVERTENCIA' : '✅ BIEN';
      const colorPunt  = pctPunt >= 80 ? '#10B981' : '#EF4444';

      // ⭐ Sin template literals anidados — filas de resumen con concatenación
      const filasResumen = [
        ['📅 Días trabajados', diasTrab,  '#F1F5F9'],
        ['✅ Días puntuales',  diasPunt,  '#10B981'],
        ['⚠️ Días tolerancia', diasTol,   '#F59E0B'],
        ['⏰ Días retardo',    diasRet,   '#EF4444'],
        ['🏖️ Días vacaciones', diasVac,   '#3B82F6'],
        ['🏥 Días enfermedad', diasEnf,   '#8B5CF6'],
      ];

      let filasHTML = '';
      filasResumen.forEach(function(item) {
        filasHTML +=
          '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-bottom:1px solid rgba(51,65,85,0.3);font-size:13px;">' +
            '<span style="color:#94A3B8;">' + item[0] + '</span>' +
            '<span style="font-weight:700;color:' + item[2] + ';">' + item[1] + '</span>' +
          '</div>';
      });

      el.innerHTML =
        '<div style="font-size:14px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#64748B;margin-bottom:14px;text-align:center;">📊 Resumen del mes</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">' +
          '<div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">' +
            '<div style="font-size:22px;font-weight:800;color:#3B82F6;">' + totalHrs.toFixed(1) + '</div>' +
            '<div style="font-size:9px;color:#64748B;text-transform:uppercase;margin-top:4px;">Total horas</div>' +
          '</div>' +
          '<div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">' +
            '<div style="font-size:22px;font-weight:800;color:' + colorPunt + ';">' + pctPunt.toFixed(1) + '%</div>' +
            '<div style="font-size:9px;color:#64748B;text-transform:uppercase;margin-top:4px;">Puntualidad</div>' +
          '</div>' +
        '</div>' +
        '<div style="background:rgba(30,41,59,0.6);border:1px solid rgba(51,65,85,0.5);border-radius:10px;overflow:hidden;margin-bottom:12px;">' +
          filasHTML +
        '</div>' +
        '<div style="text-align:center;padding:10px;border-radius:8px;border:1px solid ' + badgeColor + '33;background:' + badgeColor + '11;">' +
          '<span style="font-size:13px;font-weight:800;color:' + badgeColor + ';">' + badgeText + '</span>' +
        '</div>';
    })
    .withFailureHandler(function() {
      const el = document.getElementById('modal-emp-resumen');
      if (el) el.innerHTML = '<div style="text-align:center;padding:20px;color:#EF4444;">❌ Error cargando datos</div>';
    })
    .getSheetData('RESUMEN_MENSUAL');
}

// ============================================================================
// SELECTOR DE FECHA PARA DASHBOARD
// ============================================================================

function recargarDashboardPorFecha() {
  const inputFecha = document.getElementById('fecha-dashboard');
  if (!inputFecha) return;
  const fechaSeleccionadaNueva = inputFecha.value;
  if (!fechaSeleccionadaNueva) { alert('Por favor selecciona una fecha válida'); return; }
  fechaSeleccionada = fechaSeleccionadaNueva;
  actualizarInfoFecha(fechaSeleccionada);
  _invalidarCache();
  _dashboardLoading = false;
  loadDashboard();
}

function resetearAHoy() {
  const hoy = getFechaHoyMexico();
  fechaSeleccionada = hoy;
  const inputFecha = document.getElementById('fecha-dashboard');
  if (inputFecha) inputFecha.value = hoy;
  actualizarInfoFecha(hoy);
  // Invalidar cache y reusar el flujo unificado de loadDashboard
  _invalidarCache();
  _dashboardLoading = false;
  loadDashboard(true);
}

function actualizarInfoFecha(fecha) {
  const infoDiv = document.getElementById('fecha-seleccionada-info');
  if (!infoDiv) return;
  const fechaObj = new Date(fecha + 'T12:00:00');
  const hoy = getFechaHoyMexico();
  const fechaFormateada = fechaObj.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  if (fecha === hoy) {
    infoDiv.innerHTML = '<i class="fas fa-check-circle" style="color:#10B981;"></i> Mostrando datos de <strong>hoy</strong>';
    infoDiv.style.background = 'rgba(16,185,129,0.1)';
    infoDiv.style.color = '#10B981';
  } else {
    infoDiv.innerHTML = '<i class="fas fa-calendar-alt" style="color:#3B82F6;"></i> ' + fechaFormateada;
    infoDiv.style.background = 'rgba(59,130,246,0.1)';
    infoDiv.style.color = '#3B82F6';
  }
}
