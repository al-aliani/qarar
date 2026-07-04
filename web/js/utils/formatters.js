/**
 * Common formatting utilities for the application
 * Non-finite values (NaN, ±Infinity) are shown as "—" to avoid misleading output.
 * دعم عملات خليجية: SAR, AED, KWD, BHD, OMR, QAR (المرحلة 4)
 */

const safeNum = (v) => (v != null && v !== '' && Number.isFinite(Number(v))) ? Number(v) : null;

const GULF_CURRENCIES = ['SAR', 'AED', 'KWD', 'BHD', 'OMR', 'QAR'];
const CURRENCY_LABELS = { SAR: 'ريال سعودي', AED: 'درهم إماراتي', KWD: 'دينار كويتي', BHD: 'دينار بحريني', OMR: 'ريال عماني', QAR: 'ريال قطري' };

/** @param {number} value @param {string} [currency] */
export const formatCurrency = (value, currency = 'SAR') => {
    const n = safeNum(value);
    const code = GULF_CURRENCIES.includes(currency) ? currency : 'SAR';
    return n == null ? '—' : new Intl.NumberFormat('ar-SA', {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 0
    }).format(n);
};

export { GULF_CURRENCIES, CURRENCY_LABELS };

export const formatPercent = (value) => {
    const n = safeNum(value);
    return n == null ? '—' : new Intl.NumberFormat('ar-SA', {
        style: 'percent',
        maximumFractionDigits: 1
    }).format(n);
};

export const formatNumber = (value) => {
    const n = safeNum(value);
    return n == null ? '—' : new Intl.NumberFormat('ar-SA', {
        maximumFractionDigits: 2
    }).format(n);
};

/**
 * فترة الاسترداد للعرض في التقارير والمصدّرات.
 * null / Infinity / 0 (القيمة الحارسة القديمة) = غير قابل للاسترداد —
 * لا تُعرض «0.0 سنة» أبداً (كانت تظهر لأسوأ مشروع كأفضل مؤشر في تقرير البنك).
 */
export const formatPayback = (value) => {
    const n = safeNum(value);
    if (n == null || n <= 0) return 'غير قابل للاسترداد خلال فترة الدراسة';
    return n.toFixed(1) + ' سنة';
};

/**
 * نسبة مخزنة ككسر (0.155 → «15.5%»). تقصّ ضجيج الفاصلة العائمة
 * (0.050000000000000176 → «5.0%») ولا تعرض الكسر الخام أبداً.
 */
export const formatFractionAsPercent = (value, decimals = 1) => {
    const n = safeNum(value);
    return n == null ? '—' : (n * 100).toFixed(decimals) + '%';
};

/** تقريب رقم لعدد منازل محدد مع إزالة ضجيج الفاصلة العائمة — للكتابة في خلايا Excel */
export const roundClean = (value, decimals = 2) => {
    const n = safeNum(value);
    if (n == null) return 0;
    const f = Math.pow(10, decimals);
    return Math.round(n * f) / f;
};
