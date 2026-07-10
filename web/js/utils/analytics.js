/** Optional analytics bridge. It stays inert until the product config provides GA4/Meta. */
export function trackEvent(name, params = {}) {
    try {
        if (typeof window !== 'undefined' && typeof window.gtag === 'function') window.gtag('event', name, params);
        if (typeof window !== 'undefined' && typeof window.fbq === 'function') window.fbq('trackCustom', name, params);
        if (typeof window !== 'undefined') window.dispatchEvent?.(new CustomEvent('qarar:analytics', { detail: { name, params } }));
    } catch (_) {
        // Analytics must never interrupt the study workflow.
    }
}
