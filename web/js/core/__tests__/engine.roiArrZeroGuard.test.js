/**
 * تدقيق 2026-07-08 (ملاحظة متوسطة #6): roi/arr في engine.js كانا يُقسمان على
 * totalInvestment بلا حارس صفر (خلافاً لـ pi/roa/roe المجاورة التي تحمي صراحةً) —
 * دراسة جديدة بلا أي بيانات استثمارية بعد (totalInvestment=0) كانت تُنتج
 * NaN/Infinity تُعرض حرفياً "NaN%"/"Infinity%" في الملخص التنفيذي وتحليل المستثمر.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';

function zeroInvestmentStudy() {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 3, discountRate: 0.10, inflationRate: 0, hiddenOverheadsRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: [], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        // دفق إيراد بسعر/عملاء صفريين ⇒ إيراد صفري ⇒ لا مصدر لرأس مال عامل أيضاً
        [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 0, avgPrice: 0, variableCostRate: 0.30, growthRate: 0 }] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

describe('engine.js — roi/arr لا تُنتج NaN/Infinity عند استثمار صفري (#6)', () => {
    it('totalInvestment=0 فعلياً في هذه الدراسة (تأكيد صريح لصحة سيناريو الاختبار)', () => {
        const r = calculateStudy(zeroInvestmentStudy());
        expect(r.capex.total).toBe(0);
    });

    it('indicators.roi يُعيد 0 لا NaN/Infinity حين totalInvestment=0', () => {
        const r = calculateStudy(zeroInvestmentStudy());
        expect(r.indicators.roi).toBe(0);
        expect(Number.isFinite(r.indicators.roi)).toBe(true);
    });

    it('indicators.arr/annualROI يُعيدان 0 لا NaN/Infinity حين totalInvestment=0', () => {
        const r = calculateStudy(zeroInvestmentStudy());
        expect(r.indicators.arr).toBe(0);
        expect(r.indicators.annualROI).toBe(0);
        expect(Number.isFinite(r.indicators.arr)).toBe(true);
    });

    it('استثمار حقيقي موجب لا يزال يحسب roi/arr بشكل صحيح كما كان', () => {
        const study = zeroInvestmentStudy();
        study[SECTIONS.TECHNICAL].equipment = [{ price: 100000, quantity: 1 }];
        study[SECTIONS.REVENUE].streams = [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate: 0.30, growthRate: 0 }];
        const r = calculateStudy(study);
        expect(r.capex.total).toBeGreaterThan(0);
        expect(Number.isFinite(r.indicators.roi)).toBe(true);
        expect(r.indicators.roi).not.toBe(0);
    });
});
