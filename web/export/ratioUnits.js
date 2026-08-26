/**
 * وحدة عرض النسب المالية — مصدر واحد لكل المصدّرات (PDF/Word/Excel).
 *
 * الخلفية (مسح 2026-08-26): كل مصدِّر كان يختار مُنسّقه محلياً — `ratioCell` في
 * ReportGenerator، و`formatRatioMultiple/Percent` في wordExporter، و`pct/mult` في
 * excelExporter — فانحرفت `debtToEquity` وحدها: هي مضاعف بحكم تعريفها
 * (financial/ratios.js: إجمالي الخصوم ÷ حقوق الملكية) فطبعها PDF «1.85x» بينما
 * طبعتها ورقة Excel وجدول Word «185.0%» لنفس الدراسة، والعميل يقدّم الملفات
 * الثلاثة معاً لجهة تمويل.
 *
 * القاعدة: الوحدة تُعلَن هنا مرة واحدة لكل مفتاح، والمصدِّر يسأل ولا يقرّر —
 * فمصدِّر جديد لا يملك أصلاً موضعاً يختلف فيه. المفاتيح هي بالضبط مفاتيح
 * `results.ratios[i]` عدا `year` (مُثبَّت باختبار تغطية).
 */

/** @type {Readonly<Record<string, 'multiple'|'percent'>>} */
export const RATIO_UNITS = Object.freeze({
    currentRatio: 'multiple',
    quickRatio: 'multiple',
    cashRatio: 'multiple',
    debtRatio: 'percent',
    debtToEquity: 'multiple',
    assetTurnover: 'multiple',
    fixedAssetTurnover: 'multiple',
    roa: 'percent',
    roe: 'percent'
});

/**
 * النسبة منسَّقة بوحدتها المعلَنة؛ null/غير محقَّق يبقى «—» لا 0.
 * @param {string} key مفتاح النسبة في results.ratios
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function formatRatio(key, value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
    const n = Number(value);
    return RATIO_UNITS[key] === 'percent' ? `${(n * 100).toFixed(1)}%` : `${n.toFixed(2)}x`;
}
