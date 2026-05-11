// ============================================================================
// TABLAS EDITABLES DINÁMICAS
// ============================================================================

function inicializarTablaEditable(tableId, countId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const columnas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  columnas.forEach(function(col) {
    const th = document.createElement('th');
    th.textContent = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (let i = 0; i < 5; i++) tbody.appendChild(crearFilaEditable(columnas.length));
  table.appendChild(tbody);

  table.addEventListener('paste', function(e) { manejarPaste(e, tableId, countId); });
  actualizarContador(tableId, countId);
}

function crearFilaEditable(numColumnas) {
  const tr = document.createElement('tr');
  for (let i = 0; i < numColumnas; i++) {
    const td = document.createElement('td');
    td.contentEditable = 'true';
    td.addEventListener('input', function() { verificarYAgregarFilaEventualidad(td, numColumnas); });
    td.addEventListener('keydown', function(e) { manejarNavegacion(e, td); });
    tr.appendChild(td);
  }
  return tr;
}

function verificarYAgregarFilaEventualidad(cell, numColumnas) {
  const table = cell.closest('table');
  const tbody = table.querySelector('tbody');
  const rows = tbody.querySelectorAll('tr');
  const lastRow = rows[rows.length - 1];
  const lastRowHasContent = Array.from(lastRow.querySelectorAll('td')).some(function(td) { return td.textContent.trim() !== ''; });
  if (lastRowHasContent) {
    tbody.appendChild(crearFilaEditable(numColumnas));
    const tableId = table.id;
    const countId = tableId.replace('table-', 'count-');
    actualizarContador(tableId, countId);
  }
}

function verificarYAgregarFila(cell) {
  const table = cell.closest('table');
  const tbody = table.querySelector('tbody');
  const rows = tbody.querySelectorAll('tr');
  const lastRow = rows[rows.length - 1];
  const lastRowHasContent = Array.from(lastRow.querySelectorAll('td')).some(function(td) { return td.textContent.trim() !== ''; });
  if (lastRowHasContent) {
    tbody.appendChild(crearFilaEditable(10));
    actualizarContador(table.id, table.id.replace('table-', 'count-'));
  }
}

function manejarNavegacion(e, cell) {
  const row = cell.parentElement;
  const cellIndex = Array.from(row.children).indexOf(cell);

  if (e.key === 'Tab') {
    e.preventDefault();
    const nextCell = e.shiftKey ? cell.previousElementSibling : cell.nextElementSibling;
    if (nextCell) { nextCell.focus(); } else if (!e.shiftKey) { const nextRow = row.nextElementSibling; if (nextRow) nextRow.children[0].focus(); }
  }
  if (e.key === 'Enter') { e.preventDefault(); const nextRow = row.nextElementSibling; if (nextRow) nextRow.children[cellIndex].focus(); }
  if (e.key === 'ArrowRight' && cell.nextElementSibling) { e.preventDefault(); cell.nextElementSibling.focus(); }
  if (e.key === 'ArrowLeft' && cell.previousElementSibling) { e.preventDefault(); cell.previousElementSibling.focus(); }
  if (e.key === 'ArrowDown') { e.preventDefault(); const nextRow = row.nextElementSibling; if (nextRow) nextRow.children[cellIndex].focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); const prevRow = row.previousElementSibling; if (prevRow) prevRow.children[cellIndex].focus(); }
}

function manejarPaste(e, tableId, countId) {
  e.preventDefault();
  const clipboardData = e.clipboardData.getData('text');
  const lines = clipboardData.split('\n').filter(function(line) { return line.trim() !== ''; });
  if (lines.length === 0) return;

  const table = document.getElementById(tableId);
  const tbody = table.querySelector('tbody');
  const primeraFila = tbody.querySelector('tr');
  const numColumnas = primeraFila ? primeraFila.querySelectorAll('td').length : 6;

  const filasExistentes = Array.from(tbody.querySelectorAll('tr'));
  let primeraFilaVacia = filasExistentes.findIndex(function(row) {
    return Array.from(row.querySelectorAll('td')).every(function(td) { return !td.textContent.trim(); });
  });
  if (primeraFilaVacia === -1) primeraFilaVacia = filasExistentes.length;

  lines.forEach(function(line, idx) {
    const cells = line.split('\t');
    const filaDestino = filasExistentes[primeraFilaVacia + idx];
    if (filaDestino) {
      cells.forEach(function(value, colIdx) {
        if (colIdx < numColumnas && filaDestino.children[colIdx]) filaDestino.children[colIdx].textContent = value.trim();
      });
    } else {
      const row = crearFilaEditable(numColumnas);
      cells.forEach(function(value, colIdx) { if (colIdx < numColumnas) row.children[colIdx].textContent = value.trim(); });
      tbody.appendChild(row);
    }
  });

  const totalFilas = tbody.querySelectorAll('tr').length;
  const filasConDatos = Array.from(tbody.querySelectorAll('tr')).filter(function(row) {
    return Array.from(row.querySelectorAll('td')).some(function(td) { return td.textContent.trim(); });
  }).length;
  const filasVacias = totalFilas - filasConDatos;
  if (filasVacias < 3) {
    for (let i = 0; i < (3 - filasVacias); i++) tbody.appendChild(crearFilaEditable(numColumnas));
  }

  actualizarContador(tableId, countId);
  mostrarNotificacion('success', '✅ ' + lines.length + ' filas agregadas');
}

function manejarPasteEventualidad(e, tableId, countId, numColumnas) {
  e.preventDefault();
  const clipboardData = e.clipboardData.getData('text');
  const lines = clipboardData.split('\n').filter(function(line) { return line.trim() !== ''; });
  if (lines.length === 0) return;

  const table = document.getElementById(tableId);
  const tbody = table.querySelector('tbody');

  if (tableId === 'table-enfermedades') {
    lines.forEach(function(line) {
      const cells = line.split('\t');
      const fila = crearFilaEnfermedad();
      const select = fila.querySelector('.select-empleado');
      if (select && cells[0]) {
        setTimeout(function() {
          const options = Array.from(select.options);
          const match = options.find(function(opt) { return opt.value.toLowerCase().includes(cells[0].trim().toLowerCase()); });
          if (match) select.value = match.value;
        }, 100);
      }
      const inputFecha = fila.querySelector('input[type="date"]');
      if (inputFecha && cells[1]) inputFecha.value = cells[1].trim();
      if (cells[4]) fila.children[4].textContent = cells[4].trim();
      tbody.appendChild(fila);
    });
    cargarNombresEmpleados();
  } else if (tableId === 'table-festivos') {
    lines.forEach(function(line) {
      const cells = line.split('\t');
      const fila = crearFilaFestivo();
      const inputFecha = fila.querySelector('.input-fecha-festivo');
      if (inputFecha && cells[0]) inputFecha.value = cells[0].trim();
      const tdDescripcion = fila.children[1];
      if (tdDescripcion && cells[1]) tdDescripcion.textContent = cells[1].trim();
      tbody.appendChild(fila);
    });
  } else {
    lines.forEach(function(line) {
      const cells = line.split('\t');
      const row = crearFilaEditable(numColumnas);
      cells.forEach(function(value, idx) { if (idx < numColumnas) row.children[idx].textContent = value.trim(); });
      tbody.appendChild(row);
    });
  }

  actualizarContador(tableId, countId);
  mostrarNotificacion('success', '✅ ' + lines.length + ' filas agregadas');
}

function limpiarTabla(tableId) {
  const table = document.getElementById(tableId);
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  for (let i = 0; i < 5; i++) tbody.appendChild(crearFilaEditable(10));
  const countId = tableId.replace('table-', 'count-');
  actualizarContador(tableId, countId);
  mostrarNotificacion('success', '🗑️ Tabla limpiada');
}

function actualizarContador(tableId, countId) {
  const table = document.getElementById(tableId);
  const rows = table.querySelectorAll('tbody tr');
  let filasConDatos = 0;
  rows.forEach(function(row) {
    if (Array.from(row.querySelectorAll('td')).some(function(td) { return td.textContent.trim() !== ''; })) filasConDatos++;
  });
  const countElement = document.getElementById(countId);
  if (countElement) countElement.textContent = filasConDatos + ' fila' + (filasConDatos !== 1 ? 's' : '') + ' con datos';
}

function inyectarDatosDesdeTabla(sheetName, tableId) {
  const table = document.getElementById(tableId);
  const rows = table.querySelectorAll('tbody tr');
  const data = [];

  rows.forEach(function(row, rowIndex) {
    if (rowIndex === 0) return;
    const cells = row.querySelectorAll('td');
    const cellsArray = Array.from(cells).map(function(cell) { return cell.textContent.trim(); });
    const rowData = [
      cellsArray[0] || '', '',
      cellsArray[2] || '', '',
      cellsArray[4] || '', cellsArray[5] || '',
      cellsArray[6] || '', cellsArray[7] || '',
      cellsArray[8] || '', cellsArray[9] || ''
    ];
    if (rowData.some(function(value, idx) { return idx !== 1 && idx !== 3 && value !== ''; })) data.push(rowData);
  });

  if (data.length === 0) { mostrarResultado('error', '⚠️ No hay datos para inyectar'); return; }

  const btnId = sheetName === 'RAW' ? 'btn-inyectar-valle' : 'btn-inyectar-adolfo';
  const btn = document.getElementById(btnId);
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Inyectando...';
  mostrarResultado('loading', '📤 Inyectando ' + data.length + ' filas en ' + sheetName + '...');

  google.script.run
    .withSuccessHandler(function(result) {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
      if (result.error) { mostrarResultado('error', '❌ Error: ' + result.message); }
      else { mostrarResultado('success', '✅ ¡Inyección completada! ' + result.rowsWritten + ' filas escritas en ' + sheetName); }
    })
    .withFailureHandler(function(error) {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
      mostrarResultado('error', '❌ Error: ' + error.message);
    })
    .inyectarDatosChecadores(sheetName, data);
}

function mostrarNotificacion(tipo, mensaje) {
  const notif = document.createElement('div');
  let bg = 'rgba(16,185,129,0.95)';
  if (tipo === 'error') bg = 'rgba(239,68,68,0.95)';
  else if (tipo === 'loading') bg = 'rgba(59,130,246,0.95)';
  notif.style.cssText = 'position:fixed;top:80px;right:20px;padding:16px 24px;background:' + bg + ';color:white;border-radius:8px;font-weight:600;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,0.3);animation:slideInRight 0.3s ease;';
  notif.textContent = mensaje;
  document.body.appendChild(notif);
  setTimeout(function() {
    notif.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(function() { notif.remove(); }, 300);
  }, 2000);
}

function mostrarResultado(tipo, mensaje) {
  const resultado = document.getElementById('resultado-inyeccion');
  if (!resultado) return;
  resultado.style.display = 'block';

  let bgColor = 'rgba(59,130,246,0.1)';
  let borderColor = '#3B82F6';
  let icon = 'spinner fa-spin';

  if (tipo === 'success') { bgColor = 'rgba(16,185,129,0.1)'; borderColor = '#10B981'; icon = 'check-circle'; }
  else if (tipo === 'error') { bgColor = 'rgba(239,68,68,0.1)'; borderColor = '#EF4444'; icon = 'exclamation-circle'; }

  resultado.innerHTML =
    '<div style="background:' + bgColor + ';border:2px solid ' + borderColor + ';border-radius:12px;padding:20px;text-align:center;">' +
      '<i class="fas fa-' + icon + '" style="font-size:48px;color:' + borderColor + ';margin-bottom:12px;"></i>' +
      '<div style="font-size:18px;font-weight:700;color:#F1F5F9;">' + mensaje + '</div>' +
    '</div>';
}