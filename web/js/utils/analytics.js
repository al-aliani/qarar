/** Optional analytics bridge. It stays inert until the product config provides GA4/Meta. */
import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';

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

export function trackEvent(name, params = {}) {
    try {
        const eventParams = { ...getEnvironmentParams(), ...getExperimentParams(), ...getAttributionParams(), ...params };
        if (typeof window !== 'undefined' && typeof window.gtag === 'function') window.gtag('event', name, eventParams);
        if (typeof window !== 'undefined' && typeof window.fbq === 'function') window.fbq('trackCustom', name, eventParams);
        if (typeof window !== 'undefined') window.dispatchEvent?.(new CustomEvent('qarar:analytics', { detail: { name, params: eventParams } }));

        // تسجيل حقيقي (2026-07-16) — جدول events تقرأه لوحة الأدمن عبر
        // admin_events_stats. غير منتظِر عمداً: تتبّع السلوك لا يجوز أن يؤخّر
        // أي إجراء فعلي في الواجهة.
        (async () => {
            const { supabase, ok } = await getSupabaseClient();
            if (!ok || !supabase) return;
            const { user } = await getAuthUser();
            await supabase.from('events').insert({
                user_id: user?.id || null,
                session_id: getSessionId(),
                event_name: name,
                props: eventParams,
            });
        })().catch(() => {
            // التتبّع لا يجب أن يقاطع تجربة المستخدم أبداً
        });
    } catch (_) {
        // Analytics must never interrupt the study workflow.
    }
}
