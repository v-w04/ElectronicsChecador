// ============================================================================
// INYECTAR CHECADORES
// ============================================================================

const FOLDER_RAW        = '17QFe1WKQ-bj8qfDzuX8eoBq9qGYE1Wlf';
const FOLDER_RAW_ADOLFO = '14W6FWPZHIYlqmX5pcMdB5ztS0AIL268F';

function renderInyectarChecadores() {
  document.getElementById('popup-title').textContent = 'Inyectar Checadores';
  const container = document.getElementById('popup-container');

  container.innerHTML =
    '<div style="max-width:100%;margin:0 auto;">' +

    '<div style="background:rgba(59,130,246,0.1);border:2px solid #3B82F6;border-radius:12px;padding:20px;margin-bottom:28px;">' +
      '<h3 style="color:#3B82F6;margin-bottom:10px;display:flex;align-items:center;gap:8px;"><i class="fas fa-info-circle"></i> Instrucciones</h3>' +
      '<ul style="color:#94A3B8;line-height:1.9;margin-left:20px;">' +
        '<li>Sube los archivos exportados del checador a la carpeta de Drive correspondiente.</li>' +
        '<li>Haz clic en <strong>Actualizar lista</strong> para ver los archivos disponibles.</li>' +
        '<li>Selecciona uno o varios archivos con los checkboxes.</li>' +
        '<li>Presiona <strong>Inyectar</strong> para cargar los datos en la hoja correspondiente.</li>' +
      '</ul>' +
    '</div>' +

    '<div style="margin-bottom:40px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
        '<h3 style="color:#F1F5F9;font-size:19px;display:flex;align-items:center;gap:10px;"><i class="fas fa-database" style="color:#10B981;"></i> RAW VALLE</h3>' +
        '<div style="display:flex;gap:10px;">' +
          '<button onclick="seleccionarTodos(\'valle\')" style="padding:9px 16px;background:rgba(16,185,129,0.1);border:1px solid #10B981;border-radius:8px;color:#10B981;font-weight:600;cursor:pointer;font-size:13px;"><i class="fas fa-check-double"></i> Seleccionar todos</button>' +
          '<button onclick="cargarListaArchivos(\'valle\')" style="padding:9px 16px;background:rgba(59,130,246,0.1);border:1px solid #3B82F6;border-radius:8px;color:#3B82F6;font-weight:600;cursor:pointer;font-size:13px;"><i class="fas fa-sync-alt"></i> Actualizar lista</button>' +
          '<button onclick="inyectarDesdeListaDrive(\'valle\')" style="padding:9px 20px;background:linear-gradient(135deg,#10B981,#059669);border:none;border-radius:8px;color:white;font-weight:700;cursor:pointer;font-size:13px;box-shadow:0 4px 12px rgba(16,185,129,0.3);"><i class="fas fa-upload"></i> Inyectar a RAW</button>' +
        '</div>' +
      '</div>' +
      '<div id="lista-valle" style="background:rgba(30,41,59,0.6);border:1px solid rgba(51,65,85,0.5);border-radius:12px;padding:16px;min-height:80px;">' +
        '<div style="color:#64748B;font-size:13px;text-align:center;padding:20px;"><i class="fas fa-folder-open" style="font-size:24px;margin-bottom:8px;display:block;"></i>Haz clic en "Actualizar lista" para ver los archivos disponibles</div>' +
      '</div>' +
      '<div id="resultado-valle" style="margin-top:10px;"></div>' +
    '</div>' +

    '<div style="margin-bottom:40px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
        '<h3 style="color:#F1F5F9;font-size:19px;display:flex;align-items:center;gap:10px;"><i class="fas fa-database" style="color:#8B5CF6;"></i> RAW ADOLFO</h3>' +
        '<div style="display:flex;gap:10px;">' +
          '<button onclick="seleccionarTodos(\'adolfo\')" style="padding:9px 16px;background:rgba(139,92,246,0.1);border:1px solid #8B5CF6;border-radius:8px;color:#8B5CF6;font-weight:600;cursor:pointer;font-size:13px;"><i class="fas fa-check-double"></i> Seleccionar todos</button>' +
          '<button onclick="cargarListaArchivos(\'adolfo\')" style="padding:9px 16px;background:rgba(59,130,246,0.1);border:1px solid #3B82F6;border-radius:8px;color:#3B82F6;font-weight:600;cursor:pointer;font-size:13px;"><i class="fas fa-sync-alt"></i> Actualizar lista</button>' +
          '<button onclick="inyectarDesdeListaDrive(\'adolfo\')" style="padding:9px 20px;background:linear-gradient(135deg,#8B5CF6,#7C3AED);border:none;border-radius:8px;color:white;font-weight:700;cursor:pointer;font-size:13px;box-shadow:0 4px 12px rgba(139,92,246,0.3);"><i class="fas fa-upload"></i> Inyectar a RAW_ADOLFO</button>' +
        '</div>' +
      '</div>' +
      '<div id="lista-adolfo" style="background:rgba(30,41,59,0.6);border:1px solid rgba(51,65,85,0.5);border-radius:12px;padding:16px;min-height:80px;">' +
        '<div style="color:#64748B;font-size:13px;text-align:center;padding:20px;"><i class="fas fa-folder-open" style="font-size:24px;margin-bottom:8px;display:block;"></i>Haz clic en "Actualizar lista" para ver los archivos disponibles</div>' +
      '</div>' +
      '<div id="resultado-adolfo" style="margin-top:10px;"></div>' +
    '</div>' +

  '</div>';

  setTimeout(() => {
    cargarListaArchivos('valle');
    cargarListaArchivos('adolfo');
  }, 200);
}

