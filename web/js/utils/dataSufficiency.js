/**
 * dataSufficiency.js — فحص مشترك: هل تتوفر بيانات إيرادات كافية لعرض درجة/توصية موثوقة؟
 *
 * المشكلة الجذرية: دراسة جديدة فارغة تماماً (بلا أي إيراد) كانت تُصدر حكماً قاطعاً "5 من
 * 100 - غير مجدٍ" و"NO-GO" في خطوة الملخص التنفيذي والمستشار الذكي، بينما لوحتا "المؤشرات
 * المالية" (FinancialDashboard.js) و"القرار الاستثماري" (DecisionDashboard.js) تعرضان
 * رسالة "أكمل البيانات أولاً" لنفس الحالة بالضبط — لأن كلتيهما كانتا تفحصان
 * state.revenue.streams يدوياً قبل أي حساب، بينما الملخص التنفيذي والمستشار الذكي لم
 * يكونا يفحصان شيئاً. هذه الدالة توحّد نفس الشرط في مصدر واحد تستورده الشاشات الأربع.
 *
 * @param {object} state - حالة الدراسة (store.getState())
 * @returns {boolean} true إن وُجد مصدر إيراد واحد على الأقل
 */
export function hasMinimumRevenueData(state) {
    return Array.isArray(state?.revenue?.streams) && state.revenue.streams.length > 0;
}

/**
 * hasMinimumFinancialData — يشترط وجود حد أدنى من بيانات التكلفة (رأسمالية أو تشغيلية
 * أو تمويل) إلى جانب hasMinimumRevenueData قبل عرض درجة القرار والتوصية.
 *
 * المشكلة الجذرية: hasMinimumRevenueData وحدها تشترط فقط مصدر إيراد واحد — دراسة فيها
 * مصدر إيراد وحيد بلا أي أصل رأسمالي (technical.equipment/buildings/furniture/vehicles)
 * ولا موظفين (hr.positions) ولا تمويل (financing) كانت تجتاز البوابة وتُنتج درجة/توصية
 * من calculateProjectScore رغم أن NPV/IRR/ROI فيه تُعوَّض بصفر لغياب البيانات لا لأنها
 * محسوبة فعلاً (core/scoring.js). نفحص هنا نفس الحقول التي تفحصها calculateReadiness
 * (DecisionDashboard.js) لبُعدَي "التمويل" و"الفريق" لتفادي ازدواجية المعايير بين البوابتين.
 *
 * @param {object} state - حالة الدراسة (store.getState())
 * @returns {boolean} true إن وُجد بند تكلفة رأسمالية أو تشغيلية أو تمويل واحد على الأقل
 */
export function hasMinimumFinancialData(state) {
    const technical = state?.technical || {};
    const hasCapexAssets = ['buildings', 'equipment', 'furniture', 'vehicles'].some(
        (key) => Array.isArray(technical[key]) && technical[key].length > 0
    );
    const hasTechResources = Array.isArray(state?.techResources?.techResources)
        && state.techResources.techResources.length > 0;
    const hasServiceCapex = Array.isArray(state?.services?.items)
        && state.services.items.some((s) => Number(s?.capex) > 0);
    const hasStaffing = Array.isArray(state?.hr?.positions) && state.hr.positions.length > 0;
    const sources = state?.financing?.sources || {};
    const hasFinancing = Number(state?.financing?.totalInvestment) > 0
        || Object.values(sources).some((src) => Number(src?.amount) > 0);

    return hasCapexAssets || hasTechResources || hasServiceCapex || hasStaffing || hasFinancing;
}
