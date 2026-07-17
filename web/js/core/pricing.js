/**
 * المصدر الوحيد لأسعار الباقات في «قرار».
 * عدّل الأسعار هنا فقط — تقرأها صفحة الهبوط (landing.html) وإعدادات التطبيق (config.js).
 * كان الخطر: الأسعار مكتوبة يدوياً في landing.html فقط بينما config.js يحمل قيماً null،
 * فأي تحديث مستقبلي قد يُنسى في أحد المكانين. الآن مكان واحد.
 */

export const CURRENCY_SYMBOL = '﷼';

/** الباقات الأربع. كل الاشتراكات والطلبات تبدأ من داخل المنصة. */
export const PRICING_PACKAGES = [
    { id: 'free', name: 'مجانية', price: 0, unit: '﷼', channel: 'app' },
    { id: 'self', name: 'ذاتي', price: 249, unit: '﷼ / دراسة', channel: 'app' },
    { id: 'reviewed', name: 'مراجَع بخبير', price: 990, unit: '﷼ / دراسة', channel: 'app' },
    { id: 'full', name: 'خدمة كاملة', price: 2900, unit: '﷼ / دراسة', channel: 'app' }
];

/**
 * أقل وأعلى سعر معلن (يُشتقّان تلقائياً — لا تُحدَّث يدوياً).
 * الباقات المجانية مستثناة من PRICE_MIN: النطاق يصف السعر المعلن للبيع،
 * والمجانية غياب سعر لا سعر. بدون هذا الاستثناء كانت صفحة الهبوط تعلن
 * «من 0 ريالاً» (landing.html:1244 يكتب PRICE_MIN في [data-price-min]).
 */
const PAID_PACKAGES = PRICING_PACKAGES.filter(p => p.price > 0);
export const PRICE_MIN = Math.min(...PAID_PACKAGES.map(p => p.price));
export const PRICE_MAX = Math.max(...PAID_PACKAGES.map(p => p.price));

/** تنسيق السعر بأرقام لاتينية مع فاصل آلاف (مطابقةً لعرض صفحة الهبوط: 2,900). */
export function formatPrice(n) {
    return new Intl.NumberFormat('en-US').format(Number(n) || 0);
}
