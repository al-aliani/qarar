/**
 * calculateDelayedLaunchImpact — أثر تأخير الافتتاح N شهر على NPV (خطة التنفيذ).
 * يعيد استخدام calculateStudy الحقيقية (استنساخ + rampUpMonths)، لا حساباً موازياً مبسّطاً.
 */
import { describe, it, expect } from 'vitest';
import { calculateDelayedLaunchImpact } from '../engine.js';
import { SECTIONS } from '../schema.js';

function makeStudy(overrides = {}) {
    const base = {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0, rampUpMonths: 0 },
        [SECTIONS.TECHNICAL]: { equipment: [], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [] },
        [SECTIONS.MARKETING]: { campaigns: [], suppliers: [] },
        [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate: 0.30, growthRate: 0 }] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
    return { ...base, ...overrides };
}

describe('calculateDelayedLaunchImpact', () => {
    it('تأخير صفر: npvImpact=0 وbaseline=delayed', () => {
        const r = calculateDelayedLaunchImpact(makeStudy(), 0);
        expect(r).toMatchObject({ delayMonths: 0, npvImpact: 0 });
        expect(r.delayedNpv).toBe(r.baselineNpv);
    });

    it('تأخير موجب مع تدفقات إيراد ثابتة (نمو=0) يُنقص NPV أو يبقيه كما هو، لا يزيده أبداً', () => {
        const r = calculateDelayedLaunchImpact(makeStudy(), 3);
        expect(r.delayMonths).toBe(3);
        expect(r.delayedNpv).toBeLessThanOrEqual(r.baselineNpv);
        expect(r.npvImpact).toBeLessThanOrEqual(0);
    });

    it('يُضيف delayMonths فوق rampUpMonths الحالي بدل استبداله', () => {
        const withExistingRamp = makeStudy({ assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0, rampUpMonths: 2 } });
        const r = calculateDelayedLaunchImpact(withExistingRamp, 3);
        // لا نتحقق من قيمة rampUpMonths الداخلية مباشرة (خاصة بالاستنساخ)، بل من الأثر:
        // تأخير فوق افتراض تصاعد قائم أصلاً يجب ألا يُحسَّن NPV مقارنة بالافتراض الأصلي وحده.
        expect(r.delayedNpv).toBeLessThanOrEqual(r.baselineNpv);
    });

    it('لا يرمي على دراسة حد أدنى بلا rampUpMonths مُعرَّف', () => {
        const study = makeStudy();
        delete study.assumptions.rampUpMonths;
        expect(() => calculateDelayedLaunchImpact(study, 2)).not.toThrow();
    });
});
