// ============================================================================
// SISTEMA DE FILTROS Y BÚSQUEDA
// ============================================================================

function agregarControlesFiltros() {
  const header = document.querySelector('.module-header');
  if (!header) return;

  const existentes = document.querySelectorAll('.filter-controls');
  existentes.forEach(el => el.remove());

  const controls = document.createElement('div');
  controls.className = 'filter-controls';
  controls.style.cssText = `
    margin-top: 20px;
    padding-top: 20px;
    border-top: 2px solid rgba(59, 130, 246, 0.2);
  `;

  controls.innerHTML = `
    <div style="position: relative; max-width: 600px;">
      <input
        type="text"
        id="filter-search"
        placeholder="🔍 Buscar..."
        style="
          width: 100%;
          padding: 14px 20px 14px 50px;
          background: rgba(30, 41, 59, 0.8);
          border: 2px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          color: #F1F5F9;
          font-size: 15px;
          font-weight: 500;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
        "
        oninput="aplicarFiltros()"
        onfocus="this.style.borderColor='var(--primary)'; this.style.background='rgba(30, 41, 59, 0.95)'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';"
        onblur="this.style.borderColor='rgba(59, 130, 246, 0.3)'; this.style.background='rgba(30, 41, 59, 0.8)'; this.style.boxShadow='none';"
      >
      <i class="fas fa-search" style="
        position: absolute;
        left: 18px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--primary);
        font-size: 16px;
        pointer-events: none;
      "></i>

      <button
        id="clear-search"
        onclick="document.getElementById('filter-search').value=''; aplicarFiltros(); this.style.display='none';"
        style="
          display: none;
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(59, 130, 246, 0.2);
          border: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          color: var(--primary);
          cursor: pointer;
          transition: all 0.2s;
        "
        onmouseover="this.style.background='var(--primary)'; this.style.color='white';"
        onmouseout="this.style.background='rgba(59, 130, 246, 0.2)'; this.style.color='var(--primary)';"
      >
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div id="filter-results" style="
      margin-top: 12px;
      font-size: 13px;
      color: var(--text-secondary);
      display: none;
    "></div>
  `;

  header.parentElement.insertBefore(controls, header.nextSibling);

  const input   = document.getElementById('filter-search');
  const clearBtn = document.getElementById('clear-search');

  if (input && clearBtn) {
    input.addEventListener('input', function() {
      clearBtn.style.display = this.value ? 'block' : 'none';
    });
  }
}

let filtroTimeout;
function aplicarFiltrosDebounced() {
  clearTimeout(filtroTimeout);
  filtroTimeout = setTimeout(aplicarFiltros, 300);
}

function aplicarFiltros() {
  const searchInput = document.getElementById('filter-search');
  if (!searchInput) return;

  const searchTerm = searchInput.value.toLowerCase().trim();

  // ── Employee cards ──
  const employeeCards = document.querySelectorAll('.employee-card');
  let visiblesEmployee = 0;

  employeeCards.forEach(card => {
    const nombre = card.querySelector('.employee-name')?.textContent.toLowerCase() || '';
    const stats   = Array.from(card.querySelectorAll('.stat-row'))
                        .map(row => row.textContent.toLowerCase()).join(' ');
    const texto   = nombre + ' ' + stats;

    if (searchTerm === '' || texto.includes(searchTerm)) {
      card.style.display = '';
      visiblesEmployee++;
    } else {
      card.style.display = 'none';
    }
  });

  // ── Ranking items ──
  const rankingItems = document.querySelectorAll('.ranking-item');
  let visiblesRanking = 0;

  rankingItems.forEach(item => {
    const nombre  = item.querySelector('.ranking-name')?.textContent.toLowerCase()   || '';
    const detalle = item.querySelector('.ranking-detail')?.textContent.toLowerCase() || '';
    const texto   = nombre + ' ' + detalle;

    if (searchTerm === '' || texto.includes(searchTerm)) {
      item.style.display = '';
      visiblesRanking++;
    } else {
      item.style.display = 'none';
    }
  });

  // ── Departamentos ──
  const container = document.getElementById('popup-container');
  if (!container) return;

  const deptoCards   = Array.from(container.querySelectorAll('[style*="border-top: 4px solid"]'));
  let visiblesDepto  = 0;

  deptoCards.forEach(card => {
    const nombreDepto = card.querySelector('[style*="font-size: 16px"][style*="font-weight: 700"]')
                            ?.textContent.toLowerCase() || '';
    const empleados   = Array.from(card.querySelectorAll('[style*="font-size: 13px"][style*="font-weight: 600"]'))
                            .map(el => el.textContent.toLowerCase()).join(' ');
    const texto = nombreDepto + ' ' + empleados;

    if (searchTerm === '' || texto.includes(searchTerm)) {
      card.style.display = '';
      visiblesDepto++;
    } else {
      card.style.display = 'none';
    }
  });

  // ── Mapa cards ──
  const mapaCards    = document.querySelectorAll('.mapa-card');
  let visiblesMapa   = 0;

  mapaCards.forEach(card => {
    const nombre      = card.querySelector('[style*="font-size: 14px"][style*="font-weight: 700"]')
                            ?.textContent.toLowerCase() || '';
    const departamento = card.querySelector('[style*="font-size: 12px"]')
                            ?.textContent.toLowerCase() || '';
    const texto = nombre + ' ' + departamento;

    if (searchTerm === '' || texto.includes(searchTerm)) {
      card.style.display = '';
      visiblesMapa++;
    } else {
      card.style.display = 'none';
    }
  });

  // ── Marcadores plano ──
  const marcadoresPlano  = document.querySelectorAll('.mapa-marker');
  let visiblesMarcadores = 0;

  marcadoresPlano.forEach(marker => {
    const nombre = (marker.dataset.nombre || '').toLowerCase();

    if (searchTerm === '' || nombre.includes(searchTerm)) {
      marker.style.display = '';
      visiblesMarcadores++;
    } else {
      marker.style.display = 'none';
    }
  });

  // ── Contador de resultados ──
  const totalElementos = employeeCards.length + rankingItems.length + deptoCards.length + mapaCards.length;
  const totalVisibles  = visiblesEmployee + visiblesRanking + visiblesDepto + visiblesMapa;

  const resultsCounter = document.getElementById('filter-results');
  if (resultsCounter && totalElementos > 0) {
    if (searchTerm !== '') {
      resultsCounter.textContent = `📊 Mostrando ${totalVisibles} de ${totalElementos} resultados`;
      resultsCounter.style.display = 'block';
    } else {
      resultsCounter.style.display = 'none';
    }
  }

  if (totalElementos > 0 && totalVisibles === 0 && searchTerm !== '') {
    mostrarMensajeSinResultados();
  } else {
    ocultarMensajeSinResultados();
  }
}

