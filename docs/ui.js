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
    // El zoom va en el CONTENIDO, no en el body. Puesto en el body también
    // afectaba a las ventanas emergentes: como están fijas a la pantalla y
    // miden su alto en unidades de pantalla, al acercar se descuadraban a lo
    // alto y dejaban de caber. Zoomeando solo el contenido, las ventanas se
    // quedan derechas.
    var destino = document.querySelector('.wrap') || document.body;
    destino.style.zoom = z;
    if (destino !== document.body) document.body.style.zoom = '';
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
        'z-index:30;display:flex;flex-direction:column;gap:4px;padding:5px;border-radius:16px;' +
        'background:rgba(13,17,23,.92);border:1px solid #30363d;backdrop-filter:blur(8px);' +
        'box-shadow:0 8px 24px rgba(0,0,0,.45);user-select:none;-webkit-user-select:none;' +
        'transition:opacity .15s ease}' +
      '#em-zoom button{width:38px;height:38px;border:0;border-radius:11px;cursor:pointer;' +
        'background:rgba(31,111,235,.18);color:#58a6ff;font-size:20px;font-weight:700;' +
        'line-height:1;display:flex;align-items:center;justify-content:center;font-family:inherit}' +
      '#em-zoom button:hover{background:rgba(31,111,235,.32)}' +
      '#em-zoom .pct{width:38px;text-align:center;font-size:10.5px;color:#7d8590;font-weight:700;' +
        'cursor:pointer;padding:3px 0}' +
      // Mientras haya una ventana abierta encima, el zoom estorba: tapaba
      // los botones de Guardar y Cancelar. Se quita y vuelve al cerrarla.
      '#em-zoom.oculto{opacity:0;pointer-events:none}' +
      'body:has(.fondo.ver) #em-zoom{opacity:0;pointer-events:none}' +
      // Un respiro al final de la página para que el control no se siente
      // encima del último botón o del pie.
      'body::after{content:"";display:block;height:84px}' +
      '@media (max-width:700px){' +
        '#em-zoom{right:10px;bottom:calc(10px + env(safe-area-inset-bottom));padding:4px;gap:3px}' +
        '#em-zoom button{width:34px;height:34px;font-size:18px}' +
        '#em-zoom .pct{width:34px;font-size:10px}' +
      '}' +
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
    vigilarVentanas(caja);
  }

  /**
   * Respaldo del selector :has() para navegadores que no lo tienen: en
   * cuanto alguna ventana emergente se abre o se cierra, se esconde o se
   * muestra el control.
   */
  function vigilarVentanas(caja) {
    if (!window.MutationObserver) return;
    function revisar() {
      var abierta = document.querySelector('.fondo.ver');
      caja.className = abierta ? 'oculto' : '';
    }
    var obs = new MutationObserver(revisar);
    document.querySelectorAll('.fondo').forEach(function (f) {
      obs.observe(f, { attributes: true, attributeFilter: ['class'] });
    });
    revisar();
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
