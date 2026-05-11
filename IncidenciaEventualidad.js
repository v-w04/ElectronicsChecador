// IncidenciaEventualidad.html
// Las funciones de incidencias y eventualidades están distribuidas en:
// - RenderModule.html: renderIncidencias, renderAlertas, inicializarTablaEventualidad,
//   crearFilaEnfermedad, crearFilaFestivo, verificarYAgregarFilaEnfermedad,
//   verificarYAgregarFilaFestivo, cargarNombresEmpleados, reinicializarTablaEventualidad,
//   inyectarEventualidad, limpiarTablaEventualidad
// - Inyectar.html: renderInyectarEventualidades, renderInyectarIncidencias,
//   cargarEmpleadosParaIncidencia, cargarActividadesIncidencias, registrarIncidencia
// Este archivo se mantiene vacío intencionalmente para compatibilidad con include()

function mostrarPantallaPIN() {
  const overlay = document.createElement('div');
  overlay.id = 'pin-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,#0F172A 0%,#1E293B 100%);z-index:99999;display:flex;align-items:center;justify-content:center;';

  const btnStyle = 'padding:18px;font-size:20px;font-weight:700;background:rgba(51,65,85,0.6);border:1px solid rgba(71,85,105,0.5);border-radius:12px;color:#F1F5F9;cursor:pointer;transition:all 0.15s;';
  const btnHover = 'onmouseover="this.style.background=\'rgba(59,130,246,0.2)\';this.style.borderColor=\'#3B82F6\';" onmouseout="this.style.background=\'rgba(51,65,85,0.6)\';this.style.borderColor=\'rgba(71,85,105,0.5)\';"';

  let botonesHTML = '';
  ['1','2','3','4','5','6','7','8','9'].forEach(function(n) {
    botonesHTML += '<button onclick="pinPresionar(\'' + n + '\')" style="' + btnStyle + '" ' + btnHover + '>' + n + '</button>';
  });

  overlay.innerHTML =
    '<div style="background:rgba(30,41,59,0.95);border:2px solid rgba(59,130,246,0.4);border-radius:20px;padding:48px 40px;width:340px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.6);">' +
      '<div style="font-size:56px;margin-bottom:16px;">🔐</div>' +
      '<h2 style="color:#F1F5F9;font-size:22px;font-weight:700;margin-bottom:6px;">Electronics México</h2>' +
      '<p style="color:#64748B;font-size:13px;margin-bottom:32px;">Ingresa tu PIN de acceso</p>' +
      '<div id="pin-dots" style="display:flex;justify-content:center;gap:14px;margin-bottom:32px;">' +
        '<div class="pin-dot" style="width:16px;height:16px;border-radius:50%;border:2px solid #334155;background:transparent;transition:all 0.2s;"></div>' +
        '<div class="pin-dot" style="width:16px;height:16px;border-radius:50%;border:2px solid #334155;background:transparent;transition:all 0.2s;"></div>' +
        '<div class="pin-dot" style="width:16px;height:16px;border-radius:50%;border:2px solid #334155;background:transparent;transition:all 0.2s;"></div>' +
        '<div class="pin-dot" style="width:16px;height:16px;border-radius:50%;border:2px solid #334155;background:transparent;transition:all 0.2s;"></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px;">' +
        botonesHTML +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">' +
        '<button onclick="pinBorrar()" style="padding:18px;font-size:16px;font-weight:700;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:12px;color:#EF4444;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.background=\'rgba(239,68,68,0.3)\';" onmouseout="this.style.background=\'rgba(239,68,68,0.15)\';">⌫</button>' +
        '<button onclick="pinPresionar(\'0\')" style="' + btnStyle + '" ' + btnHover + '>0</button>' +
        '<button onclick="pinConfirmar()" style="padding:18px;font-size:16px;font-weight:700;background:linear-gradient(135deg,#3B82F6,#06B6D4);border:none;border-radius:12px;color:white;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.opacity=\'0.85\';" onmouseout="this.style.opacity=\'1\';">✓</button>' +
      '</div>' +
      '<div id="pin-error" style="margin-top:20px;color:#EF4444;font-size:13px;font-weight:600;min-height:20px;opacity:0;transition:opacity 0.3s;">PIN incorrecto</div>' +
    '</div>';

  document.body.appendChild(overlay);
  window._pinActual = '';
  overlay.setAttribute('tabindex', '0');
  overlay.focus();

  document.addEventListener('keydown', function _pinKeyHandler(e) {
    if (!document.getElementById('pin-overlay')) { document.removeEventListener('keydown', _pinKeyHandler); return; }
    if (e.key >= '0' && e.key <= '9') pinPresionar(e.key);
    else if (e.key === 'Backspace') pinBorrar();
    else if (e.key === 'Enter') pinConfirmar();
  });
}

