// === Theme Toggle Logic ===
(function() {
  const THEME_KEY = 'zeropen_theme';
  const toggleBtn = document.getElementById('theme-toggle');
  const darkIcon = document.getElementById('theme-icon-dark');
  const lightIcon = document.getElementById('theme-icon-light');
  // Load saved theme
  function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(saved);
  }
  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light');
      darkIcon.style.display = 'none';
      lightIcon.style.display = 'block';
      // Update Monaco if it exists
      if (window.monacoEditor) {
        window.monacoEditor.updateOptions({ theme: 'vs' });
      }
    } else {
      document.body.classList.remove('light');
      darkIcon.style.display = 'block';
      lightIcon.style.display = 'none';
      if (window.monacoEditor) {
        window.monacoEditor.updateOptions({ theme: 'vs-dark' });
      }
    }
    localStorage.setItem(THEME_KEY, theme);
  }
  function toggleTheme() {
    const current = localStorage.getItem(THEME_KEY) || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }
  toggleBtn.addEventListener('click', toggleTheme);
  // Apply on load
  loadTheme();
  // Expose for editor.js to update Monaco when it initializes
  window.getCurrentTheme = function() {
    return localStorage.getItem(THEME_KEY) || 'dark';
  };
})();
