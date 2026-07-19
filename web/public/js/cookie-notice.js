/**
 * إشعار كوكيز بسيط — غير إلزامي بنظام حماية البيانات السعودي (PDPL) لكنه تحسين
 * ثقة (الموقع يستخدم reCAPTCHA عند الدخول/التسجيل، انظر js/utils/captcha.js، وهو
 * يضع كوكيز من google.com). يظهر مرة واحدة لكل زائر فقط (localStorage).
 */
(function () {
  var KEY = 'qarar_cookie_notice_dismissed';
  if (localStorage.getItem(KEY) === '1') return;

  function inject() {
    var bar = document.createElement('div');
    bar.id = 'cookieNoticeBar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'إشعار الكوكيز');
    bar.style.cssText = 'position:fixed;inset-inline:0;bottom:0;z-index:9999;'
      + 'background:var(--c-bg-card,#fdfcf9);color:var(--c-text-main,#1c2420);'
      + 'border-top:1px solid var(--c-border,rgba(0,0,0,.14));'
      + 'padding:12px 16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:center;'
      + 'font-size:.85rem;box-shadow:0 -4px 16px rgba(0,0,0,.08);';
    bar.innerHTML = '<span>نستخدم كوكيز أساسية لتأمين تسجيل الدخول (reCAPTCHA). بمتابعة تصفح الموقع فأنت توافق على ذلك. '
      + '<a href="./privacy.html" style="color:var(--c-p-500,#0e5b44);font-weight:700">سياسة الخصوصية</a></span>'
      + '<button type="button" id="cookieNoticeOk" style="background:var(--c-p-500,#0e5b44);color:#fff;border:0;'
      + 'border-radius:8px;padding:6px 16px;font-size:.85rem;cursor:pointer;">حسناً</button>';
    document.body.appendChild(bar);
    document.getElementById('cookieNoticeOk').addEventListener('click', function () {
      localStorage.setItem(KEY, '1');
      bar.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