function pinPresionar(digito) {
  if (window._pinActual.length >= 4) return;
  window._pinActual += digito;
  actualizarDotsPIN();
  if (window._pinActual.length === 4) setTimeout(pinConfirmar, 200);
}

function pinBorrar() {
  window._pinActual = window._pinActual.slice(0, -1);
  actualizarDotsPIN();
}

function actualizarDotsPIN() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach(function(dot, i) {
    if (i < window._pinActual.length) {
      dot.style.background = '#3B82F6';
      dot.style.borderColor = '#3B82F6';
      dot.style.boxShadow = '0 0 8px rgba(59,130,246,0.6)';
    } else {
      dot.style.background = 'transparent';
      dot.style.borderColor = '#334155';
      dot.style.boxShadow = 'none';
    }
  });
}

function pinConfirmar() {
  if (window._pinActual.length < 4) return;
  const pin = window._pinActual;
  window._pinActual = '';
  actualizarDotsPIN();

  google.script.run
    .withSuccessHandler(function(result) {
      if (!result.ok) {
        const errEl = document.getElementById('pin-error');
        if (errEl) {
          errEl.textContent = result.message || 'PIN incorrecto';
          errEl.style.opacity = '1';
          setTimeout(function() { errEl.style.opacity = '0'; }, 2500);
        }
        const box = document.querySelector('#pin-overlay > div');
        if (box) {
          box.style.animation = 'pinShake 0.4s ease';
          setTimeout(function() { box.style.animation = ''; }, 400);
        }
        return;
      }
      if (result.tipo === 'ADMIN') {
        document.getElementById('pin-overlay').remove();
      } else if (result.tipo === 'CHOFER') {
        document.getElementById('pin-overlay').remove();
        abrirChecadorChoferDirecto(result.nombre, result.idUsuario);
      }
    })
    .withFailureHandler(function(err) {
      const errEl = document.getElementById('pin-error');
      if (errEl) {
        errEl.textContent = 'Error de conexión';
        errEl.style.opacity = '1';
        setTimeout(function() { errEl.style.opacity = '0'; }, 2500);
      }
    })
    .validarPin(pin);
}

function abrirChecadorChoferDirecto(nombre, idUsuario) {
  document.querySelector('.app-container').style.display = 'none';
  document.getElementById('particles').style.display = 'none';

  const wrapper = document.createElement('div');
  wrapper.id = 'chofer-wrapper';
  wrapper.style.cssText = 'min-height:100vh;background:linear-gradient(135deg,#0F172A 0%,#1E293B 100%);display:flex;flex-direction:column;align-items:center;padding:24px 16px;';
  wrapper.innerHTML =
    '<div style="width:100%;max-width:520px;">' +
      '<div style="text-align:center;margin-bottom:24px;">' +
        '<div style="font-size:40px;margin-bottom:8px;">🚛</div>' +
        '<h2 style="color:#F1F5F9;font-size:20px;font-weight:700;">Checador Choferes</h2>' +
        '<p style="color:#3B82F6;font-size:14px;font-weight:600;">👤 ' + nombre + '</p>' +
      '</div>' +
      '<div id="chofer-directo-container"></div>' +
    '</div>';
  document.body.appendChild(wrapper);

  google.script.run
    .withSuccessHandler(function(resZonas) {
      _zonasValidas = resZonas.zonas || [];
      _fotoBase64 = null; _fotoMimeType = null; _gpsData = null;
      renderPanelChoferFijo(nombre, idUsuario, document.getElementById('chofer-directo-container'));
    })
    .withFailureHandler(function() {
      _zonasValidas = [];
      renderPanelChoferFijo(nombre, idUsuario, document.getElementById('chofer-directo-container'));
    })
    .getZonasValidas();
}

