/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-08-24 (نسخة أولى): خانة use-wacc-discount-rate تُفعِّل فعلياً استخدام WACC
 * كمعدل خصم NPV/IRR، لكن نص wacc-disclosure كان ثابتاً يقول دوماً إن الرقم "إعلامي فقط
 * ولا يُغذّي" معدل الخصم الفعلي — أي يكذب حين تكون الخانة مفعّلة. الإصلاح: النص يتبدّل
 * حسب حالة الخانة، حياً عند تغييرها (لا فقط عند التحميل الأول).
 *
 * تصحيح لاحق 2026-08-24 (نفس اليوم): تبيّن أن استخدام WACC نفسه لخصم تدفق FCFE (بعد خدمة
 * الدين، توثيق engine.js 2026-07-06) كان خلطاً منهجياً يزدوج أثر عبء الدين. الخانة (نفس
 * معرّف useWaccAsDiscountRate، حفاظاً على توافق البيانات المحفوظة) تُفعِّل الآن تكلفة
 * حقوق الملكية (Re) كمعدل الخصم بدل WACC — انظر engine.js وتعليق baseDiscountRate هناك.
 * هذا الاختبار يتحقق من أنماط نصية عامة (إعلامي/مُعتمد الآن فعلياً) لا تتأثر بهذا التغيير.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FinancingStructure } from '../FinancingStructure.js';
import { SECTIONS } from '../../core/schema.js';

function fakeStore(state) {
    return {
        getState: () => state,
        update: (key, value) => { state[key] = value; },
        updatePath: () => {},
    };
}

const financingFixture = {
    sources: {
        equity: { amount: 300000 },
        bankLoan: { amount: 200000, interestRate: 0.08 }
    },
    costOfEquity: 0.15
};

function studyWith(useWaccAsDiscountRate) {
    return { financing: financingFixture, assumptions: { useWaccAsDiscountRate } };
}

// دراسة كاملة كافية لتشغيل render() الكامل دون أخطاء (مطابقة لتركيبة الدراسة
// التمثيلية في batch6.waccDisclosure.test.js).
function representativeStudy(useWaccAsDiscountRate) {
    return {
        [SECTIONS.PROJECT_INFO]: { name: 'مطعم تجريبي', sector: 'مطاعم', businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0, useWaccAsDiscountRate },
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
        [SECTIONS.FINANCING]: { sources: financingFixture.sources, totalInvestment: 500000, costOfEquity: 0.15 },
        techResources: [],
        legal: { licenses: [] }
    };
}

describe('FinancingStructure.renderWACC — نص الإفصاح يعكس حالة الخانة', () => {
    it('الخانة غير مفعّلة: يعرض التحذير الأصلي "إعلامي فقط" ولا يعرض رسالة الاعتماد', () => {
        const fs = Object.create(FinancingStructure.prototype);
        fs.store = { getState: () => studyWith(false) };
        const html = fs.renderWACC(studyWith(false).financing, 500000);

        expect(html).toMatch(/إعلامي/);
        expect(html).not.toMatch(/مُعتمد الآن فعلياً/);
    });

    it('الخانة مفعّلة: يعرض رسالة الاعتماد الفعلي ولا يعرض التحذير الأصلي', () => {
        const fs = Object.create(FinancingStructure.prototype);
        fs.store = { getState: () => studyWith(true) };
        const html = fs.renderWACC(studyWith(true).financing, 500000);

        expect(html).toMatch(/مُعتمد الآن فعلياً كمعدل الخصم/);
        expect(html).toMatch(/NPV/);
        expect(html).toMatch(/IRR/);
        expect(html).not.toMatch(/إعلامي لمرجعك الشخصي فقط/);
    });
});

describe('FinancingStructure — تبديل النص حياً عند تغيير الخانة داخل DOM', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('تفعيل الخانة يبدّل النص فوراً من التحذير إلى رسالة الاعتماد دون إعادة تحميل', () => {
        const store = fakeStore(representativeStudy(false));
        const view = new FinancingStructure('c', store, () => {});
        view.render();

        const checkbox = document.getElementById('use-wacc-discount-rate');
        expect(checkbox.checked).toBe(false);
        expect(document.querySelector('.wacc-disclosure').textContent).toMatch(/إعلامي/);

        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));

        expect(store.getState().assumptions.useWaccAsDiscountRate).toBe(true);
        const disclosureAfter = document.querySelector('.wacc-disclosure');
        expect(disclosureAfter.textContent).toMatch(/مُعتمد الآن فعلياً كمعدل الخصم/);
        expect(disclosureAfter.textContent).not.toMatch(/إعلامي لمرجعك الشخصي فقط/);
    });
});
