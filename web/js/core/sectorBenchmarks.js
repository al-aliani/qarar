/**
 * معايير قطاعية سعودية على مستوى «السائق» (المُدخل) لا المخرَج —
 * المدقق المحترف لا ينظر إلى NPV أولاً؛ ينظر إلى نسبة تكلفة الطعام،
 * الإيجار/المبيعات، والعمالة/المبيعات ويقارنها بقطاعك.
 *
 * النطاقات مستقاة من الممارسات المحلية المتعارف عليها (منشآت/الاستشاريون)
 * ومطابقة لما يستخدمه SmartAdvisor — عدّلها بحذر وبمصدر.
 */

// حقل netProfitToRevenue = هامش صافي الربح إلى المبيعات (نطاق ممارسات محلية،
// نفس مصدرية بقية النطاقات في هذا الملف: تقديرات قطاعية متعارف عليها، عدّلها بمصدر).
// أُضيف ليكون هذا الملف المصدر الوحيد لكل معايير SmartAdvisor (لا جدول مثبّت مواز).
export const SECTOR_BENCHMARKS = {
    fnb: {
        label: 'مطاعم ومقاهي',
        test: /مطعم|مطاعم|كافيه|مقهى|قهوة|فود|مأكولات|مشروبات|برجر|حلويات|مخبز|مطبخ|طعام|ضيافة|بوفيه/i,
        variableCostRate: [0.28, 0.45],   // تكلفة الطعام + عمولات المنصات
        rentToRevenue: [0.08, 0.15],
        laborToRevenue: [0.20, 0.32],
        marketingToRevenue: [0.03, 0.08],
        netProfitToRevenue: [0.08, 0.18]
    },
    // قبل «التجزئة» العامة عمداً — أول مطابقة تفوز، والعطور/التجميل تطابق /متجر|تجزئة/ أيضاً.
    // نطاق بقالة/سوبرماركت (COGS ‏55-75%) كان يتهم تكلفة العطور الصحيحة (~45%) بأنها
    // «تفاؤل مختبئ» — التجزئة عالية الهامش قطاع مختلف جوهرياً (تدقيق ٢٠٢٦-٠٧-٠٦).
    retailHighMargin: {
        label: 'تجزئة عالية الهامش (عطور/تجميل/إكسسوارات/أزياء)',
        test: /عطور|عطر|مستحضرات|تجميل|بخور|عود|دهن|مجوهرات|ذهب|ساعات|نظارات|إكسسوار|بوتيك|أزياء|ملابس|هدايا/i,
        variableCostRate: [0.35, 0.55],   // تكلفة البضاعة — هوامش 45-65%
        rentToRevenue: [0.08, 0.18],      // مواقع مولات/ممشى أغلى نسبةً لصغر المساحة
        laborToRevenue: [0.10, 0.22],
        marketingToRevenue: [0.03, 0.08],
        netProfitToRevenue: [0.12, 0.28]
    },
    retail: {
        label: 'تجزئة',
        test: /تجزئة|بقالة|متجر|سوبرماركت|بيع بالتجزئة/i,
        variableCostRate: [0.55, 0.75],   // تكلفة البضاعة المباعة
        rentToRevenue: [0.05, 0.12],
        laborToRevenue: [0.08, 0.18],
        marketingToRevenue: [0.02, 0.06],
        netProfitToRevenue: [0.02, 0.08]
    },
    service: {
        label: 'خدمي',
        test: /خدمي|استشار|تعليم|تدريب|صحي|عيادة|رياضة|لياقة|نادي|صالة|صالون|صيانة|تنظيف/i,
        variableCostRate: [0.10, 0.35],
        rentToRevenue: [0.05, 0.15],
        laborToRevenue: [0.30, 0.50],     // الخدمات كثيفة عمالة
        marketingToRevenue: [0.03, 0.10],
        netProfitToRevenue: [0.12, 0.30]
    },
    industrial: {
        label: 'صناعي',
        test: /مصنع|صناع|إنتاج|تصنيع/i,
        variableCostRate: [0.45, 0.70],   // مواد خام
        rentToRevenue: [0.03, 0.10],
        laborToRevenue: [0.10, 0.25],
        marketingToRevenue: [0.01, 0.05],
        netProfitToRevenue: [0.08, 0.20]
    },
    logistics: {
        label: 'لوجستي',
        test: /لوجستي|شحن|نقل|تخزين|توزيع/i,
        variableCostRate: [0.35, 0.60],   // وقود وصيانة وأجور رحلات
        rentToRevenue: [0.05, 0.15],
        laborToRevenue: [0.15, 0.35],
        marketingToRevenue: [0.01, 0.05],
        netProfitToRevenue: [0.05, 0.15]
    },
    saas: {
        label: 'منصة رقمية/SaaS',
        test: /saas|منصة|تطبيق|برمجي|رقمي/i,
        variableCostRate: [0.05, 0.25],   // استضافة وعمولات دفع
        rentToRevenue: [0.08, 0.25],       // مكتب + بنية سحابية + أدوات تشغيل ثابتة
        laborToRevenue: [0.30, 0.60],
        marketingToRevenue: [0.10, 0.30],
        netProfitToRevenue: [0.10, 0.30]   // عند النضج؛ المراحل المبكرة قد تكون سالبة
    }
};

