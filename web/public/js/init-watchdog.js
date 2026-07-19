/**
 * حارس تهيئة مستقل (non-module, يُحمَّل قبل app.js).
 *
 * المشكلة التي يعالجها: خطأ ربط وحدات (مثل استيراد اسم غير مُصدَّر) في app.js أو أي
 * وحدة يستوردها يمنع تنفيذ الملف بأكمله — بلا أي رسالة للمستخدم وأحياناً بلا أي خطأ
 * ظاهر في الـ console (شوهد فعلياً 2026-07-15). بما أن هذا يحدث في import.meta وقت
 * الربط، لا يمكن التقاطه بـ try/catch عادي داخل app.js لأن app.js نفسه لا يُنفَّذ.
 * الحل: عدّاد مستقل — إن لم يُبلِّغ app.js عن اكتمال التحميل خلال مهلة معقولة، نعرض
 * شاشة خطأ صريحة بدل شاشة بيضاء صامتة.
 */
(function () {
  var BOOT_TIMEOUT_MS = 8000;
  window.__qararEarlyErrors = window.__qararEarlyErrors || [];

  window.addEventListener('error', function (e) {
    var msg = (e && e.message) || 'خطأ غير معروف';
    if (e && e.filename) msg += ' — ' + e.filename + ':' + e.lineno;
    window.__qararEarlyErrors.push(msg);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var reason = e && e.reason && e.reason.message ? e.reason.message : String((e && e.reason) || '');
    window.__qararEarlyErrors.push(reason);
  });

  function showFallback() {
    if (window.__qararAppBooted) return;
    if (document.getElementById('qararInitFallback')) return;

    var box = document.createElement('div');
    box.id = 'qararInitFallback';
    box.setAttribute('role', 'alert');
    box.style.cssText =
      'position:fixed;inset:0;z-index:999999;background:#faf8f3;color:#1a1a1a;' +
      'display:flex;align-items:center;justify-content:center;padding:24px;' +
      'font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;direction:rtl;text-align:center;';

    var errs = window.__qararEarlyErrors.slice(0, 5).map(function (m) {
      var safe = String(m).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return '<div style="font-size:12px;color:#7a2f2f;background:#fdf0f0;border-radius:6px;' +
        'padding:6px 10px;margin-top:6px;text-align:left;direction:ltr;overflow-wrap:anywhere;">' + safe + '</div>';
    }).join('');

    box.innerHTML =
      '<div style="max-width:480px;background:#fff;border:1px solid #e5e0d5;border-radius:16px;' +
      'padding:32px;box-shadow:0 10px 40px rgba(0,0,0,.08);">' +
      '<div style="font-size:40px;margin-bottom:8px;">⚠️</div>' +
      '<h1 style="font-size:20px;margin:0 0 8px;">تعذّر تحميل المنصة</h1>' +
      '<p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 16px;">' +
      'حدث خطأ تقني أثناء تشغيل التطبيق. بياناتك المحفوظة سابقاً بأمان ولم تتأثر. ' +
      'جرّب تحديث الصفحة — إذا تكررت المشكلة تواصل مع الدعم.</p>' +
      '<button id="qararReloadBtn" style="background:#0f5132;color:#fff;border:none;border-radius:10px;' +
      'padding:10px 22px;font-size:14px;cursor:pointer;">تحديث الصفحة</button>' +
      (errs ? '<div style="margin-top:16px;text-align:right;">' + errs + '</div>' : '') +
      '</div>';

    document.body.appendChild(box);
    var btn = document.getElementById('qararReloadBtn');
    if (btn) btn.addEventListener('click', function () { location.reload(); });
  }

  window.__qararShowInitFallback = showFallback;
  setTimeout(showFallback, BOOT_TIMEOUT_MS);
})();
