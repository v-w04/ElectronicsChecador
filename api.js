/**
 * api.js — Reemplaza google.script.run con fetch al endpoint de GAS
 * Mantiene exactamente la misma API:
 *   google.script.run.withSuccessHandler(fn).miFuncion(args)
 */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz-yPy4aE1bqmNzAy6I4MIZRycIrTWaju-3xa7gk1nG1oLLgLP3YQCKPeY21SKzOX1N/exec';

(function () {
  window.google = window.google || {};
  window.google.script = window.google.script || {};

  function GasRunner() {
    this._success = null;
    this._failure = null;
  }

  GasRunner.prototype.withSuccessHandler = function (fn) {
    this._success = fn;
    return this._prx();
  };

  GasRunner.prototype.withFailureHandler = function (fn) {
    this._failure = fn;
    return this._prx();
  };

  GasRunner.prototype._exec = function (fnName, args) {
    var self = this;
    fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ fn: fnName, args: args }),
      redirect: 'follow'
    })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (d) { if (self._success) self._success(d); })
    .catch(function (e) {
      if (self._failure) self._failure(e);
      else console.error('[GAS] Error en ' + fnName + ':', e.message);
    });
  };

  GasRunner.prototype._prx = function () {
    var self = this;
    return new Proxy(self, {
      get: function (t, p) {
        if (p in t) return typeof t[p] === 'function' ? t[p].bind(t) : t[p];
        return function () { t._exec(p, Array.prototype.slice.call(arguments)); };
      }
    });
  };

  window.google.script.run = new Proxy({}, {
    get: function (_, p) {
      var r = new GasRunner();
      if (p === 'withSuccessHandler') return r.withSuccessHandler.bind(r);
      if (p === 'withFailureHandler') return r.withFailureHandler.bind(r);
      return function () { r._exec(p, Array.prototype.slice.call(arguments)); };
    }
  });

  console.log('[api.js] google.script.run listo → ' + GAS_URL);
})();
