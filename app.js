(() => {
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
  const themeButton = document.getElementById('themeButton');
  if (themeButton) themeButton.addEventListener('click', () => {
    document.body.classList.toggle('high-contrast');
    const enabled = document.body.classList.contains('high-contrast');
    themeButton.setAttribute('aria-pressed', String(enabled));
    themeButton.title = enabled ? 'Return to standard contrast' : 'Enable high contrast';
  });
})();
