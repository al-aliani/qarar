/**
 * تدقيق شامل 2026-09-16: قسم "تكلفة رأس المال المرجح" في مؤشرات تصدير Excel
 * (excelExporter.js:573-577 يقرأ results.wacc.equityWeight/debtWeight/costOfEquity/
 * costOfDebtPostTax/wacc) كان فارغاً دائماً لكل دراسة على الإطلاق — calculateStudy
 * لا يستدعي calculateFinancingWACC/computeWaccBreakdown إطلاقاً، فـresults.wacc غير
 * معرَّف أصلاً. الدالة الوحيدة المُستهلكة فعلياً (calculateFinancingWACC) تُستدعى فقط
 * من FinancingStructure.js للعرض الإرشادي، ولا تُغذّي discountRate عمداً (انظر تعليق
 * "تصحيح 2026-08-24" في engine.js: FCFE يُخصَم بتكلفة حقوق الملكية وحدها، لا WACC —
 * هذا الإصلاح لا يمسّ ذلك القرار إطلاقاً، فقط يملأ results.wacc للعرض/التصدير.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy, computeWaccBreakdown, calculateFinancingWACC } from '../engine.js';
import { SECTIONS, createEmptyStudy } from '../schema.js';

function studyWithMixedFinancing() {
    const s = createEmptyStudy();
    s[SECTIONS.PROJECT_INFO] = { ...s[SECTIONS.PROJECT_INFO], name: 'دراسة تمويل مختلط' };
    s.assumptions = { ...s.assumptions, projectionYears: 5, discountRate: 0.10 };
    s[SECTIONS.TECHNICAL] = { equipment: [{ name: 'معدات', price: 250000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
    s[SECTIONS.HR] = { positions: [{ position: 'مدير', count: 1, salary: 8000, months: 12, nationality: 'saudi' }] };
    s[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 8000 }] };
    s[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 1000, avgPrice: 40, variableCostRate: 0.35, growthRate: 0.03 }] };
    s[SECTIONS.FINANCING] = {
        sources: {
            equity: { amount: 150000 },
            bankLoan: { amount: 100000, interestRate: 0.08, termYears: 5 },
        },
        totalInvestment: 250000,
        costOfEquity: 0.15,
    };
    return s;
}

describe('calculateStudy — results.wacc يصل فعلياً (كان undefined دائماً)', () => {
    it('دراسة بتمويل مختلط: results.wacc يحمل التفصيل الكامل، لا undefined', () => {
        const results = calculateStudy(studyWithMixedFinancing());
        expect(results.wacc).not.toBeUndefined();
        expect(results.wacc).not.toBeNull();
        expect(results.wacc.equityWeight).toBeCloseTo(0.6, 5); // 150k / 250k
        expect(results.wacc.debtWeight).toBeCloseTo(0.4, 5);   // 100k / 250k
        expect(results.wacc.costOfEquity).toBeCloseTo(0.15, 5);
        expect(results.wacc.wacc).toBeGreaterThan(0);
    });

    it('results.wacc.wacc يطابق calculateFinancingWACC(study) — مصدر واحد، لا صيغتان قد تتباعدان', () => {
        const study = studyWithMixedFinancing();
        const results = calculateStudy(study);
        expect(results.wacc.wacc).toBeCloseTo(calculateFinancingWACC(study), 10);
    });

    it('لا انحدار: calculateFinancingWACC (المستهلكة في FinancingStructure.js) ما زالت تُعيد رقماً مباشراً لا كائناً', () => {
        const study = studyWithMixedFinancing();
        expect(typeof calculateFinancingWACC(study)).toBe('number');
    });

    it('دراسة بلا أي تمويل مُدخَل: results.wacc = null (لا كائن بقيم NaN/صفر مضلِّلة)', () => {
        const s = studyWithMixedFinancing();
        s[SECTIONS.FINANCING] = { sources: {} };
        const results = calculateStudy(s);
        expect(results.wacc).toBeNull();
        expect(computeWaccBreakdown(s)).toBeNull();
    });
});
