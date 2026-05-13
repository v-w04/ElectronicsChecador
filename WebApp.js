// ============================================================================
// SISTEMA DE ACCESO — PIN + CONTRASEÑA EN UNA SOLA PANTALLA
// ============================================================================

function mostrarPantallaPIN() {
  if (document.getElementById('pin-overlay')) return; // ya existe
  const overlay = document.createElement('div');
  overlay.id = 'pin-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,#0F172A 0%,#1E293B 100%);z-index:99999;display:flex;align-items:center;justify-content:center;';

  overlay.innerHTML = `
    <div id="pin-box" style="background:rgba(30,41,59,0.95);border:2px solid rgba(59,130,246,0.4);border-radius:20px;padding:40px 36px;width:360px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
      <div style="font-size:48px;margin-bottom:12px;">🔐</div>
      <h2 style="color:#F1F5F9;font-size:20px;font-weight:700;margin-bottom:4px;">Electronics México</h2>
      <p style="color:#64748B;font-size:12px;margin-bottom:24px;">Ingresa tu PIN y contraseña</p>

      <div style="margin-bottom:14px;text-align:left;">
        <label style="color:#94A3B8;font-size:11px;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">PIN de acceso</label>
        <input id="input-pin" type="password" inputmode="numeric" maxlength="4" placeholder="••••"
          style="width:100%;padding:14px 16px;background:rgba(15,23,42,0.8);border:2px solid rgba(59,130,246,0.3);border-radius:12px;color:#F1F5F9;font-size:22px;text-align:center;letter-spacing:8px;outline:none;box-sizing:border-box;transition:border 0.2s;"
          onfocus="this.style.borderColor='#3B82F6'"
          onblur="this.style.borderColor='rgba(59,130,246,0.3)'"
          oninput="onPinInput(this)"
          onkeydown="if(event.key==='Enter'){procesarAcceso();}" />
      </div>

      <div id="contrasena-section" style="margin-bottom:20px;text-align:left;display:none;">
        <label style="color:#94A3B8;font-size:11px;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;" id="contrasena-label">Contraseña</label>
        <input id="input-contrasena" type="password" placeholder="Contraseña"
          style="width:100%;padding:14px 16px;background:rgba(15,23,42,0.8);border:2px solid rgba(59,130,246,0.3);border-radius:12px;color:#F1F5F9;font-size:16px;text-align:center;outline:none;box-sizing:border-box;transition:border 0.2s;"
          onfocus="this.style.borderColor='#3B82F6'"
          onblur="this.style.borderColor='rgba(59,130,246,0.3)'"
          onkeydown="if(event.key==='Enter'){procesarAcceso();}" />
        <div id="contrasena2-section" style="display:none;margin-top:10px;">
          <input id="input-contrasena2" type="password" placeholder="Confirmar contraseña"
            style="width:100%;padding:14px 16px;background:rgba(15,23,42,0.8);border:2px solid rgba(59,130,246,0.3);border-radius:12px;color:#F1F5F9;font-size:16px;text-align:center;outline:none;box-sizing:border-box;transition:border 0.2s;"
            onfocus="this.style.borderColor='#3B82F6'"
            onblur="this.style.borderColor='rgba(59,130,246,0.3)'"
            onkeydown="if(event.key==='Enter'){procesarAcceso();}" />
        </div>
      </div>

      <div id="nombre-display" style="display:none;padding:8px 12px;background:rgba(59,130,246,0.1);border-radius:8px;color:#3B82F6;font-size:13px;font-weight:600;margin-bottom:16px;"></div>

      <button id="btn-acceso" onclick="procesarAcceso()"
        style="width:100%;padding:15px;background:linear-gradient(135deg,#3B82F6,#06B6D4);border:none;border-radius:12px;color:white;font-weight:800;font-size:16px;cursor:pointer;transition:opacity 0.2s;">
        Entrar
      </button>

      <div id="acceso-error" style="margin-top:14px;color:#EF4444;font-size:13px;font-weight:600;min-height:18px;opacity:0;transition:opacity 0.3s;"></div>
    </div>
  `;

  document.body.appendChild(overlay);
  window._pinVerificado = false;
  window._pinChofer = null;
  window._nombreChofer = null;
  window._idChofer = null;
  window._esNuevaContrasena = false;

  setTimeout(() => {
    const inp = document.getElementById('input-pin');
    if (inp) inp.focus();
  }, 100);
}

