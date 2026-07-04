/**
 * معايير قطاعية سعودية على مستوى «السائق» (المُدخل) لا المخرَج —
 * المدقق المحترف لا ينظر إلى NPV أولاً؛ ينظر إلى نسبة تكلفة الطعام،
 * الإيجار/المبيعات، والعمالة/المبيعات ويقارنها بقطاعك.
 *
 * النطاقات مستقاة من الممارسات المحلية المتعارف عليها (منشآت/الاستشاريون)
 * ومطابقة لما يستخدمه SmartAdvisor — عدّلها بحذر وبمصدر.
 */

export const SECTOR_BENCHMARKS = {
    fnb: {
        label: 'مطاعم ومقاهي',
        test: /مطعم|مطاعم|كافيه|مقهى|قهوة|فود|مأكولات|مشروبات|برجر|حلويات|مخبز/i,
        variableCostRate: [0.28, 0.45],   // تكلفة الطعام + عمولات المنصات
        rentToRevenue: [0.08, 0.15],
        laborToRevenue: [0.20, 0.32],
        marketingToRevenue: [0.03, 0.08]
    },
    retail: {
        label: 'تجزئة',
        test: /تجزئة|بقالة|متجر|سوبرماركت|بيع بالتجزئة/i,
        variableCostRate: [0.55, 0.75],   // تكلفة البضاعة المباعة
        rentToRevenue: [0.05, 0.12],
        laborToRevenue: [0.08, 0.18],
        marketingToRevenue: [0.02, 0.06]
    },
    service: {
        label: 'خدمي',
        test: /خدمي|استشار|تعليم|تدريب|صحي|عيادة|صالون|صيانة|تنظيف/i,
        variableCostRate: [0.10, 0.35],
        rentToRevenue: [0.05, 0.15],
        laborToRevenue: [0.30, 0.50],     // الخدمات كثيفة عمالة
        marketingToRevenue: [0.03, 0.10]
    },
    industrial: {
        label: 'صناعي',
        test: /مصنع|صناع|إنتاج|تصنيع/i,
        variableCostRate: [0.45, 0.70],   // مواد خام
        rentToRevenue: [0.03, 0.10],
        laborToRevenue: [0.10, 0.25],
        marketingToRevenue: [0.01, 0.05]
    },
    logistics: {
        label: 'لوجستي',
        test: /لوجستي|شحن|نقل|تخزين|توزيع/i,
        variableCostRate: [0.35, 0.60],   // وقود وصيانة وأجور رحلات
        rentToRevenue: [0.05, 0.15],
        laborToRevenue: [0.15, 0.35],
        marketingToRevenue: [0.01, 0.05]
    },
    saas: {
        label: 'منصة رقمية/SaaS',
        test: /saas|منصة|تطبيق|برمجي|رقمي/i,
        variableCostRate: [0.05, 0.25],   // استضافة وعمولات دفع
        rentToRevenue: [0.02, 0.08],
        laborToRevenue: [0.30, 0.60],
        marketingToRevenue: [0.10, 0.30]
    }
};

/** يكتشف قطاع الدراسة من نص القطاع/الفكرة — null إن لم يُطابق */
export function detectSectorBenchmark(sectorText) {
    const t = String(sectorText || '');
    if (!t.trim()) return null;
    for (const bench of Object.values(SECTOR_BENCHMARKS)) {
        if (bench.test.test(t)) return bench;
    }
    return null;
}

/**
 * فحص «السائقين» ضد معايير القطاع — يعيد قائمة تحذيرات جاهزة لبوابة QA.
 * يعتمد على مخرجات المحرك: opex.payrollAnnual/rentAnnual/marketingAnnual
 * وقائمة الدخل سنة 1 — كلها من مصدر الحقيقة نفسه.
 * @param {object} state
 * @param {object} results - calculateStudy(state)
 * @returns {Array<{code: string, message: string, path: string}>}
 */
export function checkDriversAgainstBenchmarks(state, results) {
    const warnings = [];
    const bench = detectSectorBenchmark(state?.projectInfo?.sector || state?.projectInfo?.concept);
    if (!bench) return warnings;

    const y1 = results?.incomeStatement?.[0];
    const revenue = Number(y1?.revenue) || 0;
    if (revenue <= 0) return warnings;

    const pct = (v) => (v * 100).toFixed(0) + '%';
    const rangeText = ([lo, hi]) => `${pct(lo)}–${pct(hi)}`;

    const drivers = [
        {
            code: 'VC_RATE',
            label: 'نسبة التكاليف المتغيرة (تكلفة البضاعة/الخدمة)',
            actual: (Number(y1?.variableCosts) || 0) / revenue,
            range: bench.variableCostRate,
            lowHint: 'انخفاضها غير المبرر أشهر مكان يختبئ فيه التفاؤل',
            highHint: 'ارتفاعها يأكل الهامش — راجع التسعير أو الموردين'
        },
        {
            code: 'RENT_RATIO',
            label: 'الإيجار والمصاريف الإدارية إلى المبيعات',
            actual: (Number(results?.opex?.rentAdminAnnual) || 0) / revenue,
            range: bench.rentToRevenue,
            lowHint: 'أدنى من المعتاد — هل الإيجار كامل مُدخل؟',
            highHint: 'أعلى من المعتاد — الموقع يلتهم الربح'
        },
        {
            code: 'LABOR_RATIO',
            label: 'العمالة إلى المبيعات',
            actual: (Number(results?.opex?.payrollAnnual) || 0) / revenue,
            range: bench.laborToRevenue,
            lowHint: 'أدنى من المعتاد — هل الفريق يكفي فعلاً لتحقيق هذه المبيعات؟',
            highHint: 'أعلى من المعتاد — هيكل الرواتب يحتاج مراجعة'
        }
    ];

    drivers.forEach(d => {
        if (!Number.isFinite(d.actual) || d.actual <= 0) return;
        const [lo, hi] = d.range;
        if (d.actual < lo) {
            warnings.push({
                code: `BENCH_${d.code}_LOW`,
                message: `${d.label} = ${pct(d.actual)} — أدنى من نطاق قطاع «${bench.label}» (${rangeText(d.range)}). ${d.lowHint}.`,
                path: 'drivers'
            });
        } else if (d.actual > hi) {
            warnings.push({
                code: `BENCH_${d.code}_HIGH`,
                message: `${d.label} = ${pct(d.actual)} — أعلى من نطاق قطاع «${bench.label}» (${rangeText(d.range)}). ${d.highHint}.`,
                path: 'drivers'
            });
        }
    });

    return warnings;
}
