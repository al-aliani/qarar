/**
 * تدقيق جولة الموقع 2026-07-20 (بند #6): «هامش الأمان لنقطة التعادل» كان يعرض 100%
 * (أمان مثالي) لمشروع يخسر على كل وحدة. السبب: engine يضع breakEvenPointValue=0 في
 * حالتين متعاكستين — تعادل مستحيل (هامش مساهمة ≤ 0) أو بلا تكاليف ثابتة — ولوحة القرار
 * تحسب max(0, 1 − 0/إيراد) = 100% للحالتين. الإصلاح: علَم breakEvenAchievable=cmRatio>0
 * يميّز الحالتين، فتعرض اللوحة «—» بدل نسبة أمان كاذبة عند استحالة التعادل.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';

function makeStudy(streamOverride) {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ price: 100000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, growthRate: 0, ...streamOverride }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

describe('المحرك — قابلية التعادل (breakEvenAchievable)', () => {
    it('هامش مساهمة موجب (تكلفة متغيرة 30%): breakEvenAchievable=true وقيمة تعادل موجبة', () => {
        const r = calculateStudy(makeStudy({ variableCostRate: 0.30 }));
        expect(r.indicators.breakEvenAchievable).toBe(true);
        expect(r.indicators.breakEvenPointValue).toBeGreaterThan(0);
    });

    it('يخسر على كل وحدة (متغيرة+هدر = 120% > السعر): breakEvenAchievable=false وقيمة تعادل=0', () => {
        // مجموع التكاليف المتغيرة 0.90 + 0.30 = 1.20 من الإيراد ⇒ هامش مساهمة سالب
        const r = calculateStudy(makeStudy({ variableCostRate: 0.90, wasteRate: 0.30 }));
        expect(r.indicators.breakEvenAchievable).toBe(false);
        expect(r.indicators.breakEvenPointValue).toBe(0);
    });
});
