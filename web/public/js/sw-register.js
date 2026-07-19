/**
 * Service Worker registration. Separate file to avoid inline scripts and allow stricter CSP.
 *
 * تدقيق 2026-07-10: كان يُسجَّل بلا شرط حتى على localhost. خادم Vite في وضع التطوير
 * يرسل كل ملف مستورَد كطلب HTTP منفصل (مئات الطلبات لصفحة واحدة في مشروع بهذا الحجم)،
 * والـService Worker يعترض كل واحد منها (fetch + cache.put) — يضيف بطئاً حقيقياً محسوساً،
 * وأي Service Worker مسجَّل من جلسة تطوير سابقة يبقى يعمل في المتصفح حتى بعد تغييرات
 * كبيرة في الكود لاحقاً، فيبدو الموقع "بطيئاً لا يفتح". لا داعي له إطلاقاً محلياً
 * (لا فائدة أوفلاين تُختبَر أثناء التطوير) — يُسجَّل فقط خارج localhost، ويُزال أي
 * تسجيل قديم عالق محلياً تلقائياً.
 */
var isLocalDev = ['localhost', '127.0.0.1', '[::1]'].indexOf(location.hostname) !== -1;

if ('serviceWorker' in navigator) {
  if (isLocalDev) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (reg) { reg.unregister(); });
    }).catch(function () {});
  } else {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
}