function onPinInput(el) {
  el.value = el.value.replace(/\D/g, '').substring(0, 4);

  if (el.value.length === 4 && !window._pinVerificado) {
    verificarPIN(el.value);
  }

  if (window._pinVerificado && el.value.length < 4) {
    resetearEstadoAcceso();
  }
}

function resetearEstadoAcceso() {
  window._pinVerificado = false;
  window._pinChofer = null;
  window._nombreChofer = null;
  window._idChofer = null;
  window._esNuevaContrasena = false;

  const contrasenaSection = document.getElementById('contrasena-section');
  if (contrasenaSection) contrasenaSection.style.display = 'none';
  const nombreDisplay = document.getElementById('nombre-display');
  if (nombreDisplay) nombreDisplay.style.display = 'none';
  const btnAcceso = document.getElementById('btn-acceso');
  if (btnAcceso) btnAcceso.textContent = 'Entrar';
  const contrasena2 = document.getElementById('contrasena2-section');
  if (contrasena2) contrasena2.style.display = 'none';
}

function verificarPIN(pin) {
  if (window._pinVerificado) return;
  const btnAcceso = document.getElementById('btn-acceso');
  const inputPin = document.getElementById('input-pin');
  if (btnAcceso) { btnAcceso.disabled = true; btnAcceso.textContent = 'Verificando...'; }
  if (inputPin) inputPin.disabled = true;

  google.script.run
    .withSuccessHandler(function(result) {
      if (btnAcceso) { btnAcceso.disabled = false; btnAcceso.textContent = 'Entrar'; }
      if (inputPin) inputPin.disabled = false;

      if (!result.ok) {
        mostrarErrorAcceso(result.message || 'PIN incorrecto');
        const inp = document.getElementById('input-pin');
        if (inp) { inp.value = ''; inp.focus(); }
        return;
      }

      if (result.tipo === 'ADMIN') {
        // Admin entra directo
        document.getElementById('pin-overlay').remove();
        return;
      }

      if (result.tipo === 'CHOFER') {
        window._pinVerificado = true;
        window._pinChofer = pin;
        window._nombreChofer = result.nombre;
        window._idChofer = result.idUsuario;
        window._esNuevaContrasena = !result.tieneContrasena;

        // Mostrar nombre
        const nombreDisplay = document.getElementById('nombre-display');
        if (nombreDisplay) {
          nombreDisplay.textContent = '👤 ' + result.nombre;
          nombreDisplay.style.display = 'block';
        }

        // Mostrar sección contraseña
        const contrasenaSection = document.getElementById('contrasena-section');
        if (contrasenaSection) contrasenaSection.style.display = 'block';

        const label = document.getElementById('contrasena-label');
        const contrasena2 = document.getElementById('contrasena2-section');
        const btnAcceso2 = document.getElementById('btn-acceso');

        if (!result.tieneContrasena) {
          // Primera vez
          if (label) label.textContent = 'Crear contraseña (primera vez)';
          if (contrasena2) contrasena2.style.display = 'block';
          if (btnAcceso2) btnAcceso2.textContent = '✅ Crear y Entrar';
        } else {
          if (label) label.textContent = 'Contraseña';
          if (contrasena2) contrasena2.style.display = 'none';
          if (btnAcceso2) btnAcceso2.textContent = '→ Entrar';
        }

        setTimeout(() => {
          const inp = document.getElementById('input-contrasena');
          if (inp) inp.focus();
        }, 100);
      }
    })
    .withFailureHandler(function(err) {
      if (btnAcceso) { btnAcceso.disabled = false; btnAcceso.textContent = 'Entrar'; }
      if (inputPin) inputPin.disabled = false;
      mostrarErrorAcceso('Error de conexión');
    })
    .validarPin(pin);
}

