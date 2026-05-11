function toggleGirlyMode() {
  document.body.classList.toggle('girly-mode');
  localStorage.setItem('theme', document.body.classList.contains('girly-mode') ? 'girly' : 'default');
  if (window.tendenciaChart) {
    const isGirlyMode = document.body.classList.contains('girly-mode');
    window.tendenciaChart.data.datasets[0].borderColor      = isGirlyMode ? '#BA8FFF' : '#3B82F6';
    window.tendenciaChart.data.datasets[0].backgroundColor  = isGirlyMode ? 'rgba(186,143,255,0.15)' : 'rgba(59,130,246,0.1)';
    window.tendenciaChart.data.datasets[0].pointBackgroundColor = isGirlyMode ? '#DB7093' : '#3B82F6';
    window.tendenciaChart.data.datasets[0].pointBorderColor     = isGirlyMode ? '#BA8FFF' : '#3B82F6';
    window.tendenciaChart.update();
  }
}