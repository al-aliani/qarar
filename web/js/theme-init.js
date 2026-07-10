/**
 * Theme init: dark | light | auto. Runs before app so FOUC is minimized.
 * No inline scripts required — enables stricter CSP (no 'unsafe-inline' for script-src).
 */
(function () {
  function getEffectiveTheme(stored) {
    if (stored === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return stored === 'light' ? 'light' : 'dark';
  }
  function applyTheme(stored) {
    var effective = getEffectiveTheme(stored);
    document.documentElement.setAttribute('data-theme', effective);
    return effective;
  }
  function syncIcon(btn, stored) {
    if (!btn) return;
    var di = btn.querySelector('[data-theme-icon="dark"]');
    var li = btn.querySelector('[data-theme-icon="light"]');
    var ai = btn.querySelector('[data-theme-icon="auto"]');
    if (stored === 'auto') {
      if (di) di.style.display = 'none';
      if (li) li.style.display = 'none';
      if (ai) ai.style.display = 'inline';
    } else {
      if (di) di.style.display = stored === 'dark' ? 'inline' : 'none';
      if (li) li.style.display = stored === 'light' ? 'inline' : 'none';
      if (ai) ai.style.display = 'none';
    }
  }
  var stored = localStorage.getItem('feas_theme') || 'light';
  applyTheme(stored);
  function syncAllThemeIcons(stored) {
    document.querySelectorAll('#btnThemeToggle, #headerThemeToggle, #dvThemeToggle').forEach(function (b) {
      if (b) syncIcon(b, stored);
    });
  }
  window.addEventListener('DOMContentLoaded', function () {
    syncAllThemeIcons(stored);
    function onThemeCycle() {
      var current = localStorage.getItem('feas_theme') || 'light';
      // Keep auto supported for backward compatibility, but cycle light <-> dark only
      if (current === 'auto') current = getEffectiveTheme('auto');
      var next = current === 'light' ? 'dark' : 'light';
      localStorage.setItem('feas_theme', next);
      applyTheme(next);
      syncAllThemeIcons(next);
    }
    var btn = document.getElementById('btnThemeToggle');
    if (btn) btn.addEventListener('click', onThemeCycle);
    var headerBtn = document.getElementById('headerThemeToggle');
    if (headerBtn) headerBtn.addEventListener('click', onThemeCycle);
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', function () {
      var s = localStorage.getItem('feas_theme');
      if (s === 'auto') { applyTheme('auto'); syncAllThemeIcons('auto'); }
    });
  });
})();