function cargarListaArchivos(cual) {
  const folderId = cual === 'valle' ? FOLDER_RAW : FOLDER_RAW_ADOLFO;
  const contenedor = document.getElementById('lista-' + cual);
  const color = cual === 'valle' ? '#10B981' : '#8B5CF6';

  contenedor.innerHTML = '<div style="color:#64748B;text-align:center;padding:20px;"><div style="width:20px;height:20px;border:2px solid rgba(59,130,246,0.3);border-top-color:#3B82F6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 8px;"></div>Leyendo carpeta de Drive...</div>';

  google.script.run
    .withSuccessHandler(function(res) {
      if (!res.ok) { contenedor.innerHTML = '<div style="color:#EF4444;padding:16px;">❌ Error: ' + res.error + '</div>'; return; }
      if (res.archivos.length === 0) { contenedor.innerHTML = '<div style="color:#64748B;text-align:center;padding:20px;">📂 La carpeta está vacía</div>'; return; }

      const filas = res.archivos.map(function(f) {
        return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid rgba(51,65,85,0.3);transition:background 0.15s;" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'transparent\'">' +
          '<input type="checkbox" data-fileid="' + f.id + '" data-nombre="' + f.nombre + '" style="width:16px;height:16px;cursor:pointer;accent-color:' + color + ';">' +
          '<i class="fas fa-file-excel" style="color:' + color + ';font-size:16px;flex-shrink:0;"></i>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="color:#F1F5F9;font-size:17px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + f.nombre + '</div>' +
            '<div style="color:#64748B;font-size:11px;margin-top:2px;">' + f.fecha + ' · ' + f.tamaño + '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      contenedor.innerHTML = '<div style="border-radius:8px;overflow:hidden;">' + filas + '</div>' +
        '<div style="margin-top:10px;font-size:12px;color:#64748B;padding:0 4px;">' + res.archivos.length + ' archivo' + (res.archivos.length !== 1 ? 's' : '') + ' disponible' + (res.archivos.length !== 1 ? 's' : '') + '</div>';
    })
    .withFailureHandler(function(err) {
      contenedor.innerHTML = '<div style="color:#EF4444;padding:16px;">❌ Error: ' + err.message + '</div>';
    })
    .getArchivosEnCarpeta(folderId);
}

function seleccionarTodos(cual) {
  const contenedor = document.getElementById('lista-' + cual);
  const checkboxes = contenedor.querySelectorAll('input[type="checkbox"]');
  const todosSeleccionados = [...checkboxes].every(c => c.checked);
  checkboxes.forEach(c => c.checked = !todosSeleccionados);
}

function inyectarDesdeListaDrive(cual) {
  const sheetDestino = cual === 'valle' ? 'RAW' : 'RAW_ADOLFO';
  const contenedor = document.getElementById('lista-' + cual);
  const resultado = document.getElementById('resultado-' + cual);
  const checkboxes = [...contenedor.querySelectorAll('input[type="checkbox"]:checked')];

  if (checkboxes.length === 0) {
    resultado.innerHTML = '<div style="color:#F59E0B;font-size:13px;padding:8px 0;">⚠️ Selecciona al menos un archivo</div>';
    return;
  }

  resultado.innerHTML = '<div style="color:#3B82F6;font-size:13px;padding:8px 0;display:flex;align-items:center;gap:8px;"><div style="width:14px;height:14px;border:2px solid rgba(59,130,246,0.3);border-top-color:#3B82F6;border-radius:50%;animation:spin 0.8s linear infinite;"></div>Inyectando ' + checkboxes.length + ' archivo' + (checkboxes.length > 1 ? 's' : '') + '...</div>';

  let totalRegistros = 0;
  let errores = [];

  function procesarSiguiente(index, limpiar) {
    if (index >= checkboxes.length) {
      if (errores.length === 0) {
        resultado.innerHTML = '<div style="background:rgba(16,185,129,0.1);border:1px solid #10B981;border-radius:8px;padding:12px 16px;color:#10B981;font-size:13px;font-weight:600;">✅ ' + totalRegistros + ' registros inyectados en ' + sheetDestino + ' desde ' + checkboxes.length + ' archivo' + (checkboxes.length > 1 ? 's' : '') + '</div>';
      } else {
        resultado.innerHTML = '<div style="background:rgba(239,68,68,0.1);border:1px solid #EF4444;border-radius:8px;padding:12px 16px;color:#EF4444;font-size:13px;">⚠️ ' + totalRegistros + ' registros inyectados. Errores:<br>' + errores.map(function(e) { return '• ' + e; }).join('<br>') + '</div>';
      }
      return;
    }

    const cb = checkboxes[index];
    const fileId = cb.dataset.fileid;
    const nombre = cb.dataset.nombre;

    resultado.innerHTML = '<div style="color:#3B82F6;font-size:13px;padding:8px 0;display:flex;align-items:center;gap:8px;"><div style="width:14px;height:14px;border:2px solid rgba(59,130,246,0.3);border-top-color:#3B82F6;border-radius:50%;animation:spin 0.8s linear infinite;"></div>Procesando archivo ' + (index + 1) + ' de ' + checkboxes.length + ': ' + nombre + '</div>';

    google.script.run
      .withSuccessHandler(function(res) {
        if (res.ok) { totalRegistros += res.registros; } else { errores.push(nombre + ': ' + res.error); }
        procesarSiguiente(index + 1, false);
      })
      .withFailureHandler(function(err) {
        errores.push(nombre + ': ' + err.message);
        procesarSiguiente(index + 1, false);
      })
      .inyectarDesdeArchivoDrive(fileId, sheetDestino, limpiar);
  }

  procesarSiguiente(0, true);
}

// ============================================================================
// INYECTAR EVENTUALIDADES
// ============================================================================

function renderInyectarEventualidades() {
  document.getElementById('popup-title').textContent = 'Inyectar Eventualidades';
  const container = document.getElementById('popup-container');

  container.innerHTML =
    '<div style="max-width:100%;margin:0 auto;">' +

    '<div style="background:rgba(139,92,246,0.1);border:2px solid #8B5CF6;border-radius:12px;padding:20px;margin-bottom:32px;">' +
      '<h3 style="color:#8B5CF6;margin-bottom:12px;display:flex;align-items:center;gap:8px;"><i class="fas fa-info-circle"></i> Instrucciones</h3>' +
      '<ul style="color:#94A3B8;line-height:1.8;margin-left:20px;">' +
        '<li>Copia los datos desde Excel <strong>(sin headers)</strong></li>' +
        '<li><strong>Pégalos en la tabla correspondiente</strong> (Ctrl+V / Cmd+V)</li>' +
        '<li>Puedes pegar <strong>múltiples veces</strong> para agregar más datos</li>' +
        '<li>Los datos se agregarán <strong>DEBAJO</strong> de lo existente en Sheets</li>' +
        '<li>Presiona <strong>"Inyectar"</strong> para enviar</li>' +
        '<li>⚠️ <strong>NO elimina</strong> datos previos en Sheets</li>' +
      '</ul>' +
    '</div>' +

    '<div style="margin-bottom:40px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<h3 style="color:#F1F5F9;font-size:20px;display:flex;align-items:center;gap:10px;"><i class="fas fa-notes-medical" style="color:#F59E0B;"></i> 🏥 ENFERMEDADES / PERMISOS MÉDICOS</h3>' +
        '<div style="display:flex;gap:12px;">' +
          '<button onclick="reinicializarTablaEventualidad(\'table-enfermedades\')" style="padding:12px 20px;background:rgba(239,68,68,0.2);border:1px solid var(--danger);border-radius:8px;color:var(--danger);font-weight:700;cursor:pointer;"><i class="fas fa-trash"></i> Limpiar</button>' +
          '<button onclick="inyectarEventualidad(\'ENFERMEDADES\', \'table-enfermedades\')" style="padding:12px 24px;background:linear-gradient(135deg,#F59E0B,#D97706);border:none;border-radius:8px;color:white;font-weight:700;cursor:pointer;"><i class="fas fa-upload"></i> Inyectar</button>' +
        '</div>' +
      '</div>' +
      '<div style="background:rgba(30,41,59,0.6);border:1px solid rgba(51,65,85,0.5);border-radius:12px;padding:16px;">' +
        '<div style="color:#94A3B8;font-size:12px;margin-bottom:8px;"><strong>Columnas en Sheets:</strong> G) Nombre | H) Fecha | I) Tipo | J) Salió Temprano | K) Hora Salida</div>' +
        '<div style="overflow-x:auto;"><table id="table-enfermedades" class="editable-table"></table></div>' +
        '<div style="margin-top:12px;font-size:12px;color:#94A3B8;"><span id="count-enfermedades">0 filas</span></div>' +
      '</div>' +
    '</div>' +

    '<div style="margin-bottom:40px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<h3 style="color:#F1F5F9;font-size:20px;display:flex;align-items:center;gap:10px;"><i class="fas fa-calendar-star" style="color:#EC4899;"></i> 🎉 DÍAS FESTIVOS</h3>' +
        '<div style="display:flex;gap:12px;">' +
          '<button onclick="reinicializarTablaEventualidad(\'table-festivos\')" style="padding:12px 20px;background:rgba(239,68,68,0.2);border:1px solid var(--danger);border-radius:8px;color:var(--danger);font-weight:700;cursor:pointer;"><i class="fas fa-trash"></i> Limpiar</button>' +
          '<button onclick="inyectarEventualidad(\'DIAS_FESTIVOS\', \'table-festivos\')" style="padding:12px 24px;background:linear-gradient(135deg,#EC4899,#DB2777);border:none;border-radius:8px;color:white;font-weight:700;cursor:pointer;"><i class="fas fa-upload"></i> Inyectar</button>' +
        '</div>' +
      '</div>' +
      '<div style="background:rgba(30,41,59,0.6);border:1px solid rgba(51,65,85,0.5);border-radius:12px;padding:16px;">' +
        '<div style="color:#94A3B8;font-size:12px;margin-bottom:8px;"><strong>Columnas en Sheets:</strong> K) Fecha | L) Descripción</div>' +
        '<div style="overflow-x:auto;"><table id="table-festivos" class="editable-table"></table></div>' +
        '<div style="margin-top:12px;font-size:12px;color:#94A3B8;"><span id="count-festivos">0 filas</span></div>' +
      '</div>' +
    '</div>' +

  '</div>';

  setTimeout(() => {
    inicializarTablaEventualidad('table-enfermedades', 5, 'count-enfermedades');
    inicializarTablaEventualidad('table-festivos', 2, 'count-festivos');
  }, 100);
}

// ============================================================================
// INYECTAR INCIDENCIAS
// ============================================================================

function renderInyectarIncidencias() {
  document.getElementById('popup-title').textContent = 'Registrar Incidencia';
  const container = document.getElementById('popup-container');

  container.innerHTML =
    '<div style="max-width:600px;margin:0 auto;">' +

    '<div style="background:rgba(245,158,11,0.1);border:2px solid #F59E0B;border-radius:12px;padding:20px;margin-bottom:32px;">' +
      '<h3 style="color:#F59E0B;margin-bottom:12px;display:flex;align-items:center;gap:8px;"><i class="fas fa-info-circle"></i> Instrucciones</h3>' +
      '<ul style="color:#94A3B8;line-height:1.8;margin-left:20px;">' +
        '<li>Selecciona el <strong>empleado</strong> afectado</li>' +
        '<li>Elige el <strong>tipo de actividad/incidencia</strong></li>' +
        '<li>Opcionalmente registra <strong>hora final</strong></li>' +
        '<li>Agrega <strong>observaciones</strong> si es necesario</li>' +
        '<li>Las incidencias de <strong>Uniforme, Botas y Celular</strong> afectan elegibilidad de bono</li>' +
      '</ul>' +
    '</div>' +

    '<div style="background:rgba(30,41,59,0.6);border:1px solid rgba(51,65,85,0.5);border-radius:12px;padding:24px;">' +

      '<div style="margin-bottom:20px;">' +
        '<label style="display:block;color:#F1F5F9;font-weight:600;margin-bottom:8px;"><i class="fas fa-user"></i> Empleado</label>' +
        '<select id="select-empleado-incidencia" style="width:100%;padding:12px;background:rgba(15,23,42,0.8);border:2px solid rgba(59,130,246,0.3);color:#F1F5F9;border-radius:8px;font-size:14px;cursor:pointer;">' +
          '<option value="">Seleccionar empleado...</option>' +
        '</select>' +
      '</div>' +

      '<div style="margin-bottom:20px;">' +
        '<label style="display:block;color:#F1F5F9;font-weight:600;margin-bottom:8px;"><i class="fas fa-tags"></i> Actividad</label>' +
        '<select id="select-actividad-incidencia" style="width:100%;padding:12px;background:rgba(15,23,42,0.8);border:2px solid rgba(245,158,11,0.3);color:#F1F5F9;border-radius:8px;font-size:14px;cursor:pointer;">' +
          '<option value="">Seleccionar actividad...</option>' +
        '</select>' +
      '</div>' +

      '<div style="margin-bottom:20px;">' +
        '<label style="display:block;color:#F1F5F9;font-weight:600;margin-bottom:8px;"><i class="fas fa-clock"></i> Hora Final (Opcional)</label>' +
        '<input type="time" id="input-hora-final" style="width:100%;padding:12px;background:rgba(15,23,42,0.8);border:2px solid rgba(100,116,139,0.3);color:#F1F5F9;border-radius:8px;font-size:14px;">' +
      '</div>' +

      '<div style="margin-bottom:24px;">' +
        '<label style="display:block;color:#F1F5F9;font-weight:600;margin-bottom:8px;"><i class="fas fa-comment"></i> Observaciones</label>' +
        '<textarea id="textarea-observaciones" rows="3" placeholder="Detalles adicionales..." style="width:100%;padding:12px;background:rgba(15,23,42,0.8);border:2px solid rgba(100,116,139,0.3);color:#F1F5F9;border-radius:8px;font-size:14px;resize:vertical;font-family:inherit;"></textarea>' +
      '</div>' +

      '<button id="btn-registrar-incidencia" style="width:100%;padding:16px;background:linear-gradient(135deg,#F59E0B,#D97706);border:none;border-radius:8px;color:white;font-weight:700;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;">' +
        '<i class="fas fa-save"></i> Registrar Incidencia' +
      '</button>' +

    '</div>' +
  '</div>';

  setTimeout(() => {
    cargarEmpleadosParaIncidencia();
    cargarActividadesIncidencias();
    const btnRegistrar = document.getElementById('btn-registrar-incidencia');
    if (btnRegistrar) btnRegistrar.addEventListener('click', registrarIncidencia);
  }, 100);
}

function cargarEmpleadosParaIncidencia() {
  google.script.run
    .withSuccessHandler(function(result) {
      if (!result || result.error === true) return;
      const select = document.getElementById('select-empleado-incidencia');
      if (!select) return;
      const nombres = result.data.map(row => row[1]).filter(nombre => nombre && nombre.trim() !== '').sort();
      nombres.forEach(nombre => {
        const option = document.createElement('option');
        option.value = nombre;
        option.textContent = nombre;
        select.appendChild(option);
      });
    })
    .withFailureHandler(function(error) { mostrarNotificacion('error', 'Error cargando empleados'); })
    .getSheetData('TURNOS_DEFAULT');
}

function cargarActividadesIncidencias() {
  google.script.run
    .withSuccessHandler(function(result) {
      if (!result || result.error === true) return;
      const select = document.getElementById('select-actividad-incidencia');
      if (!select) return;
      result.actividades.forEach(actividad => {
        const option = document.createElement('option');
        option.value = actividad;
        option.textContent = actividad;
        select.appendChild(option);
      });
    })
    .withFailureHandler(function(error) { mostrarNotificacion('error', 'Error cargando actividades'); })
    .getActividadesIncidencias();
}

function registrarIncidencia() {
  const empleado = document.getElementById('select-empleado-incidencia').value;
  const actividad = document.getElementById('select-actividad-incidencia').value;
  const horaFinal = document.getElementById('input-hora-final').value;
  const observaciones = document.getElementById('textarea-observaciones').value;

  if (!empleado) { mostrarNotificacion('error', '⚠️ Selecciona un empleado'); return; }
  if (!actividad) { mostrarNotificacion('error', '⚠️ Selecciona una actividad'); return; }

  mostrarNotificacion('loading', '📤 Registrando incidencia...');

  google.script.run
    .withSuccessHandler(function(result) {
      if (!result || result.error === true) {
        mostrarNotificacion('error', '❌ Error: ' + result.message);
      } else {
        mostrarNotificacion('success', '✅ Incidencia registrada: ' + empleado + ' - ' + actividad);
        document.getElementById('select-empleado-incidencia').value = '';
        document.getElementById('select-actividad-incidencia').value = '';
        document.getElementById('input-hora-final').value = '';
        document.getElementById('textarea-observaciones').value = '';
      }
    })
    .withFailureHandler(function(error) { mostrarNotificacion('error', '❌ Error: ' + error.message); })
    .inyectarIncidencia(empleado, actividad, horaFinal, observaciones);
}