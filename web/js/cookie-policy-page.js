// نقطة دخول صفحة سياسة الكوكيز (cookie-policy.html) — مُخرَجة من inline script
// كي تُطبَّق سياسة CSP صارمة (script-src 'self' بلا unsafe-inline)، بنفس سبب
// investor-page.js على صفحة أخرى.
//
// تدقيق 2026-08-27: لا سبيل لسحب موافقة/رفض الكوكيز بعد القرار الأول —
// localStorage.getItem(KEY) في public/js/cookie-notice.js يمنع إعادة
// عرض الإشعار للأبد. هذا الزر يمسح المفتاح نفسه فقط (لا بيانات الدراسة)
// ثم يعيد الزائر للرئيسية — الصفحة الوحيدة مع landing.html التي تُحمِّل
// cookie-notice.js فعلياً، فيُعاد حقن الإشعار مباشرة هناك (لا فائدة من
// إعادة تحميل هذه الصفحة نفسها، فهي لا تحمّل ذلك السكربت).
document.getElementById('cookiePrefsReset')?.addEventListener('click', function () {
  try { localStorage.removeItem('qarar_cookie_consent'); } catch (_) { /* localStorage غير متاح */ }
  window.location.href = './';
});
