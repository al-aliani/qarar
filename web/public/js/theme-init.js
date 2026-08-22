/**
 * الوضع الداكن أُزيل من الموقع بقرار مالك (2026-08-22) — فاتح دائماً بلا استثناء،
 * بما فيه أي زائر عنده تفضيل "داكن" محفوظ من قبل هذا القرار.
 * الملف يبقى موجوداً فقط لأن عشرات صفحات HTML بالموقع تحمّله عبر <script src> —
 * حذف الملف يكسر تلك الوسوم. لا حاجة لمنطق آخر: :root في variables.css فاتح
 * افتراضياً، وبلا data-theme="dark" لن تُطبَّق أي قاعدة [data-theme="dark"] إطلاقاً.
 */
(function () {
  document.documentElement.setAttribute('data-theme', 'light');
  try { localStorage.removeItem('feas_theme'); } catch (_) { /* تجاهل بيئات بلا localStorage */ }
})();
