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
