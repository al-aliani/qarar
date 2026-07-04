/**
 * حساب سريع لجدوى مبدئية من: إيراد شهري، تكاليف شهرية، استثمار أولي، مصدر التمويل.
 * يُستخدم في مسار "جدوى سريعة" (3 خطوات) فقط.
 */

const DEFAULT_DISCOUNT_RATE = 0.10;
const DEFAULT_LOAN_YEARS = 5;
const DEFAULT_LOAN_RATE = 0.08;
const PROJECTION_YEARS = 5;

/**
 * @param {Object} inputs
 * @param {number} inputs.monthlyRevenue - إيراد شهري متوقع (ريال)
 * @param {number} inputs.monthlyCosts - تكاليف تشغيل شهرية (ريال)
 * @param {number} inputs.initialInvestment - استثمار أولي (ريال)
 * @param {string} inputs.fundingSource - 'self' | 'loan'
 * @returns {{ npv, paybackYears, breakevenMonthly, annualNet, recommendation, recommendationLabel }}
 */
export function quickFeasibilityCalc(inputs) {
    const rev = Number(inputs.monthlyRevenue) || 0;
    const cost = Number(inputs.monthlyCosts) || 0;
    const initial = Number(inputs.initialInvestment) || 0;
    const isLoan = (inputs.fundingSource || '').toLowerCase() === 'loan';

    const annualRevenue = rev * 12;
    const annualCosts = cost * 12;
    let annualDebtService = 0;
    if (isLoan && initial > 0) {
        const r = DEFAULT_LOAN_RATE;
        const n = DEFAULT_LOAN_YEARS;
        const annualPayment = (initial * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
        annualDebtService = annualPayment;
    }
    const annualNet = annualRevenue - annualCosts - annualDebtService;

    // NPV (سنوات 1..5، خصم 10%)
    let npv = -initial;
    const dr = DEFAULT_DISCOUNT_RATE;
    for (let t = 1; t <= PROJECTION_YEARS; t++) {
        npv += annualNet / Math.pow(1 + dr, t);
    }
    npv = Math.round(npv);

    // فترة الاسترداد (سنوات)
    let paybackYears = 999;
    if (annualNet > 0) {
        paybackYears = initial / annualNet;
        paybackYears = Math.round(paybackYears * 10) / 10;
    }

    // نقطة التعادل: إيراد شهري = تكاليف شهرية (+ خدمة دين إن وُجد)
    const debtMonthly = annualDebtService / 12;
    const breakevenMonthly = cost + debtMonthly;

    // توصية مبسطة
    let recommendation = 'nogo';
    let recommendationLabel = 'لا يُنصح (NO-GO)';
    if (npv > 0 && paybackYears <= 7) {
        recommendation = 'go';
        recommendationLabel = 'مُوصى به (GO)';
    } else if (npv > 0 && paybackYears <= 10) {
        recommendation = 'revise';
        recommendationLabel = 'مراجعة (REVISE)';
    } else if (npv > 0) {
        recommendation = 'revise';
        recommendationLabel = 'مراجعة (REVISE) — فترة استرداد طويلة';
    } else if (annualNet > 0) {
        recommendation = 'revise';
        recommendationLabel = 'مراجعة (REVISE) — تحسين الإيرادات أو خفض التكاليف';
    }

    return {
        npv,
        paybackYears: paybackYears >= 999 ? null : paybackYears,
        breakevenMonthly: Math.round(breakevenMonthly),
        annualNet: Math.round(annualNet),
        annualRevenue: Math.round(annualRevenue),
        annualCosts: Math.round(annualCosts),
        recommendation,
        recommendationLabel
    };
}

/** قيم افتراضية حسب القطاع (إيراد شهري، تكلفة شهرية، استثمار أولي) */
export const QUICK_DEFAULTS_BY_SECTOR = {
    مطعم: { monthlyRevenue: 80000, monthlyCosts: 50000, initialInvestment: 400000 },
    retail: { monthlyRevenue: 60000, monthlyCosts: 35000, initialInvestment: 250000 },
    خدمي: { monthlyRevenue: 45000, monthlyCosts: 25000, initialInvestment: 150000 },
    صناعي: { monthlyRevenue: 120000, monthlyCosts: 70000, initialInvestment: 800000 },
    تقني: { monthlyRevenue: 35000, monthlyCosts: 20000, initialInvestment: 100000 },
    أخرى: { monthlyRevenue: 50000, monthlyCosts: 30000, initialInvestment: 200000 }
};
