// ⭐ MOVIMIENTO CONTINUO - Reloj en tiempo real
function updateLiveTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('es-MX', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  });
  
  const timeElement = document.getElementById('live-time');
  if (timeElement) {
    timeElement.textContent = timeString;
  }
}

setInterval(updateLiveTime, 1000);
updateLiveTime();

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const module = item.dataset.module;
      if (module === 'dashboard') {
        closeModulePopup();
        loadDashboard();
      } else {
        openModule(module);
      }
      
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.currentModule) {
      closeModulePopup();
    }
  });

  window.addEventListener('popstate', () => {
    if (window.currentModule) {
      closeModulePopup();
    }
  });
}

function enviarReporteWhatsApp() {
  const btn = document.getElementById('btn-whatsapp-reporte');
  
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 18px;"></i> <span>Enviando...</span>';
  btn.style.background = 'linear-gradient(135deg, #1E8449, #145A32)';
  
  google.script.run
    .withSuccessHandler(function(result) {
      if (result.ok) {
        btn.innerHTML = '<i class="fas fa-check" style="font-size: 18px;"></i> <span>¡Enviado!</span>';
        btn.style.background = 'linear-gradient(135deg, #10B981, #059669)';
        if (typeof mostrarNotificacion === 'function') {
          mostrarNotificacion('success', '📱 Reporte enviado por WhatsApp');
        }
      } else {
        btn.innerHTML = '<i class="fas fa-times" style="font-size: 18px;"></i> <span>Error</span>';
        btn.style.background = 'linear-gradient(135deg, #EF4444, #DC2626)';
        if (typeof mostrarNotificacion === 'function') {
          mostrarNotificacion('error', '❌ Error: ' + result.message);
        }
      }
      setTimeout(function() {
        btn.disabled = false;
        btn.innerHTML = '<i class="fab fa-whatsapp" style="font-size: 18px;"></i> <span>Enviar Reporte WhatsApp</span>';
        btn.style.background = 'linear-gradient(135deg, #25D366, #128C7E)';
      }, 3000);
    })
    .withFailureHandler(function(error) {
      btn.innerHTML = '<i class="fas fa-times" style="font-size: 18px;"></i> <span>Error</span>';
      btn.style.background = 'linear-gradient(135deg, #EF4444, #DC2626)';
      if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion('error', '❌ Error: ' + error.message);
      }
      setTimeout(function() {
        btn.disabled = false;
        btn.innerHTML = '<i class="fab fa-whatsapp" style="font-size: 18px;"></i> <span>Enviar Reporte WhatsApp</span>';
        btn.style.background = 'linear-gradient(135deg, #25D366, #128C7E)';
      }, 3000);
    })
    .enviarReporteWhatsAppDesdeWeb();
}

// ============================================================================
// AUTO-REFRESH cada 5 minutos
// ============================================================================
// Simula el click del botón "Refrescar" del sidebar (el que llama
// loadCurrentModule) cada 5 minutos reales, en la ventana 7:30 AM → 4:45 PM.
// El usuario deja la app abierta y los datos se actualizan solos.
//
// Estrategia: setInterval cada 5 min reales desde que se abre la app.
// El backend GAS corre el control cada 15 min — al refrescar cada 5 min,
// nunca pasarás más de 5 min sin ver los datos más recientes.

(function() {
  const INTERVALO_MS = 5 * 60 * 1000; // 5 minutos
  const INICIO_MIN = 7 * 60 + 30;   // 7:30 AM
  const FIN_MIN    = 16 * 60 + 45;  // 4:45 PM

  function _enVentana() {
    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    return minutosAhora >= INICIO_MIN && minutosAhora <= FIN_MIN;
  }

  function _autoRefresh() {
    if (!_enVentana()) {
      console.log('[AUTO-REFRESH] Fuera de ventana, omitido (' + new Date().toLocaleTimeString() + ')');
      return;
    }

    console.log('[AUTO-REFRESH] 🔄 Refrescando vista (' + new Date().toLocaleTimeString() + ')');

    // Simular click en el botón Refrescar de la topbar
    if (typeof loadCurrentModule === 'function') {
      try { loadCurrentModule(); } catch (e) { console.warn('[AUTO-REFRESH] error:', e); }
    } else if (typeof loadDashboard === 'function') {
      try { loadDashboard(true); } catch (e) { console.warn('[AUTO-REFRESH] error fallback:', e); }
    } else {
      console.warn('[AUTO-REFRESH] loadCurrentModule no disponible');
    }
  }

  setInterval(_autoRefresh, INTERVALO_MS);
  console.log('[AUTO-REFRESH] ✅ Activado · cada 5 min · ventana 7:30 AM → 4:45 PM');
  console.log('[AUTO-REFRESH] Próximo refresh: ' + new Date(Date.now() + INTERVALO_MS).toLocaleTimeString());
})();