function renderPanelChoferFijo(nombre, idUsuario, container) {
  container.innerHTML =
    '<div style="display:flex;flex-direction:column;gap:20px;">' +
      '<div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:12px;padding:16px;font-size:13px;color:#94A3B8;line-height:1.8;">1. Toma una foto (obligatorio)<br>2. Obtén tu ubicación GPS (obligatorio)<br>3. Presiona <strong style="color:#F1F5F9;">Registrar Checada</strong></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:rgba(30,41,59,0.6);border-radius:10px;padding:16px;border:1px solid rgba(51,65,85,0.5);">' +
        '<div style="text-align:center;"><div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Fecha</div><div id="chofer-fecha" style="font-size:18px;font-weight:700;color:#F1F5F9;">--/--/----</div></div>' +
        '<div style="text-align:center;"><div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Hora</div><div id="chofer-hora" style="font-size:18px;font-weight:700;color:#3B82F6;">--:--:--</div></div>' +
      '</div>' +
      '<div>' +
        '<label style="display:block;color:#F1F5F9;font-weight:600;margin-bottom:8px;font-size:14px;"><i class="fas fa-camera"></i> Foto (obligatorio)</label>' +
        '<input type="file" id="chofer-foto-input" accept="image/*" capture="environment" style="display:none;" onchange="procesarFotoChofer(this)">' +
        '<div style="display:flex;gap:10px;align-items:flex-start;">' +
          '<button onclick="document.getElementById(\'chofer-foto-input\').click()" style="flex:1;padding:14px;background:rgba(16,185,129,0.15);border:2px solid #10B981;border-radius:10px;color:#10B981;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;"><i class="fas fa-camera" style="font-size:18px;"></i> Tomar / Subir Foto</button>' +
          '<div id="chofer-foto-preview" style="width:80px;height:80px;border-radius:10px;background:rgba(30,41,59,0.8);border:2px dashed rgba(51,65,85,0.6);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;"><i class="fas fa-image" style="color:#475569;font-size:24px;"></i></div>' +
        '</div>' +
        '<div id="chofer-foto-status" style="margin-top:8px;font-size:12px;color:#64748B;">Sin foto</div>' +
      '</div>' +
      '<div>' +
        '<label style="display:block;color:#F1F5F9;font-weight:600;margin-bottom:8px;font-size:14px;"><i class="fas fa-map-marker-alt"></i> Ubicación GPS (obligatorio)</label>' +
        '<button id="btn-gps-chofer" onclick="obtenerGPSChofer()" style="width:100%;padding:14px;background:rgba(245,158,11,0.15);border:2px solid #F59E0B;border-radius:10px;color:#F59E0B;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;"><i class="fas fa-location-arrow" style="font-size:18px;"></i> Obtener Ubicación</button>' +
        '<div id="chofer-gps-resultado" style="margin-top:12px;display:none;"></div>' +
      '</div>' +
      '<button id="btn-registrar-chofer" disabled onclick="registrarChecadaChoferFijo(\'' + nombre + '\',\'' + idUsuario + '\')" style="width:100%;padding:18px;background:linear-gradient(135deg,#3B82F6,#06B6D4);border:none;border-radius:12px;color:white;font-weight:800;font-size:17px;cursor:not-allowed;opacity:0.4;display:flex;align-items:center;justify-content:center;gap:10px;transition:all 0.3s;"><i class="fas fa-check-circle" style="font-size:22px;"></i> Registrar Checada</button>' +
      '<div id="chofer-resultado" style="display:none;"></div>' +
    '</div>';

  actualizarRelojChofer();
  window._relojChoferInterval = setInterval(actualizarRelojChofer, 1000);
}

