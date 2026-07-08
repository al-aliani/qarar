/**
 * المصدر الوحيد لأسعار الباقات في «قرار».
 * عدّل الأسعار هنا فقط — تقرأها صفحة الهبوط (landing.html) وإعدادات التطبيق (config.js).
 * كان الخطر: الأسعار مكتوبة يدوياً في landing.html فقط بينما config.js يحمل قيماً null،
 * فأي تحديث مستقبلي قد يُنسى في أحد المكانين. الآن مكان واحد.
 */

export const CURRENCY_SYMBOL = '﷼';

/** الباقات الثلاث. price بالريال السعودي. channel: كيف يُطلب (app = عبر المنصة، whatsapp = طلب). */
export const PRICING_PACKAGES = [
    { id: 'self', name: 'ذاتي', price: 249, unit: '﷼ / دراسة', channel: 'app' },
    { id: 'reviewed', name: 'مراجَع بخبير', price: 990, unit: '﷼ / دراسة', channel: 'whatsapp' },
    { id: 'full', name: 'خدمة كاملة', price: 2900, unit: '﷼ / دراسة', channel: 'whatsapp' }
];

/** أقل وأعلى سعر معلن (يُشتقّان تلقائياً — لا تُحدَّث يدوياً). */
export const PRICE_MIN = Math.min(...PRICING_PACKAGES.map(p => p.price));
export const PRICE_MAX = Math.max(...PRICING_PACKAGES.map(p => p.price));

/** تنسيق السعر بأرقام لاتينية مع فاصل آلاف (مطابقةً لعرض صفحة الهبوط: 2,900). */
export function formatPrice(n) {
    return new Intl.NumberFormat('en-US').format(Number(n) || 0);
}
