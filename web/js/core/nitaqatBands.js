/**
 * نطاقات «نطاقات» (Nitaqat) — تصنيف تقريبي مبسّط لالتزام السعودة، وليس الجدول الرسمي.
 *
 * البرنامج الفعلي (نطاقات المطوّر، ساري من أبريل 2026) يحسب النسبة المطلوبة بمعادلة
 * لوغاريتمية (Y = M×log(X) + C) تختلف قيمة C فيها باختلاف النشاط الاقتصادي وحجم
 * المنشأة، بمتوسط متحرك 26 أسبوعاً ووزن مختلف حسب الراتب ونوع الوظيفة — لا يمكن اختزاله
 * في جدول نسب ثابتة دون تضليل المستخدم. الجدول أدناه تقريب تعليمي فقط لمنشأة صغيرة
 * (الفئة الغالبة في دراسات قرار)، مبني على أمثلة عامة متداولة لا رقماً رسمياً منشوراً،
 * ومقسَّم إلى ثلاث مجموعات أنشطة عريضة فقط. للنسبة الملزمة الدقيقة لمنشأتك راجع حسابك
 * في منصة قوى (qiwa.sa) أو وزارة الموارد البشرية (hrsd.gov.sa).
 */

export const NITAQAT_TIER_LABELS = {
    red: 'أحمر',
    lowGreen: 'أخضر منخفض',
    midGreen: 'أخضر متوسط',
    highGreen: 'أخضر مرتفع',
    platinum: 'بلاتيني'
};

// عتبات تقريبية (نسبة توطين دنيا للدخول في هذا النطاق) لكل مجموعة أنشطة — منشأة صغيرة.
// تقريب تعليمي من أمثلة عامة متداولة (انظر تعليق الملف) — عدّله بحذر وبمصدر رسمي فقط.
export const NITAQAT_SIMPLIFIED_THRESHOLDS = {
    // صناعي/لوجستي: اعتماد تقليدي أعلى على عمالة وافدة فنية
    laborLight: { lowGreen: 0.06, midGreen: 0.12, highGreen: 0.20, platinum: 0.30 },
    // مطاعم/تجزئة: الفئة الأكثر شيوعاً في دراسات قرار
    balanced: { lowGreen: 0.10, midGreen: 0.18, highGreen: 0.28, platinum: 0.40 },
    // خدمي/SaaS: وظائف مهارة أعلى، توطين متوقَّع أكبر
    laborHeavy: { lowGreen: 0.15, midGreen: 0.25, highGreen: 0.35, platinum: 0.50 }
};

// يربط مفاتيح SECTOR_BENCHMARKS (sectorBenchmarks.js) بمجموعة العتبات المناسبة —
// لا كاشف قطاع ثانٍ هنا، فقط إعادة تصنيف لنفس المفاتيح المُكتشَفة هناك.
const SECTOR_GROUP_MAP = {
    fnb: 'balanced',
    retail: 'balanced',
    retailHighMargin: 'balanced',
    service: 'laborHeavy',
    saas: 'laborHeavy',
    industrial: 'laborLight',
    logistics: 'laborLight'
};

const DEFAULT_GROUP = 'balanced';

/**
 * يصنّف نسبة توطين إلى نطاق تقريبي (ليس رسمياً — راجع تعليق أعلى الملف).
 * @param {number} saudizationRate - نسبة كسرية 0-1 (مثال: 0.25 = 25%)
 * @param {string} [sectorKey] - أحد مفاتيح SECTOR_BENCHMARKS (sectorBenchmarks.js)؛
 *        يُستخدم النطاق المتوازن (balanced) افتراضياً إن جُهل أو لم يُطابَق
 * @returns {{tier:string, label:string, isCompliant:boolean, minCompliantRate:number, isApproximate:true}|null}
 *          null إن كانت النسبة غير رقم صالح (مثال: لا موظفين بعد)
 */
export function classifyNitaqatTier(saudizationRate, sectorKey) {
    if (saudizationRate === null || saudizationRate === undefined || saudizationRate === '') return null;
    const rate = Number(saudizationRate);
    if (!Number.isFinite(rate) || rate < 0) return null;

    const group = NITAQAT_SIMPLIFIED_THRESHOLDS[SECTOR_GROUP_MAP[sectorKey]]
        || NITAQAT_SIMPLIFIED_THRESHOLDS[DEFAULT_GROUP];

    let tier = 'red';
    if (rate >= group.platinum) tier = 'platinum';
    else if (rate >= group.highGreen) tier = 'highGreen';
    else if (rate >= group.midGreen) tier = 'midGreen';
    else if (rate >= group.lowGreen) tier = 'lowGreen';

    return {
        tier,
        label: NITAQAT_TIER_LABELS[tier],
        isCompliant: tier !== 'red',
        minCompliantRate: group.lowGreen,
        isApproximate: true
    };
}
