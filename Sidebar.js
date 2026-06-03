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
    if (e.key === 'Escape' && currentModule) {
      closeModulePopup();
    }
  });

  window.addEventListener('popstate', () => {
    if (currentModule) {
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
// AUTO-REFRESH cada 15 minutos en ventana 7:30 AM → 4:45 PM
// ============================================================================
// Refresca el dashboard automáticamente (equivalente a darle al botón Refrescar)
// para que los datos siempre reflejen lo que el control de asistencia acaba
// de procesar — sin que el usuario tenga que tocar nada.
//
// La verificación se hace cada minuto y compara contra los minutos
// múltiplos de 15 (00, 15, 30, 45). En esas horas, llama loadCurrentModule()
// que internamente decide si recargar el dashboard o el módulo abierto.

(function() {
  // Configuración de ventana
  const INICIO_MIN = 7 * 60 + 30;   // 7:30 AM
  const FIN_MIN    = 16 * 60 + 45;  // 4:45 PM
  let ultimoRefreshMin = -1;

  function _esHorarioRefresh() {
    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

    // ¿Estamos dentro de la ventana?
    if (minutosAhora < INICIO_MIN || minutosAhora > FIN_MIN) return false;

    // ¿Es múltiplo de 15? Solo en :00, :15, :30, :45
    if (ahora.getMinutes() % 15 !== 0) return false;

    // ¿Ya refrescamos este minuto exacto? (evita doble disparo si el timer fue impreciso)
    const claveMinuto = ahora.getHours() * 60 + ahora.getMinutes();
    if (claveMinuto === ultimoRefreshMin) return false;
    ultimoRefreshMin = claveMinuto;

    return true;
  }

  function _autoRefresh() {
    if (!_esHorarioRefresh()) return;

    console.log('[AUTO-REFRESH] Recargando vista a las ' + new Date().toLocaleTimeString());

    // Llama loadCurrentModule si existe (recarga módulo abierto o dashboard)
    if (typeof loadCurrentModule === 'function') {
      try { loadCurrentModule(); } catch (e) { console.warn('[AUTO-REFRESH] error:', e); }
    } else if (typeof loadDashboard === 'function') {
      // Fallback: si por alguna razón loadCurrentModule no existe, recarga dashboard
      try { loadDashboard(true); } catch (e) { console.warn('[AUTO-REFRESH] error fallback:', e); }
    }
  }

  // Revisar cada minuto si toca refrescar
  setInterval(_autoRefresh, 60 * 1000);
  console.log('[AUTO-REFRESH] Activo · ventana 7:30 AM → 4:45 PM · cada 15 min');
})();