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
