// ============================================================================
// CHECADOR CHOFERES — Panel de checada virtual
// ============================================================================

let _zonasValidas = [];
let _fotoBase64 = null;
let _fotoMimeType = null;
let _gpsData = null;

function abrirChecadorChoferes() {
  const popup = document.getElementById('module-popup');
  const container = document.getElementById('popup-container');
  const titulo = document.getElementById('popup-title');

  popup.classList.add('active');
  titulo.textContent = '🚛 Checador Choferes';
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>';

  if (window._relojChoferInterval) {
    clearInterval(window._relojChoferInterval);
    window._relojChoferInterval = null;
  }

  Promise.all([
    new Promise(function(resolve) {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(function() { resolve({ error: true, choferes: [] }); })
        .getChoferes();
    }),
    new Promise(function(resolve) {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(function() { resolve({ error: false, zonas: [] }); })
        .getZonasValidas();
    })
  ]).then(function(results) {
    _zonasValidas = results[1].zonas || [];
    _fotoBase64 = null;
    _fotoMimeType = null;
    _gpsData = null;
    renderPanelChecador(results[0].choferes || []);
  });
}

function renderPanelChecador(choferes) {
  const container = document.getElementById('popup-container');

  // ⭐ Sin template literals anidados — construir opciones por separado
  const opcionesChoferes = choferes.map(function(c) {
    return '<option value="' + c.id + '" data-nombre="' + c.nombre + '">' + c.nombre + '</option>';
  }).join('');

  container.innerHTML =
    '<div style="max-width:520px;margin:0 auto;display:flex;flex-direction:column;gap:20px;">' +

    '<div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:12px;padding:16px;font-size:13px;color:#94A3B8;line-height:1.8;">' +
      '<strong style="color:#F1F5F9;">📋 Instrucciones:</strong><br>' +
      '1. Selecciona tu nombre<br>' +
      '2. Toma una foto (opcional)<br>' +
      '3. Obtén tu ubicación GPS (obligatorio)<br>' +
      '4. Presiona <strong>Registrar Checada</strong>' +
    '</div>' +

    '<div>' +
      '<label style="display:block;color:#F1F5F9;font-weight:600;margin-bottom:8px;font-size:14px;"><i class="fas fa-user"></i> Tu nombre</label>' +
      '<select id="chofer-select" style="width:100%;padding:14px;background:rgba(15,23,42,0.8);border:2px solid rgba(59,130,246,0.4);color:#F1F5F9;border-radius:10px;font-size:15px;cursor:pointer;">' +
        '<option value="">-- Selecciona tu nombre --</option>' +
        opcionesChoferes +
      '</select>' +
    '</div>' +

    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:rgba(30,41,59,0.6);border-radius:10px;padding:16px;border:1px solid rgba(51,65,85,0.5);">' +
      '<div style="text-align:center;">' +
        '<div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Fecha</div>' +
        '<div id="chofer-fecha" style="font-size:18px;font-weight:700;color:#F1F5F9;">--/--/----</div>' +
      '</div>' +
      '<div style="text-align:center;">' +
        '<div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Hora</div>' +
        '<div id="chofer-hora" style="font-size:18px;font-weight:700;color:#3B82F6;">--:--:--</div>' +
      '</div>' +
    '</div>' +

    '<div>' +
      '<label style="display:block;color:#F1F5F9;font-weight:600;margin-bottom:8px;font-size:14px;"><i class="fas fa-camera"></i> Foto (opcional)</label>' +
      '<div style="display:flex;gap:10px;align-items:flex-start;">' +
        '<button onclick="abrirCamaraChofer()" style="flex:1;padding:14px;background:rgba(16,185,129,0.15);border:2px solid #10B981;border-radius:10px;color:#10B981;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s;" onmouseover="this.style.background=\'rgba(16,185,129,0.25)\'" onmouseout="this.style.background=\'rgba(16,185,129,0.15)\'">' +
          '<i class="fas fa-camera" style="font-size:18px;"></i> Tomar Foto' +
        '</button>' +
        '<div id="chofer-foto-preview" style="width:80px;height:80px;border-radius:10px;background:rgba(30,41,59,0.8);border:2px dashed rgba(51,65,85,0.6);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">' +
          '<i class="fas fa-image" style="color:#475569;font-size:24px;"></i>' +
        '</div>' +
      '</div>' +
      '<div id="chofer-foto-status" style="margin-top:8px;font-size:12px;color:#64748B;">Sin foto</div>' +
    '</div>' +

    '<div>' +
      '<label style="display:block;color:#F1F5F9;font-weight:600;margin-bottom:8px;font-size:14px;"><i class="fas fa-map-marker-alt"></i> Ubicación GPS (obligatorio)</label>' +
      '<button id="btn-gps-chofer" onclick="obtenerGPSChofer()" style="width:100%;padding:14px;background:rgba(245,158,11,0.15);border:2px solid #F59E0B;border-radius:10px;color:#F59E0B;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s;" onmouseover="this.style.background=\'rgba(245,158,11,0.25)\'" onmouseout="this.style.background=\'rgba(245,158,11,0.15)\'">' +
        '<i class="fas fa-location-arrow" style="font-size:18px;"></i> Obtener Ubicación' +
      '</button>' +
      '<div id="chofer-gps-resultado" style="margin-top:12px;display:none;"></div>' +
    '</div>' +

    '<button id="btn-registrar-chofer" onclick="registrarChecadaChofer()" disabled style="width:100%;padding:18px;background:linear-gradient(135deg,#3B82F6,#06B6D4);border:none;border-radius:12px;color:white;font-weight:800;font-size:17px;cursor:not-allowed;opacity:0.4;display:flex;align-items:center;justify-content:center;gap:10px;transition:all 0.3s;">' +
      '<i class="fas fa-check-circle" style="font-size:22px;"></i> Registrar Checada' +
    '</button>' +

    '<div id="chofer-resultado" style="display:none;"></div>' +
  '</div>';

  actualizarRelojChofer();
  window._relojChoferInterval = setInterval(actualizarRelojChofer, 1000);
}

