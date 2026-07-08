/**
 * مصدر قوالب الدراسات.
 *
 * القوالب القطاعية الافتراضية أُزيلت لأنها كانت تبدو كدراسات جاهزة من غير مختص.
 * سيعود هذا المصدر لاحقاً لقوالب خبراء معتمدة فقط.
 */

export const TEMPLATES = {};

export function normalizeTemplateData(rawData) {
    return rawData && typeof rawData === 'object' ? rawData : {};
}

export function applySectionTemplate(store, template) {
    if (!store || !template?.data) return;

    const current = store.get ? store.get() : store.getState?.();
    if (!current) return;

    const normalized = normalizeTemplateData(template.data);
    const next = { ...current };
    Object.entries(normalized).forEach(([section, value]) => {
        if (next[section] && typeof next[section] === 'object' && !Array.isArray(next[section]) && value && typeof value === 'object' && !Array.isArray(value)) {
            next[section] = { ...next[section], ...value };
        } else {
            next[section] = value;
        }
    });

    store.set?.(next);
    store.notify?.();
}