function registrarChecadaChoferFijo(nombre, idUsuario) {
  if (!_fotoBase64) { mostrarNotificacion('error', '⚠️ Falta la foto'); return; }
  if (!_gpsData) { mostrarNotificacion('error', '⚠️ Falta la ubicación GPS'); return; }

  const ahora = new Date();
  const fecha = ahora.toISOString().substring(0, 10);
  const hora = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const timestamp = ahora.toLocaleString('es-MX');

  const btn = document.getElementById('btn-registrar-chofer');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';

  const datos = {
    idUsuario, nombre, fecha, hora,
    timestampCompleto: timestamp,
    fotoBase64: _fotoBase64,
    fotoMimeType: _fotoMimeType,
    lat: _gpsData.lat,
    lng: _gpsData.lng,
    direccion: _gpsData.direccion,
    precision: _gpsData.precision,
    linkMaps: _gpsData.linkMaps,
    estadoZona: _gpsData.estadoZona,
    zonaCercana: _gpsData.zonaCercana
  };

  google.script.run
    .withSuccessHandler(function(result) {
      const resDiv = document.getElementById('chofer-resultado');
      resDiv.style.display = 'block';
      if (result.ok) {
        const zonaValida = _gpsData && _gpsData.estadoZona === 'VÁLIDA';
        const colorZona = zonaValida ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)';
        const borderZona = zonaValida ? '#10B981' : '#F59E0B';
        const colorTexto = zonaValida ? '#10B981' : '#F59E0B';
        const textoZona = zonaValida ? '📍 ✅ Zona válida: ' + _gpsData.zonaCercana : '📍 ⚠️ Fuera de zona — no se contabilizará';

        resDiv.innerHTML =
          '<div style="background:rgba(16,185,129,0.1);border:2px solid #10B981;border-radius:12px;padding:20px;text-align:center;">' +
            '<div style="font-size:48px;margin-bottom:10px;">✅</div>' +
            '<div style="font-size:18px;font-weight:800;color:#10B981;margin-bottom:6px;">¡Checada Registrada!</div>' +
            '<div style="font-size:13px;color:#94A3B8;margin-bottom:12px;">' + nombre + ' · ' + hora + '</div>' +
            '<div style="padding:10px 16px;border-radius:8px;font-size:13px;font-weight:700;background:' + colorZona + ';border:1px solid ' + borderZona + ';color:' + colorTexto + ';">' + textoZona + '</div>' +
          '</div>';

        _fotoBase64 = null; _fotoMimeType = null; _gpsData = null;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Registrar Otra Checada';
        btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
        btn.onclick = function() {
          resDiv.style.display = 'none'; resDiv.innerHTML = '';
          _fotoBase64 = null; _fotoMimeType = null; _gpsData = null;
          document.getElementById('chofer-foto-preview').innerHTML = '<i class="fas fa-image" style="color:#475569;font-size:24px;"></i>';
          document.getElementById('chofer-foto-status').textContent = 'Sin foto';
          document.getElementById('chofer-gps-resultado').style.display = 'none';
          const btnGps = document.getElementById('btn-gps-chofer');
          btnGps.innerHTML = '<i class="fas fa-location-arrow" style="font-size:18px;"></i> Obtener Ubicación';
          btnGps.style.borderColor = '#F59E0B'; btnGps.style.color = '#F59E0B'; btnGps.disabled = false;
          verificarBtnRegistrar();
        };
      } else {
        resDiv.innerHTML = '<div style="background:rgba(239,68,68,0.1);border:1px solid #EF4444;border-radius:12px;padding:16px;color:#EF4444;">❌ Error: ' + result.message + '</div>';
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Reintentar';
        verificarBtnRegistrar();
      }
    })
    .withFailureHandler(function(err) {
      mostrarNotificacion('error', '❌ Error: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Registrar Checada';
      verificarBtnRegistrar();
    })
    .guardarChecadaChofer(datos);
}

// ============================================================================
// PARTÍCULAS DE FONDO
// ============================================================================
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  container.innerHTML = '';
  const isMobile = window.innerWidth <= 768;
  const particleCount = isMobile ? 25 : 50;
  const animations = ['floatOrganic1', 'floatOrganic2', 'floatOrganic3'];
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    const size = 2 + Math.random() * 2;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    const animationType = animations[Math.floor(Math.random() * animations.length)];
    particle.style.animation = animationType + ' ' + (15 + Math.random() * 15) + 's infinite';
    particle.style.animationDelay = Math.random() * 20 + 's';
    particle.style.opacity = 0.6 + Math.random() * 0.4;
    container.appendChild(particle);
  }
}

