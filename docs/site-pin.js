/* ============================================================================
   CANDADO DEL CHECADOR DEL SITE
   ============================================================================
   Desde un celular, una tablet o el navegador, nadie debe poder abrir el
   checador del site. La pestaña se sigue viendo, pero al tocarla pide un PIN
   de 3 dígitos.

   CÓMO SE COMPORTA
     · Se toca la pestaña  → sale un teclado con tres casillas.
     · No se toca nada     → a los 3 segundos se cierra solo. Eso es para el
                             que le dio por accidente: no tiene que hacer
                             nada, se quita.
     · Se empieza a teclear → la cuenta regresiva SE CANCELA. Tres segundos
                             alcanzan para quitar un accidente, no para
                             teclear un PIN en un celular.
     · PIN correcto        → este aparato queda autorizado y de ahí en
                             adelante entra y sale sin volver a teclearlo.
     · PIN incorrecto      → no pasa nada y no se guarda el aparato.

   POR QUÉ EL TECLADO ES NUESTRO Y NO UN <input>
   Un input levanta el teclado del sistema, que en iPhone tarda en subir y se
   come media pantalla. Con botones son tres toques y se acabó.

   QUÉ PROTEGE Y QUÉ NO — sin adornos
   Esto es un candado contra entradas por accidente y contra el curioso con
   su celular. NO es seguridad de verdad: quien ya tenga la dirección
   guardada en su navegador la puede abrir sin pasar por aquí. Lo que sí se
   ganó es que la dirección ya no se reparte sola: antes viajaba a cualquiera
   que abriera la app, y ahora el servidor solo la entrega contra el PIN.

   El PIN vive en las propiedades del proyecto de Apps Script, nunca aquí:
   este archivo está en un repo público.
   ========================================================================== */

