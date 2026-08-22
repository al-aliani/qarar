/**
 * مصدر واحد لحالة موافقة الكوكيز/التحليلات (2026-08-22).
 * يقرأه js/utils/monitoring.js (قبل تحميل Sentry) وjs/utils/analytics.js (قبل
 * إرسال أي حدث) — لا يجوز لأي منهما الاتصال بخدمة خارجية قبل التحقق من هذا المفتاح.
 *
 * يُكتب فقط من public/js/cookie-notice.js. ذلك سكربت خام غير مُجمَّع بـVite (يُخدَّم
 * كما هو من public/) فلا يقدر على استيراد وحدة ES من js/utils/ — لذا يكرّر اسم
 * المفتاح والحدث أدناه حرفياً بدل الاستيراد. حافظ على تطابقهما عند أي تعديل هنا.
 */

export const COOKIE_CONSENT_KEY = 'qarar_cookie_consent';
export const COOKIE_CONSENT_EVENT = 'qarar:cookie-consent';

export function getCookieConsent() {
    try {
        return localStorage.getItem(COOKIE_CONSENT_KEY);
    } catch (_) {
        return null;
    }
}

export function hasAnalyticsConsent() {
    return getCookieConsent() === 'granted';
}

/**
 * يُستدعى فور ضغط الزائر "موافق" في إشعار الكوكيز — بلا انتظار إعادة تحميل الصفحة.
 * يُستخدم لتفعيل Sentry بعد تأخيره وقت التحميل الأولي.
 */
export function onAnalyticsConsentGranted(callback) {
    if (typeof window === 'undefined') return;
    window.addEventListener(COOKIE_CONSENT_EVENT, function handler(e) {
        if (e?.detail?.consent === 'granted') callback();
    });
}