// ============================================================================
// EJECUTAR CONTROL DE ASISTENCIA
// ============================================================================
function ejecutarControlAsistencia() {
  const mensajesProgreso = [
    { tiempo: 0,  texto: '🚀 Iniciando Control de Asistencia...' },
    { tiempo: 2,  texto: '📋 Limpiando logs anteriores...' },
    { tiempo: 4,  texto: '🔍 Leyendo configuración de turnos...' },
    { tiempo: 8,  texto: '📊 Procesando RAW (Sheet 1/2)...' },
    { tiempo: 15, texto: '📊 Procesando RAW_ADOLFO (Sheet 2/2)...' },
    { tiempo: 22, texto: '⏰ Calculando métricas por empleado...' },
    { tiempo: 30, texto: '📈 Generando métricas diarias...' },
    { tiempo: 38, texto: '📅 Calculando resumen mensual...' },
    { tiempo: 45, texto: '⚠️ Detectando alertas y excepciones...' },
    { tiempo: 52, texto: '💾 Guardando resultados...' },
    { tiempo: 56, texto: '✅ Finalizando proceso...' },
    { tiempo: 60, texto: '✅ Proceso completado exitosamente' }
  ];

  const overlay = document.createElement('div');
  overlay.id = 'progress-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);z-index:9999;display:flex;align-items:center;justify-content:center;';

  const modalHTML = document.createElement('div');
  modalHTML.style.cssText = 'background:rgba(30,41,59,0.95);border:2px solid var(--primary);border-radius:16px;padding:48px;max-width:500px;width:90%;text-align:center;';
  modalHTML.innerHTML =
    '<div style="font-size:64px;margin-bottom:24px;"><i class="fas fa-cog fa-spin" style="color:var(--primary);"></i></div>' +
    '<h2 style="color:var(--text-primary);margin-bottom:12px;font-size:26px;font-weight:700;">Ejecutando Control de Asistencia</h2>' +
    '<div style="background:rgba(51,65,85,0.6);border-radius:12px;height:12px;overflow:hidden;margin:24px 0;">' +
      '<div id="progress-bar" style="background:linear-gradient(90deg,#3B82F6,#06B6D4,#10B981);height:100%;width:0%;transition:width 0.5s ease;"></div>' +
    '</div>' +
    '<div id="progress-text" style="color:var(--primary);font-size:18px;font-weight:600;margin-bottom:16px;">0%</div>' +
    '<div id="status-text" style="color:var(--text-secondary);font-size:14px;min-height:24px;font-family:Courier New,monospace;">Iniciando...</div>';

  overlay.appendChild(modalHTML);
  document.body.appendChild(overlay);

  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const statusText = document.getElementById('status-text');

  let tiempoTranscurrido = 0;
  let indiceMensaje = 0;
  let procesoTerminado = false;

  google.script.run
    .withSuccessHandler(function(raw) {
      const result = safeResult(raw);
      if (result.error === true) { console.error(result.message); return; }
      procesoTerminado = true;
      if (result && result.registros === 0) {
        clearInterval(progressInterval);
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        modalHTML.innerHTML =
          '<div style="font-size:72px;margin-bottom:24px;"><i class="fas fa-info-circle" style="color:#F59E0B;"></i></div>' +
          '<h2 style="color:#F59E0B;margin-bottom:12px;font-size:28px;font-weight:700;">Sin Datos para Procesar</h2>' +
          '<p style="color:var(--text-secondary);margin-bottom:28px;font-size:15px;">No se encontraron registros en RAW.</p>' +
          '<button id="btn-cerrar-info" style="padding:14px 32px;background:#F59E0B;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Cerrar y Refrescar</button>';
        document.getElementById('btn-cerrar-info').onclick = function() { overlay.remove(); loadDashboard(); };
      }
    })
    .withFailureHandler(function(error) {
      procesoTerminado = true;
      modalHTML.innerHTML =
        '<div style="font-size:72px;margin-bottom:24px;"><i class="fas fa-exclamation-circle" style="color:var(--danger);"></i></div>' +
        '<h2 style="color:var(--danger);margin-bottom:12px;font-size:28px;font-weight:700;">Error en el Proceso</h2>' +
        '<p style="color:var(--text-secondary);margin-bottom:12px;font-size:15px;">' + error.message + '</p>' +
        '<button id="btn-cerrar-error" style="padding:14px 32px;background:var(--danger);color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Cerrar</button>';
      document.getElementById('btn-cerrar-error').onclick = function() { overlay.remove(); };
    })
    .procesarAsistenciasCompleto();

  const progressInterval = setInterval(function() {
    tiempoTranscurrido++;
    const porcentaje = Math.min(95, (tiempoTranscurrido / 60) * 100);
    progressBar.style.width = porcentaje + '%';
    progressText.textContent = Math.round(porcentaje) + '%';
    if (indiceMensaje < mensajesProgreso.length) {
      if (tiempoTranscurrido >= mensajesProgreso[indiceMensaje].tiempo) {
        statusText.textContent = mensajesProgreso[indiceMensaje].texto;
        indiceMensaje++;
      }
    }
    if (tiempoTranscurrido >= 60 && procesoTerminado) {
      clearInterval(progressInterval);
      progressBar.style.width = '100%';
      progressText.textContent = '100%';
      modalHTML.innerHTML =
        '<div style="font-size:72px;margin-bottom:24px;"><i class="fas fa-check-circle" style="color:var(--success);"></i></div>' +
        '<h2 style="color:var(--success);margin-bottom:12px;font-size:28px;font-weight:700;">¡Proceso Completado!</h2>' +
        '<p style="color:var(--text-secondary);margin-bottom:28px;font-size:15px;">El control de asistencia se ejecutó correctamente</p>' +
        '<button id="btn-cerrar-exito" style="padding:14px 32px;background:var(--success);color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Cerrar y Refrescar</button>';
      document.getElementById('btn-cerrar-exito').onclick = function() { overlay.remove(); if (!currentModule) loadDashboard(); };
    }
  }, 1000);
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
  if (localStorage.getItem('theme') === 'girly') {
    document.body.classList.add('girly-mode');
  }
  mostrarPantallaPIN();
});

