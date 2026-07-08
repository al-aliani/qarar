/**
 * درجة الخطر (احتمالية × أثر) — مصدر وحيد مشترك بين مصفوفة المخاطر (RiskMatrix.js)
 * وبوابة قرار GO/NO-GO (engine.js)، بدل نسخ الصيغة نفسها في أكثر من مكان.
 * الأثر مرجَّح أكثر من الاحتمالية (5 مقابل 3) — عدم تناظر متعمَّد.
 */
const PROB_SCORE = { low: 1, medium: 2, high: 3 };
const IMPACT_SCORE = { low: 1, medium: 3, high: 5 };

export function getRiskScore(probability, impact) {
    const p = PROB_SCORE[probability] ?? PROB_SCORE.low;
    const i = IMPACT_SCORE[impact] ?? IMPACT_SCORE.low;
    return p * i;
}

export function classifyRiskScore(score) {
    if (score >= 9) return 'critical';
    if (score >= 6) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
}