var SitePin = (function () {

  var LS_PIN  = 'em_site_pin';      // el PIN que ya sirvió en este aparato
  var LS_VIEJO = 'em_checar_site';  // aquí se guardaba la dirección. Ya no.
  var SEGUNDOS = 3;

  var _gas = null, _boton = null, _capa = null, _tecleado = '';

  /* --- el boton de QR ---------------------------------------------------
     Es un QR generico dibujado a mano, no una imagen: asi hereda el color
     del tema (checar es oscuro, juegos es claro) y no hay archivo que
     bajar ni que cachear. Los tres cuadros de las esquinas y unos modulos
     sueltos bastan para que se lea como QR de un vistazo. */
  var QR_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      // los tres ojos
      '<rect x="2"  y="2"  width="7" height="7" rx="1.4"/>' +
      '<rect x="15" y="2"  width="7" height="7" rx="1.4"/>' +
      '<rect x="2"  y="15" width="7" height="7" rx="1.4"/>' +
      '<rect class="n" x="4.3"  y="4.3"  width="2.4" height="2.4" rx=".5"/>' +
      '<rect class="n" x="17.3" y="4.3"  width="2.4" height="2.4" rx=".5"/>' +
      '<rect class="n" x="4.3"  y="17.3" width="2.4" height="2.4" rx=".5"/>' +
      // Los modulos van sobre una rejilla de 3.4, como en un QR de
      // verdad: sueltos y a ojo se notaba que no cuadraban.
      // marcas de tiempo (las dos franjas entre los ojos)
      '<rect class="n" x="11.4" y="2"    width="2.2" height="2.2" rx=".5"/>' +
      '<rect class="n" x="11.4" y="6.8"  width="2.2" height="2.2" rx=".5"/>' +
      '<rect class="n" x="2"    y="11.4" width="2.2" height="2.2" rx=".5"/>' +
      '<rect class="n" x="6.8"  y="11.4" width="2.2" height="2.2" rx=".5"/>' +
      // el cuadrante de datos, abajo a la derecha
      '<rect class="n" x="11.4" y="11.4" width="2.2" height="2.2" rx=".5"/>' +
      '<rect class="n" x="18.2" y="11.4" width="2.2" height="2.2" rx=".5"/>' +
      '<rect class="n" x="11.4" y="14.8" width="2.2" height="2.2" rx=".5"/>' +
      '<rect class="n" x="14.8" y="14.8" width="2.2" height="2.2" rx=".5"/>' +
      '<rect class="n" x="18.2" y="14.8" width="2.2" height="2.2" rx=".5"/>' +
      '<rect class="n" x="11.4" y="18.2" width="2.2" height="2.2" rx=".5"/>' +
      '<rect class="n" x="18.2" y="18.2" width="2.2" height="2.2" rx=".5"/>' +
    '</svg>';
  var _reloj = null, _quedan = SEGUNDOS;

  /* --- lo guardado en este aparato ------------------------------------- */
  function pinGuardado() {
    try { return localStorage.getItem(LS_PIN) || ''; } catch (e) { return ''; }
  }
  function guardarPin(p) {
    try { localStorage.setItem(LS_PIN, p); } catch (e) {}
  }
  function olvidarPin() {
    try { localStorage.removeItem(LS_PIN); } catch (e) {}
  }

  /* --- estilos, una sola vez -------------------------------------------- */
  function estilos() {
    if (document.getElementById('site-pin-css')) return;
    var st = document.createElement('style');
    st.id = 'site-pin-css';
    st.textContent =
      '#site-pin{position:fixed;inset:0;z-index:200;display:none;' +
        'align-items:center;justify-content:center;padding:20px;' +
        'background:rgba(1,4,9,.86);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);' +
        'font-family:inherit}' +
      '#site-pin.ver{display:flex}' +
      '#site-pin .caja{width:100%;max-width:330px;background:#161b22;color:#e6edf3;' +
        'border:1px solid #30363d;border-radius:22px;padding:24px 22px 20px;text-align:center;' +
        'box-shadow:0 24px 60px rgba(0,0,0,.6)}' +
      '#site-pin h3{margin:0 0 4px;font-size:19px;font-weight:800;letter-spacing:-.02em}' +
      '#site-pin .pie{margin:0 0 18px;font-size:13px;color:#8b949e;line-height:1.4}' +
      '#site-pin .puntos{display:flex;gap:12px;justify-content:center;margin-bottom:6px}' +
      '#site-pin .pt{width:48px;height:56px;border-radius:14px;background:#0d1117;' +
        'border:1px solid #30363d;display:flex;align-items:center;justify-content:center;' +
        'font-size:26px;font-weight:800;color:#e6edf3}' +
      '#site-pin .pt.lleno{border-color:#1f6feb;background:rgba(31,111,235,.14)}' +
      '#site-pin .pt.mal{border-color:#f85149;background:rgba(248,81,73,.14);color:#f85149}' +
      '#site-pin .cuenta{margin:10px 0 14px;font-size:12.5px;color:#8b949e;min-height:17px}' +
      '#site-pin .teclas{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}' +
      '#site-pin .teclas button{border:1px solid #30363d;background:#0d1117;color:#e6edf3;' +
        'border-radius:14px;padding:15px 0;font-size:21px;font-weight:700;cursor:pointer;' +
        'font-family:inherit;-webkit-tap-highlight-color:transparent}' +
      '#site-pin .teclas button:active{background:#1f6feb;border-color:#1f6feb}' +
      '#site-pin .teclas .chico{font-size:14px;font-weight:600;color:#8b949e}' +
      '#site-pin .abrir{margin-top:14px;width:100%;border:0;border-radius:14px;padding:15px;' +
        'background:#238636;color:#fff;font-size:15.5px;font-weight:800;cursor:pointer;' +
        'font-family:inherit;display:none}' +
      '#site-pin .abrir.ver{display:block}' +

      /* El boton de QR. Hereda currentColor, asi que se ve bien en la
         pantalla oscura y en la clara sin dos juegos de reglas. */
      '.site-qr{margin-left:auto;flex:0 0 auto;display:inline-flex;' +
        'align-items:center;justify-content:center;gap:7px;' +
        'padding:9px 15px;min-height:40px;' +
        'border:1px solid currentColor;border-radius:999px;background:transparent;' +
        'color:inherit;opacity:.7;cursor:pointer;text-decoration:none;' +
        'font-family:inherit;font-size:14px;font-weight:700;letter-spacing:-.01em;' +
        'line-height:1;white-space:nowrap;' +
        '-webkit-tap-highlight-color:transparent;' +
        'transition:opacity .15s ease,transform .1s ease}' +
      '.site-qr svg{width:19px;height:19px;display:block;flex:0 0 auto;fill:currentColor}' +
      '.site-qr svg rect{fill:none;stroke:currentColor;stroke-width:1.7}' +
      '.site-qr svg rect.n{fill:currentColor;stroke:none}' +
      '.site-qr:hover,.site-qr:focus-visible{opacity:1}' +
      '.site-qr:active{transform:scale(.93)}' +
      /* la nav le pone una flechita a las ligas de fuera; aqui estorba */
      '.site-qr::after{content:none}' +
      /* Guarda su lugar mientras no se sabe si hay liga: si no, aparecia
         dos segundos despues de cargar y reacomodaba la barra de arriba. */
      '.site-qr[hidden]{display:inline-flex;visibility:hidden}';
    document.head.appendChild(st);
  }

  /* --- la ventanita ------------------------------------------------------ */
  function armar() {
    estilos();
    if (_capa) return;
    _capa = document.createElement('div');
    _capa.id = 'site-pin';
    _capa.innerHTML =
      '<div class="caja">' +
        '<h3>Checador del site</h3>' +
        '<p class="pie">Teclea el PIN para abrirlo en este aparato.</p>' +
        '<div class="puntos">' +
          '<div class="pt" data-i="0"></div><div class="pt" data-i="1"></div>' +
          '<div class="pt" data-i="2"></div>' +
        '</div>' +
        '<div class="cuenta" id="site-pin-cuenta"></div>' +
        '<div class="teclas" id="site-pin-teclas"></div>' +
        '<button type="button" class="abrir" id="site-pin-abrir">Abrir el checador del site</button>' +
      '</div>';
    document.body.appendChild(_capa);

    var t = _capa.querySelector('#site-pin-teclas');
    ['1','2','3','4','5','6','7','8','9','Salir','0','Borrar'].forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = v;
      if (v === 'Salir' || v === 'Borrar') b.className = 'chico';
      b.onclick = function () {
        pararCuenta();
        if (v === 'Salir')  { cerrar(); return; }
        if (v === 'Borrar') { _tecleado = _tecleado.slice(0, -1); pintar(); return; }
        if (_tecleado.length >= 3) return;
        _tecleado += v;
        pintar();
        if (_tecleado.length === 3) probar();
      };
      t.appendChild(b);
    });

    // Tocar fuera de la caja cierra. Es un candado, no una trampa.
    _capa.onclick = function (e) { if (e.target === _capa) cerrar(); };
  }

  function pintar(mal) {
    var pts = _capa.querySelectorAll('.pt');
    for (var i = 0; i < pts.length; i++) {
      pts[i].textContent = _tecleado[i] ? '●' : '';
      pts[i].className = 'pt' + (mal ? ' mal' : (_tecleado[i] ? ' lleno' : ''));
    }
  }

  /* --- la cuenta regresiva ---------------------------------------------- */
  function arrancarCuenta() {
    _quedan = SEGUNDOS;
    var c = document.getElementById('site-pin-cuenta');
    c.textContent = 'Se cierra en ' + _quedan + '…';
    _reloj = setInterval(function () {
      _quedan--;
      if (_quedan <= 0) { cerrar(); return; }
      c.textContent = 'Se cierra en ' + _quedan + '…';
    }, 1000);
  }
  function pararCuenta() {
    if (!_reloj) return;
    clearInterval(_reloj); _reloj = null;
    var c = document.getElementById('site-pin-cuenta');
    if (c) c.textContent = '';
  }

  function abrirCapa() {
    armar();
    _tecleado = '';
    pintar();
    document.getElementById('site-pin-abrir').className = 'abrir';
    _capa.querySelector('.pie').textContent = 'Teclea el PIN para abrirlo en este aparato.';
    _capa.classList.add('ver');
    arrancarCuenta();
  }
  function cerrar() {
    pararCuenta();
    if (_capa) _capa.classList.remove('ver');
    _tecleado = '';
  }

  /* --- abrir de verdad --------------------------------------------------- */
  function irA(url, ventana) {
    if (ventana && !ventana.closed) { ventana.location.href = url; return true; }
    var w = window.open(url, '_blank', 'noopener');
    return !!w;
  }

  /** Pide la direccion al servidor con ese PIN. */
  function pedirUrl(pin) {
    return _gas('abrirChecadorSite', [pin]);
  }

  function probar() {
    var pin = _tecleado;
    var c = document.getElementById('site-pin-cuenta');
    c.textContent = 'Revisando…';
    pedirUrl(pin).then(function (r) {
      if (!r || !r.ok || !r.url) {
        // Ni se guarda el aparato ni se deja pasar.
        olvidarPin();
        pintar(true);
        c.textContent = (r && r.message) || 'PIN incorrecto.';
        setTimeout(function () { _tecleado = ''; pintar(); c.textContent = ''; }, 1200);
        return;
      }
      guardarPin(pin);
      c.textContent = '';
      // Aqui ya paso una llamada al servidor, asi que el navegador puede
      // tomar el window.open como "no lo pidio la persona" y bloquearlo.
      // Si eso pasa, se le pone un boton, que si es un toque suyo.
      if (!irA(r.url)) {
        _capa.querySelector('.pie').textContent = 'Listo, este aparato ya quedo autorizado.';
        var b = document.getElementById('site-pin-abrir');
        b.className = 'abrir ver';
        b.onclick = function () { irA(r.url); cerrar(); };
      } else {
        cerrar();
      }
    }).catch(function () {
      c.textContent = 'Sin conexion con el servidor.';
    });
  }

  /* --- lo que llama la pagina -------------------------------------------- */

  /**
   * @param {function(string,Array):Promise} gas  la funcion gas() de la pagina
   * @param {string} idBoton  id de la pestana "Checador del site"
   */
  function iniciar(gas, idBoton) {
    _gas = gas;
    _boton = document.getElementById(idBoton || 'tab-intranet');
    if (!_boton) return;

    // Los estilos van AQUI, no cuando se abre el teclado del PIN.
    // Estaban dentro de armar(), que solo corre al abrir ese teclado: el
    // boton se quedaba con la clase .site-qr y el dibujo dentro, pero SIN
    // una sola regla de CSS, asi que no se veia por ningun lado. Y para
    // abrir el teclado hay que tocar el boton... que era invisible.
    estilos();

    // La direccion se guardaba en el aparato. Con eso el candado no servia
    // de nada en los celulares que ya la tenian, asi que se borra.
    try { localStorage.removeItem(LS_VIEJO); } catch (e) {}

    // De pestaña de texto a botón de QR. Se hace aquí y no en el HTML para
    // que las dos pantallas queden iguales sin repetir el dibujo en cada una.
    _boton.removeAttribute('href');
    _boton.removeAttribute('target');
    _boton.removeAttribute('rel');
    _boton.classList.remove('fuera');
    _boton.classList.add('site-qr');
    _boton.setAttribute('role', 'button');
    _boton.setAttribute('tabindex', '0');
    _boton.setAttribute('title', 'Checador del site');
    _boton.setAttribute('aria-label', 'Checador del site');
    // Antes era solo el dibujo del QR a 36px: en el celular se veía
    // minúsculo y en la tablet ni se encontraba. Ahora dice "Site" — una
    // palabra se lee a cualquier tamaño y en cualquier pantalla.
    _boton.innerHTML = QR_SVG + '<span>Site</span>';
    _boton.onkeydown = function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _boton.onclick(e); }
    };
    _boton.onclick = function (e) {
      e.preventDefault();
      var pin = pinGuardado();
      if (!pin) { abrirCapa(); return; }

      // Aparato ya autorizado: se abre la ventana AHORA, con el toque
      // todavia caliente, y se le pone la direccion cuando llegue.
      var w = window.open('', '_blank');
      pedirUrl(pin).then(function (r) {
        if (r && r.ok && r.url) { irA(r.url, w); return; }
        // Le cambiaron el PIN: este aparato deja de estar autorizado.
        if (w && !w.closed) w.close();
        olvidarPin();
        abrirCapa();
      }).catch(function () {
        if (w && !w.closed) w.close();
      });
    };
  }

  /** Muestra u oculta la pestana. Ahora el servidor solo dice si hay liga. */
  function mostrar(hay) {
    if (!_boton) return;
    _boton.hidden = !hay;
  }

  return { iniciar: iniciar, mostrar: mostrar, olvidar: olvidarPin };
})();