// ============================================================================
// EXPORTAR PDF
// ============================================================================
function exportarResumenAPDF() {
  const elemento = document.getElementById('resumen-mensual-contenido');
  if (!elemento) { alert('❌ No se encontró el contenido para exportar'); return; }
  const btnExportar = event.target.closest('button');
  const textoOriginal = btnExportar.innerHTML;
  btnExportar.disabled = true;
  btnExportar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando PDF...';
  const opt = {
    margin: [10, 10, 10, 10],
    filename: 'Resumen_Mensual_' + new Date().toISOString().split('T')[0] + '.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2.1, useCORS: true, logging: false, backgroundColor: '#0F172A' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };
  html2pdf().set(opt).from(elemento).save()
    .then(function() { btnExportar.disabled = false; btnExportar.innerHTML = textoOriginal; })
    .catch(function(err) { alert('Error al generar PDF'); btnExportar.disabled = false; btnExportar.innerHTML = textoOriginal; });
}

// ============================================================================
// MÓVIL
// ============================================================================
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const btn = document.getElementById('mobile-menu-btn');
  if (!sidebar) return;
  const isOpen = sidebar.classList.contains('active');
  sidebar.classList.toggle('active');
  if (btn) btn.innerHTML = isOpen ? '<i class="fas fa-bars"></i>' : '<i class="fas fa-times"></i>';
}

function ajustarGaugesMobile() {
  if (window.innerWidth > 768) return;
  document.querySelectorAll('#kpi-hoy-display,#kpi-faltas-display,#kpi-vacaciones-display,#kpi-retardos-display,#kpi-incidencias-display').forEach(function(el) {
    el.style.fontSize = '22px'; el.style.margin = '2px 0';
  });
  document.querySelectorAll('#percentage-hoy,#percentage-faltas,#percentage-vacaciones,#percentage-retardos,#percentage-incidencias').forEach(function(el) {
    el.style.fontSize = '11px'; el.style.bottom = '-14px';
  });
  document.querySelectorAll('#needle-hoy,#needle-faltas,#needle-vacaciones,#needle-retardos,#needle-incidencias').forEach(function(el) {
    el.style.height = '13px'; el.style.width = '2px'; el.style.bottom = '3px';
  });
  ['hoy','faltas','vacaciones','retardos','incidencias'].forEach(function(id) {
    const needle = document.getElementById('needle-' + id);
    if (needle && needle.parentElement) {
      needle.parentElement.style.width = '80px';
      needle.parentElement.style.height = '46px';
    }
  });
}

function forzarDosColumnasMovil() {
  const grid = document.querySelector('.gauges-grid');
  if (!grid) return;
  if (window.innerWidth <= 768) {
    grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    grid.style.gap = '6px';
    grid.querySelectorAll('.kpi-card').forEach(function(card) {
      card.style.padding = '8px 4px';
      card.style.minHeight = 'unset';
      card.style.overflow = 'hidden';
    });
  }
}