function mostrarMensajeSinResultados() {
  let mensaje = document.getElementById('sin-resultados-filtro');

  if (!mensaje) {
    mensaje = document.createElement('div');
    mensaje.id = 'sin-resultados-filtro';
    mensaje.style.cssText = `
      text-align: center;
      padding: 60px 20px;
      color: var(--text-secondary);
      font-size: 16px;
    `;
    mensaje.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
      <div style="font-weight: 600; margin-bottom: 8px;">No se encontraron resultados</div>
      <div style="font-size: 14px;">Intenta con otro término de búsqueda</div>
    `;
    document.getElementById('popup-container').appendChild(mensaje);
  }

  mensaje.style.display = 'block';
}

function ocultarMensajeSinResultados() {
  const mensaje = document.getElementById('sin-resultados-filtro');
  if (mensaje) mensaje.style.display = 'none';
}

function actualizarHTMLFiltrado(datos, headers) {
  const container = document.getElementById('popup-container');
  if (!container) return;

  const idxNombre   = encontrarColumnaDeNombres(headers);
  const searchInput = document.getElementById('filter-search');
  const searchTerm  = searchInput ? searchInput.value.toLowerCase().trim() : '';

  if (container.querySelector('.ranking-card')) return;

  const departamentosCards = Array.from(container.querySelectorAll('[style*="border-top: 4px solid"]'));

  if (departamentosCards.length > 0) {
    departamentosCards.forEach(card => {
      const nombreDepto    = card.querySelector('[style*="font-size: 16px"][style*="font-weight: 700"]')
                                 ?.textContent.toLowerCase() || '';
      const empleadosEnDepto = Array.from(card.querySelectorAll('[style*="font-size: 13px"][style*="font-weight: 600"]'))
                                    .map(el => el.textContent.toLowerCase());
      const coincideDepto    = nombreDepto.includes(searchTerm);
      const coincideEmpleado = empleadosEnDepto.some(emp => emp.includes(searchTerm));

      card.style.display = (searchTerm === '' || coincideDepto || coincideEmpleado) ? '' : 'none';
    });
    return;
  }

  const empleadosMap = {};
  datos.forEach(row => {
    const nombre = row[idxNombre];
    if (!empleadosMap[nombre]) empleadosMap[nombre] = [];
    empleadosMap[nombre].push(row);
  });

  const employeeCards = Array.from(container.querySelectorAll('.employee-card'));
  employeeCards.forEach(card => {
    const nombreCard  = card.querySelector('.employee-name')?.textContent.trim();
    const nombreLimpio = nombreCard?.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, '').trim();
    card.style.display = (empleadosMap[nombreLimpio] || datos.length === currentData.originalData.length) ? '' : 'none';
  });
}