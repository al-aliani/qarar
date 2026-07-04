/**
 * Service Worker registration. Separate file to avoid inline scripts and allow stricter CSP.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