function actualizarRelojChofer() {
  const ahora = new Date();
  const fechaEl = document.getElementById('chofer-fecha');
  const horaEl = document.getElementById('chofer-hora');
  if (!fechaEl || !horaEl) { clearInterval(window._relojChoferInterval); return; }
  fechaEl.textContent = ahora.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  horaEl.textContent = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function procesarFotoChofer(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    const partes = dataUrl.split(',');
    _fotoBase64 = partes[1];
    _fotoMimeType = partes[0].split(':')[1].split(';')[0];

    document.getElementById('chofer-foto-preview').innerHTML =
      '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover;">';

    document.getElementById('chofer-foto-status').innerHTML =
      '<span style="color:#10B981;"><i class="fas fa-check-circle"></i> Foto lista (' + (file.size / 1024).toFixed(0) + ' KB)</span>';

    verificarBtnRegistrar();
  };
  reader.readAsDataURL(file);
}

function obtenerGPSChofer() {
  const btn = document.getElementById('btn-gps-chofer');
  const resultado = document.getElementById('chofer-gps-resultado');

  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Obteniendo ubicación...';
  btn.disabled = true;

  if (!navigator.geolocation) {
    resultado.style.display = 'block';
    resultado.innerHTML = '<div style="color:#EF4444;font-size:13px;">❌ Tu navegador no soporta GPS. Usa Chrome en móvil.</div>';
    btn.innerHTML = '<i class="fas fa-location-arrow"></i> Obtener Ubicación';
    btn.disabled = false;
    return;
  }

  // ⭐ Si las zonas no están cargadas aún, cargarlas primero y luego obtener GPS
  if (!_zonasValidas || _zonasValidas.length === 0) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando zonas...';
    google.script.run
      .withSuccessHandler(function(res) {
        _zonasValidas = (res && res.zonas) ? res.zonas : [];
        // Ahora sí obtener GPS
        _lanzarGeolocalizacion(btn, resultado);
      })
      .withFailureHandler(function() {
        _zonasValidas = [];
        _lanzarGeolocalizacion(btn, resultado);
      })
      .getZonasValidas();
  } else {
    _lanzarGeolocalizacion(btn, resultado);
  }
}

