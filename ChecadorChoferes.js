// ============================================================================
// CHECADOR CHOFERES — Utilidades GPS
// ============================================================================

var _zonasValidas = [];
var _gpsData = null;

function calcularDistanciaMetros(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
