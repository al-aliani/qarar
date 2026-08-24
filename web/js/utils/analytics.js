/** Optional analytics bridge. It stays inert until the product config provides GA4/Meta. */
import { getSupabaseClient } from '../../supabaseClient.js';
import { hasAnalyticsConsent } from './cookieConsent.js';

function getSessionId() {
    try {
        let id = sessionStorage.getItem('qarar_session_id');
        if (!id) {
            id = crypto.randomUUID();
            sessionStorage.setItem('qarar_session_id', id);
        }
        return id;
    } catch (_) {
        return null;
    }
}

const ATTRIBUTION_KEY = 'qarar_first_touch_attribution';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const EXPERIMENT_PREFIX = 'qarar_experiment_';

export function getExperimentVariant(experiment, variants = ['control', 'variant']) {
    const safeName = String(experiment || '').replace(/[^a-z0-9_]/gi, '_');
    if (!safeName || !variants.length || typeof window === 'undefined') return variants[0] || 'control';
    try {
        const key = `${EXPERIMENT_PREFIX}${safeName}`;
        const saved = sessionStorage.getItem(key);
        if (saved && variants.includes(saved)) return saved;
        const selected = variants[Math.floor(Math.random() * variants.length)];
        sessionStorage.setItem(key, selected);
        return selected;
    } catch (_) {
        return variants[0] || 'control';
    }
}

function getEnvironmentParams() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return {};
    const ua = String(navigator.userAgent || '').toLowerCase();
    const browser = ua.includes('edg/') ? 'edge'
        : ua.includes('firefox/') ? 'firefox'
            : ua.includes('chrome/') ? 'chrome'
                : ua.includes('safari/') ? 'safari' : 'other';
    const device = /mobile|android|iphone|ipod/i.test(ua) ? 'mobile'
        : /tablet|ipad/i.test(ua) ? 'tablet' : 'desktop';
    let timezone = 'unknown';
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone; } catch (_) { /* optional context */ }
    return {
        device_type: device,
        browser,
        language: String(navigator.language || 'unknown').slice(0, 16),
        timezone: String(timezone).slice(0, 64),
    };
}

function getExperimentParams() {
    return { experiment_pricing_cards: getExperimentVariant('pricing_cards', ['control', 'recommended_first']) };
}

function getAttributionParams() {
    if (typeof window === 'undefined') return {};
    try {
        const query = new URLSearchParams(window.location.search || '');
        const current = Object.fromEntries(UTM_KEYS
            .filter((key) => query.get(key))
            .map((key) => [key, query.get(key)]));
        if (Object.keys(current).length) {
            sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(current));
            return current;
        }
        return JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) || '{}');
    } catch (_) {
        return {};
    }
}

// أسماء المفاتيح الفعلية المستخدمة في كل نداءات trackEvent(...) الحالية عبر web/js
// (بما فيها ...context المنتشرة من monitoring.js/captureException). أي مفتاح جديد
// غير مُدرَج هنا يُسقط بصمت بدل أن يمرّ حرفياً إلى gtag/fbq/Supabase.
const ALLOWED_EVENT_PARAM_KEYS = new Set([
    'page', 'application_type', 'type', 'provider', 'model', 'source', 'outcome',
    'duration_ms', 'message', 'reason', 'level', 'specialty', 'sector', 'status',
    'tier', 'kind', 'surface', 'decision', 'orderId', 'colKey', 'format',
    'study_id', 'category', 'action', 'permission', 'expiry_days', 'view_mode',
    'hide_sensitive', 'stepId', 'key', 'tone', 'filename', 'lineno', 'colno',
    'url', 'applicationType', 'step', 'operation', 'studyId', 'isSignUp', 'args',
]);

export function trackEvent(name, params = {}) {
    // تدقيق كوكيز 2026-08-22 (إشعار الكوكيز public/js/cookie-notice.js): كانت كل
    // استدعاءات trackEvent تصل فعلياً (gtag/fbq + إدراج Supabase) بلا أي شرط موافقة —
    // الآن لا شيء يغادر المتصفح قبل ضغط الزائر "موافق" صراحة.
    if (!hasAnalyticsConsent()) return;
    try {
        const safeParams = Object.fromEntries(Object.entries(params).filter(([k]) => ALLOWED_EVENT_PARAM_KEYS.has(k)));
        const eventParams = { ...getEnvironmentParams(), ...getExperimentParams(), ...getAttributionParams(), ...safeParams };
        if (typeof window !== 'undefined' && typeof window.gtag === 'function') window.gtag('event', name, eventParams);
        if (typeof window !== 'undefined' && typeof window.fbq === 'function') window.fbq('trackCustom', name, eventParams);
        if (typeof window !== 'undefined') window.dispatchEvent?.(new CustomEvent('qarar:analytics', { detail: { name, params: eventParams } }));

        // تسجيل حقيقي (2026-07-16) — جدول events تقرأه لوحة الأدمن عبر
        // admin_events_stats. غير منتظِر عمداً: تتبّع السلوك لا يجوز أن يؤخّر
        // أي إجراء فعلي في الواجهة.
        // تدقيق 2026-07-21 (بند #47): إدراج مباشر عبر .insert() كان بلا أي حدّ
        // معدّل من anon — استُبدل بـRPC track_event التي تفرض حدّاً خادمياً
        // (500/10 دقائق لكل جلسة) وتشتقّ user_id من الجلسة خادمياً بدل العميل.
        (async () => {
            const { supabase, ok } = await getSupabaseClient();
            if (!ok || !supabase) return;
            await supabase.rpc('track_event', {
                p_event_name: name,
                p_props: eventParams,
                p_session_id: getSessionId(),
            });
        })().catch(() => {
            // التتبّع لا يجب أن يقاطع تجربة المستخدم أبداً
        });
    } catch (_) {
        // Analytics must never interrupt the study workflow.
    }
}
