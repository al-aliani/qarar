/**
 * @vitest-environment jsdom
 *
 * ميزة جديدة: مقارنة سيناريوهات تمويل بديلة "ماذا-لو" (financing.comparisonScenarios[])
 * بجانب الهيكل الحي financing.sources — إضافية بحتة، يجب ألا تُعدّل financing.sources
 * الحية بأي شكل، ويجب أن تنتج WACC/NPV/IRR/DSCR مختلفة فعلياً بين سيناريو وآخر.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SECTIONS } from '../../core/schema.js';

const { FinancingStructure } = await import('../FinancingStructure.js');

function fakeStore(state) {
    return {
        getState: () => state,
        get: () => state,
        update: (key, value) => { state[key] = value; },
    };
}

// دراسة تمثيلية (مطعم صغير) تُنتج قوائم دخل صالحة كي يعمل المحرك دون رمي استثناء —
// نفس بنية الدراسة التمثيلية المستخدمة في batch6.waccDisclosure.test.js.
function representativeStudy() {
    return {
        [SECTIONS.PROJECT_INFO]: { name: 'مطعم تجريبي', sector: 'مطاعم', businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0 },
        technical: {
            equipment: [{ name: 'معدات', price: 200000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        hr: { positions: [{ position: 'مدير', count: 1, salary: 6000, months: 12, nationality: 'saudi' }] },
        logistics: { logistics: [] },
        administrative: { administrative: [{ name: 'إيجار', monthly: 10000 }] },
        marketing: { campaigns: [] },
        [SECTIONS.REVENUE]: { streams: [{ service: 'وجبات', type: 'operating', customersPerMonth: 1000, avgPrice: 30, variableCostRate: 0.35, growthRate: 0.05 }] },
        services: { items: [] },
        [SECTIONS.FINANCING]: {
            sources: {
                equity: { amount: 300000 },
                bankLoan: { amount: 200000, interestRate: 0.08, termYears: 5 }
            },
            totalInvestment: 500000,
            costOfEquity: 0.15
        },
        techResources: [],
        legal: { licenses: [] }
    };
}

describe('FinancingStructure.computeScenarioMetrics', () => {
    it('يحسب WACC/NPV/IRR/DSCR للوضع الحي عند sourcesOverride=null', () => {
        const fs = Object.create(FinancingStructure.prototype);
        const study = representativeStudy();
        const metrics = fs.computeScenarioMetrics(study, null);

        expect(Number.isFinite(metrics.wacc)).toBe(true);
        expect(Number.isFinite(metrics.npv)).toBe(true);
    });

    it('سيناريو بديل (حقوق ملكية أعلى، بلا قرض) ينتج WACC مختلفاً عن الوضع الحي، ويساوي تكلفة حقوق الملكية تماماً (لا دَين)', () => {
        const fs = Object.create(FinancingStructure.prototype);
        const study = representativeStudy();

        const liveMetrics = fs.computeScenarioMetrics(study, null);
        const equityOnlyMetrics = fs.computeScenarioMetrics(study, {
            equity: { amount: 500000 },
            bankLoan: { amount: 0, interestRate: 0.08, termYears: 5 }
        });

        expect(equityOnlyMetrics.wacc).not.toBeCloseTo(liveMetrics.wacc, 5);
        // بلا دين إطلاقاً: WACC = تكلفة حقوق الملكية وحدها (15% كما في الدراسة التمثيلية)
        expect(equityOnlyMetrics.wacc).toBeCloseTo(0.15, 5);
    });

    it('لا يُعدّل financing.sources الحية إطلاقاً بعد حساب سيناريو بديل', () => {
        const fs = Object.create(FinancingStructure.prototype);
        const study = representativeStudy();
        const originalSourcesSnapshot = JSON.stringify(study.financing.sources);

        fs.computeScenarioMetrics(study, {
            equity: { amount: 999999 },
            bankLoan: { amount: 111111, interestRate: 0.20, termYears: 2 }
        });

        expect(JSON.stringify(study.financing.sources)).toBe(originalSourcesSnapshot);
        expect(study.financing.sources.equity.amount).toBe(300000);
        expect(study.financing.sources.bankLoan.amount).toBe(200000);
    });

    it('سيناريوهان بديلان مختلفان (بنكي أعلى مقابل حقوق ملكية أعلى) ينتجان WACC مختلفَين بينهما', () => {
        const fs = Object.create(FinancingStructure.prototype);
        const study = representativeStudy();

        const bankHeavy = fs.computeScenarioMetrics(study, {
            equity: { amount: 100000 },
            bankLoan: { amount: 400000, interestRate: 0.08, termYears: 5 }
        });
        const equityHeavy = fs.computeScenarioMetrics(study, {
            equity: { amount: 450000 },
            bankLoan: { amount: 50000, interestRate: 0.08, termYears: 5 }
        });

        expect(bankHeavy.wacc).not.toBeCloseTo(equityHeavy.wacc, 5);
    });
});

describe('FinancingStructure.renderScenarioComparison', () => {
    it('يعرض صفّ "الوضع الحالي" دوماً بالإضافة لكل سيناريو مخزَّن في financing.comparisonScenarios', () => {
        const fs = Object.create(FinancingStructure.prototype);
        fs.formatCurrency = (n) => String(n || 0);
        const study = representativeStudy();
        study.financing.comparisonScenarios = [
            { label: 'بنكي', sources: { equity: { amount: 100000 }, bankLoan: { amount: 400000, interestRate: 0.08, termYears: 5 } } },
            { label: 'حقوق ملكية أعلى', sources: { equity: { amount: 450000 }, bankLoan: { amount: 50000, interestRate: 0.08, termYears: 5 } } }
        ];

        const html = fs.renderScenarioComparison(study);

        expect(html).toContain('الوضع الحالي');
        expect(html).toContain('بنكي');
        expect(html).toContain('حقوق ملكية أعلى');
        // زر الحذف يظهر للسيناريوهات المخزَّنة فقط (فهرسان: 0 و1) لا للصف الحي
        expect(html).toContain('data-index="0"');
        expect(html).toContain('data-index="1"');
    });

    it('بلا أي سيناريو مخزَّن: يعرض صفّ الوضع الحالي فقط ونموذج إضافة سيناريو', () => {
        const fs = Object.create(FinancingStructure.prototype);
        fs.formatCurrency = (n) => String(n || 0);
        const study = representativeStudy();

        const html = fs.renderScenarioComparison(study);

        expect(html).toContain('الوضع الحالي');
        expect(html).toContain('id="btnAddScenario"');
        expect(html).not.toContain('scenario-remove');
    });
});

describe('FinancingStructure — تكامل إضافة/حذف سيناريو عبر الواجهة الكاملة', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('إضافة سيناريو جديد عبر الزر تُخزّنه في financing.comparisonScenarios دون المساس بـ financing.sources الحية', () => {
        const study = representativeStudy();
        const store = fakeStore(study);
        const view = new FinancingStructure('c', store, () => {});
        view.render();

        document.getElementById('scenario-label').value = 'صندوق التنمية الصناعية';
        document.getElementById('scenario-equity').value = '150000';
        document.getElementById('scenario-loan-amount').value = '350000';
        document.getElementById('scenario-loan-rate').value = '4';
        document.getElementById('scenario-loan-term').value = '7';
        document.getElementById('btnAddScenario').click();

        const updated = store.getState();
        expect(Array.isArray(updated.financing.comparisonScenarios)).toBe(true);
        expect(updated.financing.comparisonScenarios.length).toBe(1);
        expect(updated.financing.comparisonScenarios[0].label).toBe('صندوق التنمية الصناعية');
        expect(updated.financing.comparisonScenarios[0].sources.bankLoan.amount).toBe(350000);
        expect(updated.financing.comparisonScenarios[0].sources.bankLoan.interestRate).toBeCloseTo(0.04, 5);

        // لم تتغير مصادر التمويل الحية إطلاقاً
        expect(updated.financing.sources.equity.amount).toBe(300000);
        expect(updated.financing.sources.bankLoan.amount).toBe(200000);
    });

    it('حذف سيناريو مخزَّن يزيله من القائمة فقط', () => {
        const study = representativeStudy();
        study.financing.comparisonScenarios = [
            { label: 'بنكي', sources: { equity: { amount: 100000 }, bankLoan: { amount: 400000, interestRate: 0.08, termYears: 5 } } }
        ];
        const store = fakeStore(study);
        const view = new FinancingStructure('c', store, () => {});
        view.render();

        document.querySelector('.scenario-remove[data-index="0"]').click();

        const updated = store.getState();
        expect(updated.financing.comparisonScenarios.length).toBe(0);
    });
});
