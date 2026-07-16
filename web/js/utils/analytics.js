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

export function trackEvent(name, params = {}) {
    try {
        if (typeof window !== 'undefined' && typeof window.gtag === 'function') window.gtag('event', name, params);
        if (typeof window !== 'undefined' && typeof window.fbq === 'function') window.fbq('trackCustom', name, params);
        if (typeof window !== 'undefined') window.dispatchEvent?.(new CustomEvent('qarar:analytics', { detail: { name, params } }));

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
                props: params,
            });
        })().catch(() => {
            // التتبّع لا يجب أن يقاطع تجربة المستخدم أبداً
        });
    } catch (_) {
        // Analytics must never interrupt the study workflow.
    }
}