function _lanzarGeolocalizacion(btn, resultado) {
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Obteniendo ubicación...';
  navigator.geolocation.getCurrentPosition(
    function(pos) { procesarPosicionChofer(pos); },
    function(err) {
      let msg = 'Error obteniendo ubicación';
      if (err.code === 1) msg = 'Permiso de ubicación denegado. Actívalo en tu navegador.';
      if (err.code === 2) msg = 'Ubicación no disponible. Intenta al aire libre.';
      if (err.code === 3) msg = 'Tiempo de espera agotado. Intenta de nuevo.';
      resultado.style.display = 'block';
      resultado.innerHTML = '<div style="color:#EF4444;font-size:13px;padding:10px;background:rgba(239,68,68,0.1);border-radius:8px;">❌ ' + msg + '</div>';
      btn.innerHTML = '<i class="fas fa-location-arrow"></i> Reintentar Ubicación';
      btn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function procesarPosicionChofer(pos) {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const precision = Math.round(pos.coords.accuracy);
  const linkMaps = 'https://maps.google.com/?q=' + lat + ',' + lng;

  const btn = document.getElementById('btn-gps-chofer');
  const resultado = document.getElementById('chofer-gps-resultado');

  fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=18&addressdetails=1', {
    headers: { 'Accept-Language': 'es' }
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    const direccion = data.display_name || (lat + ', ' + lng);
    const zonaInfo = verificarZonaChofer(lat, lng);
    const estadoZona = zonaInfo.estadoZona;
    const zonaCercana = zonaInfo.zonaCercana;
    const distancia = zonaInfo.distancia;

    _gpsData = { lat, lng, direccion, precision, linkMaps, estadoZona, zonaCercana };

    const colorEstado = estadoZona === 'VÁLIDA' ? '#10B981' : '#F59E0B';
    const iconoEstado = estadoZona === 'VÁLIDA' ? '✅' : '⚠️';
    const textoEstado = estadoZona === 'VÁLIDA'
      ? 'Zona válida: ' + zonaCercana
      : 'Fuera de zona (' + distancia + 'm de ' + (zonaCercana || 'zona más cercana') + ')';

    // DEBUG: mostrar info detallada de zonas
    let debugZonas = '';
    if (_zonasValidas && _zonasValidas.length > 0) {
      debugZonas = '<details style="margin-top:8px;"><summary style="color:#64748B;font-size:11px;cursor:pointer;">🔍 Debug zonas (' + _zonasValidas.length + ' configuradas)</summary><div style="margin-top:6px;font-size:11px;color:#64748B;">';
      _zonasValidas.forEach(function(z) {
        const d = Math.round(calcularDistanciaMetros(lat, lng, z.lat, z.lng));
        const ok = d <= z.radio;
        debugZonas += '<div style="padding:3px 0;color:' + (ok ? '#10B981' : '#94A3B8') + ';">' +
          (ok ? '✅' : '❌') + ' ' + z.zona + ': ' + d + 'm (radio: ' + z.radio + 'm)' +
          '<br>&nbsp;&nbsp;Centro: ' + z.lat.toFixed(6) + ', ' + z.lng.toFixed(6) + '</div>';
      });
      debugZonas += '</div></details>';
    } else {
      debugZonas = '<div style="margin-top:6px;color:#F59E0B;font-size:11px;">⚠️ Sin zonas configuradas en CONFIG_CHOFERES</div>';
    }

    resultado.style.display = 'block';
    resultado.innerHTML =
      '<div style="background:rgba(30,41,59,0.8);border:1px solid rgba(51,65,85,0.5);border-radius:10px;padding:14px;font-size:13px;">' +
        '<div style="color:' + colorEstado + ';font-weight:700;font-size:14px;margin-bottom:10px;">' + iconoEstado + ' ' + textoEstado + '</div>' +
        '<div style="color:#94A3B8;margin-bottom:6px;line-height:1.5;"><i class="fas fa-map-pin" style="color:#3B82F6;margin-right:6px;"></i>' + direccion + '</div>' +
        '<div style="color:#64748B;font-size:11px;margin-bottom:6px;">📍 ' + lat.toFixed(6) + ', ' + lng.toFixed(6) + ' &nbsp;·&nbsp; 🎯 ±' + precision + 'm</div>' +
        debugZonas +
        '<div style="margin-top:10px;">' +
          '<a href="' + linkMaps + '" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.4);border-radius:8px;color:#3B82F6;font-size:12px;font-weight:600;text-decoration:none;">' +
            '<i class="fas fa-external-link-alt"></i> Ver en Google Maps' +
          '</a>' +
        '</div>' +
      '</div>';

    btn.innerHTML = '<i class="fas fa-check"></i> Ubicación obtenida';
    btn.style.borderColor = '#10B981';
    btn.style.color = '#10B981';
    btn.disabled = false;
    verificarBtnRegistrar();
  })
  .catch(function() {
    const zonaInfo = verificarZonaChofer(lat, lng);
    _gpsData = { lat, lng, direccion: lat + ', ' + lng, precision, linkMaps, estadoZona: zonaInfo.estadoZona, zonaCercana: zonaInfo.zonaCercana };

    resultado.style.display = 'block';
    resultado.innerHTML =
      '<div style="background:rgba(30,41,59,0.8);border-radius:10px;padding:14px;font-size:13px;">' +
        '<div style="color:#94A3B8;">📍 ' + lat.toFixed(6) + ', ' + lng.toFixed(6) + ' (±' + precision + 'm)</div>' +
        '<a href="' + linkMaps + '" target="_blank" style="color:#3B82F6;font-size:12px;">Ver en Google Maps</a>' +
      '</div>';

    btn.innerHTML = '<i class="fas fa-check"></i> Ubicación obtenida';
    btn.disabled = false;
    verificarBtnRegistrar();
  });
}

function calcularDistanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function verificarZonaChofer(lat, lng) {
  if (!_zonasValidas || _zonasValidas.length === 0)
    return { estadoZona: 'SIN_ZONAS', zonaCercana: '', distancia: 0 };

  let zonaValida = null;
  let distanciaMinima = Infinity;
  let zonaMasCercana = '';

  _zonasValidas.forEach(function(zona) {
    const dist = calcularDistanciaMetros(lat, lng, zona.lat, zona.lng);
    if (dist < distanciaMinima) { distanciaMinima = dist; zonaMasCercana = zona.zona; }
    if (dist <= zona.radio) zonaValida = zona;
  });

  if (zonaValida) return { estadoZona: 'VÁLIDA', zonaCercana: zonaValida.zona, distancia: Math.round(distanciaMinima) };
  return { estadoZona: 'FUERA DE ZONA', zonaCercana: zonaMasCercana, distancia: Math.round(distanciaMinima) };
}

function verificarBtnRegistrar() {
  const btn = document.getElementById('btn-registrar-chofer');
  if (!btn) return;
  const listo = !!(_gpsData);
  btn.disabled = !listo;
  btn.style.opacity = listo ? '1' : '0.4';
  btn.style.cursor = listo ? 'pointer' : 'not-allowed';
}

function registrarChecadaChofer() {
  const select = document.getElementById('chofer-select');
  if (!select || !select.value) { mostrarNotificacion('error', '⚠️ Selecciona tu nombre'); return; }
  if (!_gpsData) { mostrarNotificacion('error', '⚠️ Falta la ubicación GPS'); return; }

  const nombreSeleccionado = select.options[select.selectedIndex].dataset.nombre;
  const idSeleccionado = select.value;

  const ahora = new Date();
  const fecha = ahora.toISOString().substring(0, 10);
  const hora = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const timestamp = ahora.toLocaleString('es-MX');

  const btn = document.getElementById('btn-registrar-chofer');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';

  const datos = {
    idUsuario: idSeleccionado,
    nombre: nombreSeleccionado,
    fecha, hora,
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
        const zonaValida = _gpsData.estadoZona === 'VÁLIDA';
        const colorZona = zonaValida ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)';
        const borderZona = zonaValida ? '#10B981' : '#F59E0B';
        const colorTextoZona = zonaValida ? '#10B981' : '#F59E0B';
        const textoZona = zonaValida
          ? '📍 ✅ Zona válida: ' + _gpsData.zonaCercana
          : '📍 ⚠️ Fuera de zona — no se contabilizará';

        resDiv.innerHTML =
          '<div style="background:rgba(16,185,129,0.1);border:2px solid #10B981;border-radius:12px;padding:20px;text-align:center;">' +
            '<div style="font-size:48px;margin-bottom:10px;">✅</div>' +
            '<div style="font-size:18px;font-weight:800;color:#10B981;margin-bottom:6px;">¡Checada Registrada!</div>' +
            '<div style="font-size:13px;color:#94A3B8;margin-bottom:12px;">' + nombreSeleccionado + ' · ' + hora + '</div>' +
            '<div style="padding:10px 16px;border-radius:8px;font-size:13px;font-weight:700;background:' + colorZona + ';border:1px solid ' + borderZona + ';color:' + colorTextoZona + ';">' +
              textoZona +
            '</div>' +
          '</div>';

        _fotoBase64 = null;
        _fotoMimeType = null;
        _gpsData = null;

        btn.innerHTML = '<i class="fas fa-check-circle"></i> Registrar Otra Checada';
        btn.disabled = false;
        btn.onclick = function() { abrirChecadorChoferes(); };

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
// CÁMARA — usa input[type=file] en todos los dispositivos (sin permisos)
// ============================================================================

function abrirCamaraChofer() {
  // Eliminar input anterior si existe
  var inputAnterior = document.getElementById('camara-input-file');
  if (inputAnterior) inputAnterior.remove();

  var input = document.createElement('input');
  input.type = 'file';
  input.id = 'camara-input-file';
  input.accept = 'image/*';
  // capture=environment abre cámara trasera en móvil; en desktop abre el selector de archivo
  input.setAttribute('capture', 'environment');
  input.style.display = 'none';
  document.body.appendChild(input);

  input.onchange = function() {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var dataUrl = e.target.result;
      var partes = dataUrl.split(',');
      _fotoBase64 = partes[1];
      _fotoMimeType = file.type || 'image/jpeg';

      var preview = document.getElementById('chofer-foto-preview');
      if (preview) preview.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover;">';
      var status = document.getElementById('chofer-foto-status');
      if (status) status.innerHTML = '<span style="color:#10B981;"><i class="fas fa-check-circle"></i> Foto cargada</span>';

      verificarBtnRegistrar();
    };
    reader.readAsDataURL(file);
    input.remove();
  };

  input.click();
}

function capturarFotoChofer() {
  const video = document.getElementById('camara-preview');
  const canvas = document.getElementById('camara-canvas');
  if (!video || !canvas) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const partes = dataUrl.split(',');
  _fotoBase64 = partes[1];
  _fotoMimeType = 'image/jpeg';

  // Preview
  const preview = document.getElementById('chofer-foto-preview');
  if (preview) preview.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover;">';
  const status = document.getElementById('chofer-foto-status');
  if (status) status.innerHTML = '<span style="color:#10B981;"><i class="fas fa-check-circle"></i> Foto capturada</span>';

  cerrarCamaraChofer();
  verificarBtnRegistrar();
}

function cerrarCamaraChofer() {
  if (_streamCamara) {
    _streamCamara.getTracks().forEach(function(t) { t.stop(); });
    _streamCamara = null;
  }
  const modal = document.getElementById('camara-modal');
  if (modal) modal.style.display = 'none';
}
