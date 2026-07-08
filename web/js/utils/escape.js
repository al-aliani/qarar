/**
 * تهريب HTML موحّد (single source) — يُستخدم قبل أي حقن نص مستخدم في innerHTML أو قيم السمات.
 * يمنع حقن السكربت المخزّن (Stored XSS) في الدراسات المُشارَكة وقوالب الخبراء المستوردة.
 */
export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** مرادف صريح لتهريب قيمة تُوضع داخل سمة (value="…") — نفس المنطق، تسمية أوضح عند الاستخدام. */
export const escapeAttr = escapeHtml;
