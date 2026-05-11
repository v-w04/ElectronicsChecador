/**
 * api.js — Reemplaza google.script.run con fetch al endpoint de GAS
 * API: google.script.run.withSuccessHandler(fn).withFailureHandler(fn).miFuncion(args)
 */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz-yPy4aE1bqmNzAy6I4MIZRycIrTWaju-3xa7gk1nG1oLLgLP3YQCKPeY21SKzOX1N/exec';

(function () {
  window.google = window.google || {};
  window.google.script = window.google.script || {};

  function call(fnName, args, successCb, failureCb) {
    fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ fn: fnName, args: args }),
      redirect: 'follow'
    })
    .then(function(r) { return r.text(); })
    .then(function(text) {
      var data;
      try { data = JSON.parse(text); }
      catch(e) { data = { error: true, message: 'Parse error: ' + text.substring(0, 200) }; }
      if (successCb) successCb(data);
    })
    .catch(function(e) {
      if (failureCb) failureCb(e);
      else console.error('[GAS] ' + fnName + ':', e.message);
    });
  }

  function makeRunner(successCb, failureCb) {
    var obj = {
      withSuccessHandler: function(fn) {
        return makeRunner(fn, failureCb);
      },
      withFailureHandler: function(fn) {
        return makeRunner(successCb, fn);
      }
    };
    return new Proxy(obj, {
      get: function(target, prop) {
        if (prop in target) return target[prop];
        return function() {
          call(prop, Array.prototype.slice.call(arguments), successCb, failureCb);
        };
      }
    });
  }

  window.google.script.run = makeRunner(null, null);

  console.log('[api.js] google.script.run listo → ' + GAS_URL);
})();
