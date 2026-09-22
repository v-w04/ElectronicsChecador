/* ============================================================================
   UI COMPARTIDA — Checador Electronics México
   ============================================================================
   El control de zoom que ya existía en el panel viejo (index.html), ahora en
   las tres pantallas. Misma llave de siempre (`checador_zoom_v1`), así que a
   quien ya lo traía ajustado se le respeta.

   Se pone flotante abajo a la derecha: + para agrandar, − para achicar y el
   porcentaje para volver a 100%.
   ========================================================================== */

var EMUI = (function () {

  var LLAVE = 'checador_zoom_v1';
  var MIN = 0.8, MAX = 2.0;

  function leer() {
    var v = parseFloat(localStorage.getItem(LLAVE));
    return (isNaN(v) || v < MIN || v > MAX) ? 1 : v;
  }

  function aplicar(z) {
    // body.style.zoom funciona en Safari, Chrome y Edge, que es lo que usan
    // los celulares, la tablet y la computadora de la oficina.
    document.body.style.zoom = z;
    var d = document.getElementById('em-zoom-pct');
    if (d) d.textContent = Math.round(z * 100) + '%';
  }

  function cambiar(delta) {
    var z = leer() + delta;
    if (z < MIN) z = MIN;
    if (z > MAX) z = MAX;
    z = Math.round(z * 100) / 100;
    try { localStorage.setItem(LLAVE, z); } catch (e) {}
    aplicar(z);
  }

  function reiniciar() {
    try { localStorage.setItem(LLAVE, 1); } catch (e) {}
    aplicar(1);
  }

  function zoom() {
    if (document.getElementById('em-zoom')) return;

    var css = document.createElement('style');
    css.textContent =
      '#em-zoom{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));' +
        'z-index:9000;display:flex;flex-direction:column;gap:4px;padding:5px;border-radius:16px;' +
        'background:rgba(13,17,23,.92);border:1px solid #30363d;backdrop-filter:blur(8px);' +
        'box-shadow:0 8px 24px rgba(0,0,0,.45);user-select:none;-webkit-user-select:none}' +
      '#em-zoom button{width:40px;height:40px;border:0;border-radius:11px;cursor:pointer;' +
        'background:rgba(31,111,235,.18);color:#58a6ff;font-size:21px;font-weight:700;' +
        'line-height:1;display:flex;align-items:center;justify-content:center;font-family:inherit}' +
      '#em-zoom button:hover{background:rgba(31,111,235,.32)}' +
      '#em-zoom .pct{width:40px;text-align:center;font-size:10.5px;color:#7d8590;font-weight:700;' +
        'cursor:pointer;padding:3px 0}' +
      '@media print{#em-zoom{display:none}}';
    document.head.appendChild(css);

    var caja = document.createElement('div');
    caja.id = 'em-zoom';
    caja.innerHTML =
      '<button type="button" id="em-zoom-mas" title="Agrandar" aria-label="Agrandar">+</button>' +
      '<div class="pct" id="em-zoom-pct" title="Volver a 100%">100%</div>' +
      '<button type="button" id="em-zoom-menos" title="Achicar" aria-label="Achicar">&minus;</button>';
    document.body.appendChild(caja);

    document.getElementById('em-zoom-mas').onclick   = function () { cambiar(0.1); };
    document.getElementById('em-zoom-menos').onclick = function () { cambiar(-0.1); };
    document.getElementById('em-zoom-pct').onclick   = reiniciar;

    aplicar(leer());
  }

  function iniciar() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', zoom);
    } else {
      zoom();
    }
  }

  return { iniciar: iniciar, zoom: zoom, aplicar: aplicar };
})();

EMUI.iniciar();