/**
 * معيار عام (غير مصنّف) — نطاقات واسعة متحفّظة تُستخدم فقط حين يتعذّر اكتشاف القطاع،
 * لتفادي إنذارات كاذبة. ليس مصدراً موازياً بل احتياطي أخير.
 */
export const GENERIC_BENCHMARK = {
    label: 'عام (غير مصنّف)',
    variableCostRate: [0.20, 0.60],
    rentToRevenue: [0.05, 0.18],
    laborToRevenue: [0.10, 0.45],
    marketingToRevenue: [0.02, 0.15],
    netProfitToRevenue: [0.05, 0.25]
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
 * يحسم المعيار المستخدَم لأي دراسة: القطاع المكتشَف وإلا المعيار العام.
 * نقطة الدخول الوحيدة التي يجب أن يستهلكها SmartAdvisor وبوابة QA معاً
 * كي لا يتناقض حكمان على نفس الرقم.
 * @param {object} state
 * @returns {{label:string, variableCostRate:number[], rentToRevenue:number[], laborToRevenue:number[], marketingToRevenue:number[], netProfitToRevenue:number[], isGeneric:boolean}}
 */
export function resolveSectorBenchmark(state) {
    const text = state?.projectInfo?.sector || state?.projectInfo?.concept || state?.projectInfo?.activity;
    const bench = detectSectorBenchmark(text);
    return bench ? { ...bench, isGeneric: false } : { ...GENERIC_BENCHMARK, isGeneric: true };
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
            label: 'الإيجار إلى المبيعات',
            actual: (Number(results?.opex?.rentAnnual) || 0) / revenue,
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
        // تدقيق 2026-07-08 (ملاحظة حرجة، خبير السوق): نطاقات sectorBenchmarks.js تقديرية
        // (ASSUMPTION) بلا مصدر خارجي موثّق — كانت تُعرض للمستخدم كأنها معيار رسمي قاطع.
        // الآن كل رسالة تفصح صراحة عن طبيعتها التقديرية.
        const provenanceNote = ' (نطاق تقديري داخلي — ليس رقماً رسمياً منشوراً، راجعه بحذر).';
        if (d.actual < lo) {
            warnings.push({
                code: `BENCH_${d.code}_LOW`,
                message: `${d.label} = ${pct(d.actual)} — أدنى من نطاق قطاع «${bench.label}» (${rangeText(d.range)}). ${d.lowHint}.${provenanceNote}`,
                path: 'drivers'
            });
        } else if (d.actual > hi) {
            warnings.push({
                code: `BENCH_${d.code}_HIGH`,
                message: `${d.label} = ${pct(d.actual)} — أعلى من نطاق قطاع «${bench.label}» (${rangeText(d.range)}). ${d.highHint}.${provenanceNote}`,
                path: 'drivers'
            });
        }
    });

    return warnings;
}
