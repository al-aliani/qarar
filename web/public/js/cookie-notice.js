/**
 * إشعار موافقة الكوكيز — تدقيق 2026-08-22: كان زراً واحداً ("حسناً") لا يمثّل موافقة
 * حقيقية (لا يمنع أي تحميل)، وكان Sentry/التحليلات (js/utils/monitoring.js وanalytics.js)
 * يعملان تلقائياً بلا شرط. الآن يعرض خيارين حقيقيين — "موافق"/"رفض" — والقرار يُخزَّن
 * بمفتاح localStorage أدناه الذي يقرأه js/utils/cookieConsent.js قبل أي اتصال خارجي فعلي
 * (Sentry أو trackEvent). هذا سكربت خام غير مُجمَّع بـVite (يُخدَّم كما هو من public/) فلا
 * يقدر على استيراد تلك الوحدة — يكرّر اسم المفتاح والحدث حرفياً بدل الاستيراد. حافظ على
 * تطابقهما عند أي تعديل.
 */
(function () {
  var KEY = 'qarar_cookie_consent';
  var EVENT = 'qarar:cookie-consent';
  if (localStorage.getItem(KEY)) return; // قرار سابق (موافق أو رفض) — لا تكرار

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
    bar.innerHTML = '<span>نستخدم كوكيز أساسية لتأمين تسجيل الدخول (reCAPTCHA)، وكوكيز تحليلية اختيارية '
      + 'لتحسين الخدمة لا تُفعَّل إلا بموافقتك. '
      + '<a href="./privacy.html" style="color:var(--c-p-500,#0e5b44);font-weight:700">سياسة الخصوصية</a></span>'
      + '<span style="display:flex;gap:8px;flex-shrink:0">'
      + '<button type="button" id="cookieNoticeReject" style="background:var(--c-bg-card,#fdfcf9);'
      + 'color:var(--c-text-main,#1c2420);border:1px solid var(--c-border,rgba(0,0,0,.14));border-radius:8px;'
      + 'padding:6px 16px;font-size:.85rem;cursor:pointer;">رفض</button>'
      + '<button type="button" id="cookieNoticeAccept" style="background:var(--c-p-500,#0e5b44);color:#fff;border:0;'
      + 'border-radius:8px;padding:6px 16px;font-size:.85rem;cursor:pointer;">موافق</button>'
      + '</span>';
    document.body.appendChild(bar);

    function decide(value) {
      localStorage.setItem(KEY, value);
      bar.remove();
      // يسمح لـjs/utils/monitoring.js بتفعيل Sentry فوراً عند "موافق" بلا إعادة تحميل
      // الصفحة، إن كانت وحدة المراقبة قد حمّلت مسبقاً وانتظرت هذا الحدث.
      window.dispatchEvent(new CustomEvent(EVENT, { detail: { consent: value } }));
    }
    document.getElementById('cookieNoticeAccept').addEventListener('click', function () { decide('granted'); });
    document.getElementById('cookieNoticeReject').addEventListener('click', function () { decide('denied'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