function procesarAcceso() {
  const pinInp = document.getElementById('input-pin');
  const pin = pinInp ? pinInp.value.trim() : '';

  // Si el PIN no está verificado aún
  if (!window._pinVerificado) {
    if (pin.length < 4) { mostrarErrorAcceso('Ingresa tu PIN de 4 dígitos'); return; }
    verificarPIN(pin);
    return;
  }

  // PIN ya verificado — procesar contraseña
  const contrasenaInp = document.getElementById('input-contrasena');
  const contrasena = contrasenaInp ? contrasenaInp.value.trim() : '';
  if (!contrasena) { mostrarErrorAcceso('Ingresa tu contraseña'); return; }

  if (window._esNuevaContrasena) {
    // Crear contraseña nueva
    const contrasena2Inp = document.getElementById('input-contrasena2');
    const contrasena2 = contrasena2Inp ? contrasena2Inp.value.trim() : '';
    if (contrasena !== contrasena2) { mostrarErrorAcceso('Las contraseñas no coinciden'); return; }

    const btn = document.getElementById('btn-acceso');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    google.script.run
      .withSuccessHandler(function(result) {
        if (!result.ok) { mostrarErrorAcceso(result.message || 'Error al guardar'); if (btn) { btn.disabled = false; btn.textContent = '✅ Crear y Entrar'; } return; }
        document.getElementById('pin-overlay').remove();
        abrirChecadorChoferDirecto(window._nombreChofer, window._idChofer);
      })
      .withFailureHandler(function() { mostrarErrorAcceso('Error de conexión'); if (btn) { btn.disabled = false; btn.textContent = '✅ Crear y Entrar'; } })
      .guardarContrasena(window._pinChofer, window._nombreChofer, contrasena);

  } else {
    // Validar contraseña existente
    const btn = document.getElementById('btn-acceso');
    if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }

    google.script.run
      .withSuccessHandler(function(result) {
        if (!result.ok) {
          mostrarErrorAcceso(result.message || 'Contraseña incorrecta');
          if (contrasenaInp) { contrasenaInp.value = ''; contrasenaInp.focus(); }
          if (btn) { btn.disabled = false; btn.textContent = '→ Entrar'; }
          return;
        }
        document.getElementById('pin-overlay').remove();
        abrirChecadorChoferDirecto(window._nombreChofer, window._idChofer);
      })
      .withFailureHandler(function() { mostrarErrorAcceso('Error de conexión'); if (btn) { btn.disabled = false; btn.textContent = '→ Entrar'; } })
      .validarContrasena(window._pinChofer, contrasena);
  }
}

function mostrarErrorAcceso(msg) {
  const errEl = document.getElementById('acceso-error');
  if (!errEl) return;
  errEl.textContent = msg;
  errEl.style.opacity = '1';
  setTimeout(() => { errEl.style.opacity = '0'; }, 3000);
  // Shake solo en el box
  const box = document.getElementById('pin-box');
  if (box) {
    box.style.animation = 'pinShake 0.4s ease';
    setTimeout(() => { box.style.animation = ''; }, 400);
  }
}

// ============================================================================
// CHECADOR CHOFER DIRECTO — Layout horizontal, sin scroll
// ============================================================================

