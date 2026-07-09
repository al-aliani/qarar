/**
 * دفعة 6 — ذمم العملاء (Accounts Receivable) في الميزانية العمومية.
 *
 * lib/calc/balanceSheet.js كان يضع accountsReceivable = 0 دائماً ("// Simplified")
 * حتى عندما تُدخِل الدراسة سياسة تحصيل آجل صريحة (DSO) يحسب المحرك (engine.js)
 * من أجلها رقماً حقيقياً في study.cashCycle.receivables. نقطة الاستدعاء
 * (generateBalanceSheets) لم تكن تُمرّر cashCycle إطلاقاً.
 *
 * هذا الاختبار يتحقق من طرفين:
 *  1) دراسة بلا سياسة تحصيل آجل (DSO/DIO/DPO كلها صفر/غائبة) ⇒ لا يوجد cashCycle
 *     ⇒ accountsReceivable تبقى 0 بحق (لا افتراضات مصطنعة).
 *  2) دراسة B2B بتحصيل آجل 60 يوماً ⇒ accountsReceivable في الميزانية العمومية
 *     غير صفرية وتطابق تماماً رقم المحرك cashCycle.receivables (لكل سنوات الأفق)،
 *     مع بقاء الميزانية متوازنة (Assets = Liabilities + Equity + fundingGap).
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../../../web/js/core/engine.js';
import { SECTIONS } from '../../../web/js/core/schema.js';

function makeStudy(overrides = {}) {
    const base = {
        [SECTIONS.PROJECT_INFO]: { name: 'كافيه', sector: 'مقهى', businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ name: 'معدات', price: 100000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [{ position: 'مدير', count: 1, salary: 6000, months: 12, nationality: 'saudi' }] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 10000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ service: 'مشروبات', type: 'operating', customersPerMonth: 3000, avgPrice: 22, variableCostRate: 0.32, growthRate: 0.05 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
    return { ...base, ...overrides };
}

describe('balanceSheet — accountsReceivable من الدورة النقدية الفعلية (لا صفر ثابت)', () => {
    it('بلا سياسة DSO ⇒ لا cashCycle ⇒ accountsReceivable تبقى 0 (لا تغيير قسري)', () => {
        const r = calculateStudy(makeStudy());
        expect(r.cashCycle).toBeNull();
        expect(r.balanceSheets.length).toBeGreaterThan(0);
        r.balanceSheets.forEach(bs => {
            expect(bs.assets.current.accountsReceivable).toBe(0);
        });
    });

    it('B2B بتحصيل آجل 60 يوماً ⇒ accountsReceivable في كل سنوات الميزانية = cashCycle.receivables (مُقرَّبة)، والميزانية متوازنة', () => {
        const r = calculateStudy(makeStudy({
            assumptions: {
                projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0,
                workingCapitalPolicy: { dsoDays: 60, dpoDays: 30, dioDays: 15 }
            }
        }));

        expect(r.cashCycle).toBeTruthy();
        expect(r.cashCycle.receivables).toBeGreaterThan(0);

        const expectedAR = Math.round(r.cashCycle.receivables);
        expect(r.balanceSheets.length).toBe(5);
        r.balanceSheets.forEach(bs => {
            expect(bs.assets.current.accountsReceivable).toBe(expectedAR);
            // AR ليست صفراً (العلة الأصلية) وتساهم فعلياً في إجمالي الأصول المتداولة
            expect(bs.assets.current.accountsReceivable).toBeGreaterThan(0);
            // الميزانية تبقى متوازنة رغم إضافة سطر AR صريح (لم تُحتسب مرتين)
            expect(bs.isBalanced, `السنة ${bs.year} غير متوازنة بفرق ${bs.imbalance}`).toBe(true);
        });
    });
});
