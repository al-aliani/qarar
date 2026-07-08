/**
 * رياضيات اختبار التحمل (صدمة مبيعات/تكاليف ⇒ أشهر بقاء) — مصدر وحيد مشترك بين
 * شاشة اختبار التحمل (StressTest.js) وبوابة قرار GO/NO-GO (engine.js).
 */
export function computeStressSurvival(base, salesDropPct, costHikePct) {
    const sd = salesDropPct / 100, ch = costHikePct / 100;
    const impactedRevenue = base.monthlyRevenue * (1 - sd);
    // المتغيرة تتبع المبيعات هبوطاً وترتفع بصدمة التكاليف؛ الثابتة ترتفع بصدمة التكاليف فقط
    const impactedVariable = base.monthlyVariable * (1 - sd) * (1 + ch);
    const impactedFixed = base.monthlyFixed * (1 + ch);
    const netBurn = impactedFixed + impactedVariable + base.monthlyDebt - impactedRevenue;
    const months = netBurn <= 0 ? Infinity : (base.cashReserve / netBurn);
    return { netBurn, months };
}
