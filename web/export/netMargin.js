/**
 * هامش الربح الصافي للعرض في المخرجات — مصدر واحد لعرضَي «عرض المستثمرين» (PitchDeck)
 * و«العرض التقديمي» (PPTX).
 *
 * الخلفية (مسح 2026-08-26): كل مصدِّر كان يشتقّ الهامش بنفسه فانحرف الاثنان في اتجاهين
 * متعاكسين — PitchDeckExporter كان يقرأ `incomeStatement[0].netMargin` وهو مفتاح لا
 * ينتجه المحرك إطلاقاً فيطبع «0.0%» دائماً، وpptxExporter كان يقسم على `revenue || 1`
 * فيحوّل صافي الخسارة نفسه إلى «-28195031.3%» حين لا إيراد. القاعدة الوحيدة هنا:
 * الهامش قابل للحساب إذا وفقط إذا كان إيراد السنة الأولى موجباً — وهو بالضبط شرط
 * المحرك عند اشتقاق `indicators.netMargin` (engine.js: `year1Revenue > 0 ? … : 0`،
 * وyear1Revenue = incomeStatement[0].revenue). خارج ذلك «—» لا صفر: الصفر رقم يبدو
 * حقيقياً أمام مستثمر (نفس مبدأ formatIrrPct وsafePayback).
 *
 * @param {any} results ناتج calculateStudy
 * @param {number} [digits] عدد الخانات العشرية
 * @returns {string} «32.7%» أو «—»
 */
export function netMarginText(results, digits = 1) {
    const inc = results?.incomeStatement?.[0] || {};
    const revenue = Number(inc.revenue);
    if (!Number.isFinite(revenue) || revenue <= 0) return '—';
    const fromEngine = Number(results?.indicators?.netMargin);
    const margin = Number.isFinite(fromEngine) ? fromEngine : Number(inc.netIncome) / revenue;
    return Number.isFinite(margin) ? (margin * 100).toFixed(digits) + '%' : '—';
}
