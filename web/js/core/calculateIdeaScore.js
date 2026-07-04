/**
 * Idea Score — نتيجة الفكرة (0–100)
 * تُقيّم قوة فكرة المشروع قبل البدء بالتقرير الكامل.
 * تعتمد على: اكتمال البيانات، هامش الربح المتوقع، وحجم السوق (TAM).
 */

import { calculateStudyCompleteness } from '../utils/studyCompleteness.js';
import { calculateStudy } from './engine.js';

/**
 * حساب نتيجة الفكرة من 0 إلى 100
 * @param {Object} state - حالة الدراسة (store.getState())
 * @param {Object} [results] - نتيجة المحرك (إن وُجدت) لتجنب إعادة التشغيل
 * @returns {{ score: number, color: 'red'|'yellow'|'green', breakdown: { completeness: number, margin: number, tam: number }, message: string }}
 */
export function calculateIdeaScore(state, results = null) {
    if (!state) return { score: 0, color: 'red', breakdown: { completeness: 0, margin: 0, tam: 0 }, message: 'لا توجد بيانات' };

    const breakdown = { completeness: 0, margin: 0, tam: 0 };

    // 1) اكتمال البيانات — وزن 40%
    const completenessData = calculateStudyCompleteness(state);
    const completenessPct = Math.min(100, Math.max(0, completenessData.percentage ?? 0));
    breakdown.completeness = Math.round((completenessPct / 100) * 40);

    // 2) هامش الربح المتوقع — وزن 30%
    // Number(undefined) = NaN وليس null، فـ ?? لا يلتقطها — نستخدم حارس Finite صريحاً
    const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    let marginScore = 0;
    if (results && typeof results.indicators === 'object') {
        const netMargin = safeNum(results.indicators.netMargin);
        if (netMargin >= 0.20) marginScore = 30;
        else if (netMargin >= 0.15) marginScore = 25;
        else if (netMargin >= 0.10) marginScore = 20;
        else if (netMargin >= 0.05) marginScore = 12;
        else if (netMargin > 0) marginScore = 6;
    } else {
        try {
            const res = calculateStudy(state);
            if (res && res.indicators) {
                const netMargin = safeNum(res.indicators.netMargin);
                if (netMargin >= 0.20) marginScore = 30;
                else if (netMargin >= 0.15) marginScore = 25;
                else if (netMargin >= 0.10) marginScore = 20;
                else if (netMargin >= 0.05) marginScore = 12;
                else if (netMargin > 0) marginScore = 6;
            }
        } catch (_) {
            // لا نتائج مالية بعد — نعطي جزءاً من النقاط حسب وجود إيرادات وتكاليف
            const rev = state.revenue?.streams?.length || state.revenue?.revenueStreams?.length || 0;
            const hasCosts = !!(state.technical?.equipment?.length || state.hr?.positions?.length);
            if (rev > 0 && hasCosts) marginScore = 10;
            else if (rev > 0 || hasCosts) marginScore = 5;
        }
    }
    breakdown.margin = marginScore;

    // 3) حجم السوق (TAM) — وزن 30%
    const tamRaw = state.marketSizing?.tam?.value ?? state.marketSizing?.tam ?? 0;
    const tamNum = typeof tamRaw === 'object' ? (tamRaw.value ?? tamRaw) : Number(tamRaw) || 0;
    let tamScore = 0;
    if (tamNum > 0) {
        if (tamNum >= 10_000_000) tamScore = 30;
        else if (tamNum >= 1_000_000) tamScore = 24;
        else if (tamNum >= 500_000) tamScore = 20;
        else if (tamNum >= 100_000) tamScore = 15;
        else if (tamNum >= 50_000) tamScore = 10;
        else tamScore = 5;
    }
    breakdown.tam = tamScore;

    const score = Math.min(100, Math.round(breakdown.completeness + breakdown.margin + breakdown.tam));

    let color = 'red';
    if (score >= 71) color = 'green';
    else if (score >= 41) color = 'yellow';

    let message = 'فكرة في بدايتها';
    if (score >= 71) message = 'فكرة قوية';
    else if (score >= 41) message = 'فكرة جيدة — يمكن تحسينها';

    return { score, color, breakdown, message };
}