function abrirChecadorChoferDirecto(nombre, idUsuario) {
  if (!document.getElementById('chofer-styles')) {
    var st = document.createElement('style');
    st.id = 'chofer-styles';
    st.textContent =
      '#chofer-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;width:100%;max-width:680px;}' +
      '@media(max-width:600px){#chofer-grid{grid-template-columns:1fr;}}' +
      '.chofer-col{display:flex;flex-direction:column;gap:12px;}' +
      '.chofer-label{color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:2px;}' +
      '.chofer-btn{width:100%;padding:12px 16px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s;border:none;}' +
      '.chofer-btn-gps{background:rgba(59,130,246,0.12);border:1.5px solid #3B82F6 !important;color:#3B82F6;}' +
      '.chofer-btn-gps:hover{background:rgba(59,130,246,0.22);}' +
      '.chofer-btn-reg{background:linear-gradient(135deg,#3B82F6,#06B6D4);color:white;font-size:15px;padding:14px;}' +
      '.chofer-btn-reg:disabled{opacity:0.35;cursor:not-allowed;}' +
      '.chofer-btn-reg:not(:disabled):hover{opacity:0.9;transform:translateY(-1px);}' +
      '.chofer-status{font-size:11px;color:#475569;text-align:center;}' +
      '@keyframes pinShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px)}40%{transform:translateX(10px)}60%{transform:translateX(-8px)}80%{transform:translateX(8px)}}' +
      '@keyframes countdownPop{0%{transform:scale(0.5);opacity:0}50%{transform:scale(1.3)}100%{transform:scale(1);opacity:1}}';
    document.head.appendChild(st);
  }

  document.querySelector('.app-container').style.display = 'none';
  document.getElementById('particles').style.display = 'none';

  var wrapper = document.createElement('div');
  wrapper.id = 'chofer-wrapper';
  wrapper.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,#0F172A 0%,#1E293B 100%);display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;z-index:1000;';

  wrapper.innerHTML =
    '<div style="padding:14px 20px;border-bottom:1px solid rgba(51,65,85,0.4);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">' +
      '<div style="display:flex;align-items:center;gap:12px;">' +
        '<div style="width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#3B82F6,#06B6D4);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🚛</div>' +
        '<div>' +
          '<div style="color:#F1F5F9;font-size:15px;font-weight:700;">Checador de Personal</div>' +
          '<div style="color:#3B82F6;font-size:12px;font-weight:600;">👤 ' + nombre + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="text-align:right;">' +
        '<div id="chofer-fecha" style="color:#64748B;font-size:11px;"></div>' +
        '<div id="chofer-hora" style="color:#F1F5F9;font-size:20px;font-weight:800;letter-spacing:1px;"></div>' +
      '</div>' +
    '</div>' +
    '<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:20px;">' +
      '<div style="width:100%;max-width:400px;display:flex;flex-direction:column;gap:16px;">' +
        '<div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:12px;padding:14px;font-size:13px;color:#94A3B8;">' +
          '📍 Presiona el botón para obtener tu ubicación. La checada se registra automáticamente.' +
        '</div>' +
        '<button id="btn-gps-chofer" class="chofer-btn chofer-btn-gps" onclick="obtenerGPSChoferFijo(\'' + nombre + '\',\'' + idUsuario + '\')" style="padding:18px;font-size:16px;">' +
          '<i class="fas fa-location-arrow" style="font-size:20px;"></i> Obtener Ubicación y Registrar' +
        '</button>' +
        '<div id="chofer-gps-resultado" style="border-radius:10px;overflow:hidden;font-size:12px;"></div>' +
        '<div id="chofer-resultado" style="display:none;"></div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(wrapper);

  google.script.run
    .withSuccessHandler(function(resZonas) {
      _zonasValidas = resZonas.zonas || [];
      _gpsData = null;
      actualizarRelojChofer();
      window._relojChoferInterval = setInterval(actualizarRelojChofer, 1000);
    })
    .withFailureHandler(function() {
      _zonasValidas = [];
      actualizarRelojChofer();
      window._relojChoferInterval = setInterval(actualizarRelojChofer, 1000);
    })
    .getZonasValidas();
}

