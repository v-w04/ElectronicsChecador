// ============================================================================
// CHECADOR CHOFERES — Utilidades GPS y validación de zona
// ============================================================================
// Estado global compartido con WebApp.js:
//   _zonasValidas → array de { zona, descripcion, lat, lng, radio } cargado
//                   desde CONFIG_CHOFERES al iniciar la PWA
//   _gpsData      → última ubicación obtenida del navegador { lat, lng, accuracy }
// ============================================================================

var _zonasValidas = [];
var _gpsData = null;

var _LS_KEY_ZONAS = 'em_zonas_validas_cache';

// ── Restaurar zonas desde localStorage al arrancar (offline-first) ────────
// Se ejecuta de inmediato al cargar el script. Si hay conexión, después se
// refrescan con cargarZonasValidas() y se vuelven a guardar.
(function _restaurarZonasDeCache() {
  try {
    var raw = localStorage.getItem(_LS_KEY_ZONAS);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        _zonasValidas = parsed;
        console.log('📦 Zonas restauradas desde cache local:', _zonasValidas.length);
      }
    }
  } catch(e) {}
})();

// ── Distancia Haversine en metros ──────────────────────────────────────────
function calcularDistanciaMetros(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Verifica si la ubicación cae dentro de alguna zona activa ──────────────
// Retorna:
//   { estadoZona: 'VÁLIDA' | 'FUERA DE ZONA' | 'SIN_ZONAS',
//     zonaCercana: 'NOMBRE_ZONA',
//     distancia: metros }
function verificarZonaChofer(lat, lng) {
  if (!_zonasValidas || _zonasValidas.length === 0)
    return { estadoZona: 'SIN_ZONAS', zonaCercana: '', distancia: 0 };

  var zonaValida = null;
  var distanciaMinima = Infinity;
  var zonaMasCercana = '';

  _zonasValidas.forEach(function(zona) {
    var dist = calcularDistanciaMetros(lat, lng, zona.lat, zona.lng);
    if (dist < distanciaMinima) { distanciaMinima = dist; zonaMasCercana = zona.zona; }
    if (dist <= zona.radio) zonaValida = zona;
  });

  if (zonaValida) return { estadoZona: 'VÁLIDA', zonaCercana: zonaValida.zona, distancia: Math.round(distanciaMinima) };
  return { estadoZona: 'FUERA DE ZONA', zonaCercana: zonaMasCercana, distancia: Math.round(distanciaMinima) };
}

// ── Cargar zonas válidas desde el backend al iniciar ───────────────────────
// Se llama desde DOMContentLoaded en WebApp.js
function cargarZonasValidas() {
  if (typeof google === 'undefined' || !google.script || !google.script.run) {
    console.warn('⚠️ google.script.run no disponible, no se cargarán zonas');
    return;
  }
  google.script.run
    .withSuccessHandler(function(result) {
      if (result && !result.error && Array.isArray(result.zonas)) {
        _zonasValidas = result.zonas;
        try {
          localStorage.setItem(_LS_KEY_ZONAS, JSON.stringify(_zonasValidas));
        } catch(e) {}
        console.log('✅ Zonas cargadas:', _zonasValidas.length, _zonasValidas.map(function(z){return z.zona;}).join(', '));
      } else {
        // Si el backend respondió pero sin zonas, NO borramos el cache local
        // (puede ser un error temporal — mejor mantener zonas viejas que ninguna)
        console.warn('⚠️ getZonasValidas respondió sin zonas:', result);
      }
    })
    .withFailureHandler(function(err) {
      // Sin internet o GAS falló → mantener zonas del cache local
      console.warn('⚠️ getZonasValidas falló (se mantienen zonas en cache):', err && err.message);
    })
    .getZonasValidas();
}

// ── Pedir ubicación al navegador (Promise) ─────────────────────────────────
// Resuelve con { lat, lng, accuracy } si el usuario aprueba y se obtiene GPS.
// Resuelve con null si: navegador no soporta, usuario denegó, o timeout.
// NUNCA rechaza — siempre resuelve para no bloquear el flow de checada.
function solicitarUbicacion(timeoutMs) {
  if (timeoutMs === undefined) timeoutMs = 8000;
  return new Promise(function(resolve) {
    if (!('geolocation' in navigator)) {
      console.warn('⚠️ navigator.geolocation no soportado');
      resolve(null);
      return;
    }
    var resolved = false;
    var timer = setTimeout(function() {
      if (!resolved) { resolved = true; console.warn('⚠️ GPS timeout'); resolve(null); }
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      function(pos) {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        var data = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        _gpsData = data;
        resolve(data);
      },
      function(err) {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        console.warn('⚠️ GPS error:', err.code, err.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs - 500,
        maximumAge: 30000  // aceptar ubicación cacheada hasta 30s vieja
      }
    );
  });
}
