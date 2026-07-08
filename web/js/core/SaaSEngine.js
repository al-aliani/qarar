import { SECTIONS } from './schema.js';

const text = (value) => String(value ?? '').trim();
const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

export function isSaaSStudy(study = {}) {
    const info = study[SECTIONS.PROJECT_INFO] || {};
    const concept = `${info.concept || ''} ${info.description || ''} ${info.name || ''}`;
    const streams = study[SECTIONS.REVENUE]?.streams || [];
    const streamText = Array.isArray(streams) ? streams.map(s => s.service || s.name || '').join(' ') : '';
    return /saas|منصة|تطبيق|برمجي|تقني|اشتراك|موقع دراسة جدوى/i.test(`${concept} ${streamText}`);
}

function isRecurringStream(stream = {}) {
    const label = text(stream.service || stream.name);
    return /اشتراك|subscription|monthly|شهري|SaaS|منصة|basic|pro|premium/i.test(label);
}

function monthlyAdminCostByKeyword(study, keywords) {
    const admin = study[SECTIONS.ADMINISTRATIVE]?.administrative || [];
    if (!Array.isArray(admin)) return 0;
    return admin.reduce((sum, item) => {
        const name = text(item.name || item.description || item.notes);
        return keywords.some(k => name.includes(k)) ? sum + num(item.monthly) : sum;
    }, 0);
}

export function analyzeSaaSMetrics(study = {}, results = {}) {
    if (!isSaaSStudy(study)) {
        return { applicable: false, warnings: [] };
    }

    const streams = Array.isArray(study[SECTIONS.REVENUE]?.streams) ? study[SECTIONS.REVENUE].streams : [];
    const recurring = streams.filter(isRecurringStream);
    const sourceStreams = recurring.length ? recurring : streams;
    const subscribers = sourceStreams.reduce((sum, s) => sum + num(s.customersPerMonth), 0);
    const mrr = sourceStreams.reduce((sum, s) => sum + (num(s.customersPerMonth) * num(s.avgPrice)), 0);
    const arr = mrr * 12;
    const variableCostMonthly = sourceStreams.reduce((sum, s) => {
        const revenue = num(s.customersPerMonth) * num(s.avgPrice);
        return sum + (revenue * Math.min(1, Math.max(0, num(s.variableCostRate))));
    }, 0);
    const grossMargin = mrr > 0 ? Math.max(0, Math.min(1, 1 - (variableCostMonthly / mrr))) : null;
    const arpa = subscribers > 0 ? mrr / subscribers : 0;

    const assumptions = study[SECTIONS.ASSUMPTIONS] || {};
    const monthlyChurnRate = Math.min(0.95, Math.max(0.005, num(assumptions.saasMonthlyChurnRate || 0.04)));
    const ltv = grossMargin != null ? (arpa * grossMargin) / monthlyChurnRate : null;
    const marketingAnnual = num(results?.opex?.marketingAnnual);
    const cac = subscribers > 0 ? marketingAnnual / subscribers : null;
    const ltvCacRatio = cac && ltv != null ? ltv / cac : null;
    const cloudMonthly = monthlyAdminCostByKeyword(study, ['سحابة', 'استضافة', 'ذكاء', 'AI', 'cloud']);
    const y1Ebitda = num(results?.incomeStatement?.[0]?.ebitda);
    const monthlyBurn = y1Ebitda < 0 ? Math.abs(y1Ebitda) / 12 : 0;
    const fundingSurplus = Math.max(0, -num(results?.financingCheck?.fundingGap));
    const runwayMonths = monthlyBurn > 0 ? fundingSurplus / monthlyBurn : null;

    const warnings = [];
    if (mrr <= 0) warnings.push({ code: 'SAAS_MRR_MISSING', message: 'لا توجد إيرادات اشتراكية واضحة لحساب MRR/ARR.', path: 'revenue.streams' });
    if (grossMargin != null && grossMargin < 0.65) warnings.push({ code: 'SAAS_GROSS_MARGIN_LOW', message: 'هامش SaaS الإجمالي أقل من 65%؛ راجع تكلفة السحابة والعمولات.', path: 'revenue.streams.variableCostRate' });
    if (ltvCacRatio != null && ltvCacRatio < 3) warnings.push({ code: 'SAAS_LTV_CAC_LOW', message: 'نسبة LTV/CAC أقل من 3x؛ تكلفة اكتساب العميل تحتاج مراجعة.', path: 'marketing.campaigns' });
    if (runwayMonths != null && runwayMonths < 6) warnings.push({ code: 'SAAS_RUNWAY_LOW', message: 'مدى السيولة أقل من 6 أشهر عند خسارة السنة الأولى.', path: 'financing.sources' });

    return {
        applicable: true,
        subscribers,
        mrr: Math.round(mrr),
        arr: Math.round(arr),
        arpa,
        grossMargin,
        monthlyChurnRate,
        ltv,
        cac,
        ltvCacRatio,
        cloudMonthly,
        monthlyBurn,
        runwayMonths,
        warnings
    };
}
