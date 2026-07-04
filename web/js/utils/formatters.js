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