function actualizarRelojChofer() {
  const ahora = new Date();
  const fechaEl = document.getElementById('chofer-fecha');
  const horaEl  = document.getElementById('chofer-hora');
  if (!fechaEl || !horaEl) { clearInterval(window._relojChoferInterval); return; }
  fechaEl.textContent = ahora.toLocaleDateString('es-MX', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
  horaEl.textContent  = ahora.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
}

function verificarBtnRegistrar() {
  // mantenida por compatibilidad - ya no usada en flujo directo
}

function obtenerGPSChoferFijo(nombre, idUsuario) {
  var btn = document.getElementById('btn-gps-chofer');
  var resultado = document.getElementById('chofer-gps-resultado');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Obteniendo ubicación...';
  btn.disabled = true;

  if (!navigator.geolocation) {
    resultado.style.display = 'block';
    resultado.innerHTML = '<div style="color:#EF4444;padding:10px;background:rgba(239,68,68,0.1);border-radius:8px;font-size:13px;">❌ GPS no disponible en este navegador.</div>';
    btn.innerHTML = '<i class="fas fa-location-arrow"></i> Obtener Ubicación y Registrar';
    btn.disabled = false;
    return;
  }

  // Recargar zonas si están vacías
  function lanzarGPS() {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Obteniendo ubicación...';
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        var precision = Math.round(pos.coords.accuracy);
        var linkMaps = 'https://maps.google.com/?q=' + lat + ',' + lng;

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando zona...';

        // Geocodificar
        fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&accept-language=es')
          .then(function(r) { return r.json(); })
          .then(function(d) {
            var direccion = d.display_name || (lat.toFixed(6) + ', ' + lng.toFixed(6));
            _procesarGPSFijo(nombre, idUsuario, lat, lng, direccion, precision, linkMaps, btn, resultado);
          })
          .catch(function() {
            _procesarGPSFijo(nombre, idUsuario, lat, lng, lat.toFixed(6) + ', ' + lng.toFixed(6), precision, linkMaps, btn, resultado);
          });
      },
      function(err) {
        var msg = 'Error obteniendo ubicación';
        if (err.code === 1) msg = 'Permiso de ubicación denegado. Actívalo en tu navegador.';
        if (err.code === 2) msg = 'Ubicación no disponible.';
        if (err.code === 3) msg = 'Tiempo de espera agotado. Intenta de nuevo.';
        resultado.style.display = 'block';
        resultado.innerHTML = '<div style="color:#EF4444;padding:10px;background:rgba(239,68,68,0.1);border-radius:8px;font-size:13px;">❌ ' + msg + '</div>';
        btn.innerHTML = '<i class="fas fa-location-arrow"></i> Reintentar';
        btn.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  if (!_zonasValidas || _zonasValidas.length === 0) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando zonas...';
    google.script.run
      .withSuccessHandler(function(res) {
        _zonasValidas = (res && res.zonas) ? res.zonas : [];
        lanzarGPS();
      })
      .withFailureHandler(function() { _zonasValidas = []; lanzarGPS(); })
      .getZonasValidas();
  } else {
    lanzarGPS();
  }
}

function _procesarGPSFijo(nombre, idUsuario, lat, lng, direccion, precision, linkMaps, btn, resultado) {
  var zonaInfo = verificarZonaChofer(lat, lng);
  _gpsData = { lat: lat, lng: lng, direccion: direccion, precision: precision, linkMaps: linkMaps, estadoZona: zonaInfo.estadoZona, zonaCercana: zonaInfo.zonaCercana };

  // Mostrar info GPS
  var colorEstado = zonaInfo.estadoZona === 'VÁLIDA' ? '#10B981' : '#F59E0B';
  var textoEstado = zonaInfo.estadoZona === 'VÁLIDA' ? '✅ Zona válida: ' + zonaInfo.zonaCercana : '⚠️ Fuera de zona (' + zonaInfo.distancia + 'm)';
  resultado.style.display = 'block';
  resultado.innerHTML =
    '<div style="background:rgba(30,41,59,0.8);border:1px solid rgba(51,65,85,0.5);border-radius:10px;padding:12px;margin-bottom:8px;">' +
      '<div style="color:' + colorEstado + ';font-weight:700;font-size:13px;margin-bottom:4px;">' + textoEstado + '</div>' +
      '<div style="color:#64748B;font-size:11px;">📍 ' + lat.toFixed(6) + ', ' + lng.toFixed(6) + ' · ±' + precision + 'm</div>' +
    '</div>';

  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';

  // Registrar directamente
  var ahora = new Date();
  var fecha = ahora.toISOString().substring(0, 10);
  var hora  = ahora.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  var timestamp = ahora.toLocaleString('es-MX');

  var datos = {
    idUsuario: idUsuario, nombre: nombre, fecha: fecha, hora: hora,
    timestampCompleto: timestamp,
    lat: lat, lng: lng, direccion: direccion, precision: precision,
    linkMaps: linkMaps, estadoZona: zonaInfo.estadoZona, zonaCercana: zonaInfo.zonaCercana
  };

  var resDiv = document.getElementById('chofer-resultado');
  resDiv.style.display = 'block';
  resDiv.innerHTML = '<div style="text-align:center;padding:10px;color:#94A3B8;font-size:13px;"><i class="fas fa-spinner fa-spin"></i> Guardando...</div>';

  google.script.run
    .withSuccessHandler(function(result) {
      _gpsData = null;
      if (result.ok) {
        var zonaValida = zonaInfo.estadoZona === 'VÁLIDA';
        resDiv.innerHTML =
          '<div style="background:rgba(16,185,129,0.1);border:2px solid #10B981;border-radius:12px;padding:16px;text-align:center;">' +
            '<div style="font-size:40px;margin-bottom:8px;">✅</div>' +
            '<div style="font-size:16px;font-weight:800;color:#10B981;margin-bottom:4px;">¡Checada Registrada!</div>' +
            '<div style="font-size:12px;color:#94A3B8;margin-bottom:10px;">' + nombre + ' · ' + hora + '</div>' +
            '<div style="padding:6px 12px;border-radius:6px;font-size:12px;font-weight:700;margin-bottom:14px;background:' + (zonaValida ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)') + ';border:1px solid ' + (zonaValida ? '#10B981' : '#F59E0B') + ';color:' + (zonaValida ? '#10B981' : '#F59E0B') + ';">' +
              (zonaValida ? '📍 ✅ ' + zonaInfo.zonaCercana : '📍 ⚠️ Fuera de zona — registrada') +
            '</div>' +
            '<button onclick="_volverAlPIN()" style="padding:10px 24px;background:linear-gradient(135deg,#3B82F6,#06B6D4);border:none;border-radius:10px;color:white;font-weight:700;font-size:14px;cursor:pointer;">' +
              '<i class="fas fa-user-check"></i> Siguiente empleado' +
            '</button>' +
          '</div>';
        btn.style.display = 'none';
      } else {
        resDiv.innerHTML = '<div style="background:rgba(239,68,68,0.1);border:1px solid #EF4444;border-radius:10px;padding:12px;color:#EF4444;font-size:13px;text-align:center;">❌ ' + result.message + '<br><br><button onclick="obtenerGPSChoferFijo(\'' + nombre + '\',\'' + idUsuario + '\')" style="padding:8px 16px;background:rgba(239,68,68,0.2);border:1px solid #EF4444;border-radius:8px;color:#EF4444;cursor:pointer;">Reintentar</button></div>';
        btn.innerHTML = '<i class="fas fa-location-arrow"></i> Obtener Ubicación y Registrar';
        btn.disabled = false;
      }
    })
    .withFailureHandler(function(err) {
      resDiv.innerHTML = '<div style="color:#EF4444;font-size:13px;text-align:center;">❌ Error de conexión: ' + err.message + '</div>';
      btn.innerHTML = '<i class="fas fa-location-arrow"></i> Reintentar';
      btn.disabled = false;
    })
    .guardarChecadaChofer(datos);
}

function _volverAlPIN() {
  if (window._streamCamara) { window._streamCamara.getTracks().forEach(function(t){t.stop();}); window._streamCamara = null; }
  if (window._relojChoferInterval) { clearInterval(window._relojChoferInterval); window._relojChoferInterval = null; }
  var wrapper = document.getElementById('chofer-wrapper');
  if (wrapper) wrapper.remove();
  var appContainer = document.querySelector('.app-container');
  if (appContainer) appContainer.style.display = '';
  var particles = document.getElementById('particles');
  if (particles) particles.style.display = '';
  _gpsData = null;
  mostrarPantallaPIN();
}
// ============================================================================
// CÁMARA getUserMedia
// ============================================================================
let _streamCamara = null;
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
  const btn = document.getElementById('btn-control-asistencia');
  if (!btn) return;

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
  modalHTML.innerHTML = '<div style="font-size:64px;margin-bottom:24px;"><i class="fas fa-cog fa-spin" style="color:var(--primary);"></i></div><h2 style="color:var(--text-primary);margin-bottom:12px;font-size:26px;font-weight:700;">Ejecutando Control de Asistencia</h2><div style="background:rgba(51,65,85,0.6);border-radius:12px;height:12px;overflow:hidden;margin:24px 0;"><div id="progress-bar" style="background:linear-gradient(90deg,#3B82F6,#06B6D4,#10B981);height:100%;width:0%;transition:width 0.5s ease;"></div></div><div id="progress-text" style="color:var(--primary);font-size:18px;font-weight:600;margin-bottom:16px;">0%</div><div id="status-text" style="color:var(--text-secondary);font-size:14px;min-height:24px;font-family:Courier New,monospace;">Iniciando...</div>';

  overlay.appendChild(modalHTML);
  document.body.appendChild(overlay);

  const progressBar  = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const statusText   = document.getElementById('status-text');

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
        modalHTML.innerHTML = '<div style="font-size:72px;margin-bottom:24px;"><i class="fas fa-info-circle" style="color:#F59E0B;"></i></div><h2 style="color:#F59E0B;margin-bottom:12px;font-size:28px;font-weight:700;">Sin Datos para Procesar</h2><p style="color:var(--text-secondary);margin-bottom:28px;font-size:15px;">No se encontraron registros en RAW.</p><button id="btn-cerrar-info" style="padding:14px 32px;background:#F59E0B;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Cerrar y Refrescar</button>';
        document.getElementById('btn-cerrar-info').onclick = function() { overlay.remove(); loadDashboard(); };
      }
    })
    .withFailureHandler(function(error) {
      procesoTerminado = true;
      modalHTML.innerHTML = '<div style="font-size:72px;margin-bottom:24px;"><i class="fas fa-exclamation-circle" style="color:var(--danger);"></i></div><h2 style="color:var(--danger);margin-bottom:12px;font-size:28px;font-weight:700;">Error en el Proceso</h2><p style="color:var(--text-secondary);margin-bottom:12px;font-size:15px;">' + error.message + '</p><button id="btn-cerrar-error" style="padding:14px 32px;background:var(--danger);color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Cerrar</button>';
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
      modalHTML.innerHTML = '<div style="font-size:72px;margin-bottom:24px;"><i class="fas fa-check-circle" style="color:var(--success);"></i></div><h2 style="color:var(--success);margin-bottom:12px;font-size:28px;font-weight:700;">¡Proceso Completado!</h2><p style="color:var(--text-secondary);margin-bottom:28px;font-size:15px;">El control de asistencia se ejecutó correctamente</p><button id="btn-cerrar-exito" style="padding:14px 32px;background:var(--success);color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Cerrar y Refrescar</button>';
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
    .then(() => { btnExportar.disabled = false; btnExportar.innerHTML = textoOriginal; })
    .catch(err => { alert('Error al generar PDF'); btnExportar.disabled = false; btnExportar.innerHTML = textoOriginal; });
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
  document.querySelectorAll('#kpi-hoy-display,#kpi-faltas-display,#kpi-vacaciones-display,#kpi-retardos-display,#kpi-incidencias-display').forEach(el => {
    el.style.fontSize = '22px'; el.style.margin = '2px 0';
  });
  document.querySelectorAll('#percentage-hoy,#percentage-faltas,#percentage-vacaciones,#percentage-retardos,#percentage-incidencias').forEach(el => {
    el.style.fontSize = '11px'; el.style.bottom = '-14px';
  });
  document.querySelectorAll('#needle-hoy,#needle-faltas,#needle-vacaciones,#needle-retardos,#needle-incidencias').forEach(el => {
    el.style.height = '13px'; el.style.width = '2px'; el.style.bottom = '3px';
  });
  ['hoy','faltas','vacaciones','retardos','incidencias'].forEach(id => {
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
    grid.querySelectorAll('.kpi-card').forEach(card => {
      card.style.padding = '8px 4px';
      card.style.minHeight = 'unset';
      card.style.overflow = 'hidden';
    });
  }
}
