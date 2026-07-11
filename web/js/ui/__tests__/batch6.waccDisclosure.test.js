/**
 * @vitest-environment jsdom
 *
 * دفعة 6 — WACC يُحسب ويُعرض في مكانين بصيغتين مختلفتين تماماً
 * (FinancingStructure.renderWACC: (E/V×Re)+(D/V×Rd×(1-T))، وValuationAnalysis:
 * max(baseRate+8%, 18%))، وكلاهما لا يُغذّي فعلياً discountRate الذي يستخدمه
 * engine.js لخصم NPV/IRR (المحرك يحسبه بشكل مستقل تماماً من assumptions.discountRate
 * + علاوة المخاطر). ثلاثة أرقام "معدل خصم" غير مرتبطة ببعضها قد تُضلّل المستخدم.
 *
 * هذا الاختبار (توثيقي فقط — لا يربط WACC بـdiscountRate تلقائياً، فذلك قرار
 * منتج أكبر من نطاق هذا الإصلاح) يتحقق من وجود إفصاح واضح ومرئي وموحَّد الصياغة
 * بجانب رقم WACC في كلا المكوّنين.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SECTIONS } from '../../core/schema.js';

const { FinancingStructure } = await import('../FinancingStructure.js');
const { ValuationAnalysis } = await import('../ValuationAnalysis.js');

function fakeStore(state) {
    return {
        getState: () => state,
        get: () => state,
        update: (key, value) => { state[key] = value; },
        updatePath: () => {},
    };
}

// دراسة تمثيلية (مطعم صغير) بها ما يكفي من بيانات كي يعمل المحرك دون أخطاء،
// وهيكل تمويل يمزج حقوق ملكية وقرضاً بنكياً كي تُحسب أوزان WACC فعلياً.
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
                bankLoan: { amount: 200000, interestRate: 0.08, years: 5 }
            },
            totalInvestment: 500000,
            costOfEquity: 0.15
        },
        techResources: [],
        legal: { licenses: [] }
    };
}

const DISCLOSURE_PATTERNS = [
    /إعلامي/, // "إعلامي لمرجعك الشخصي"
    /لا يُغذّي/, // "لا يُغذّي تلقائياً"
    /NPV/,
    /IRR/,
];

describe('FinancingStructure — إفصاح WACC لا يغذي discountRate', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('renderWACC() يعرض جملة إفصاح واضحة بجانب قيمة WACC', () => {
        const fs = Object.create(FinancingStructure.prototype);
        fs.store = { getState: () => representativeStudy() };
        const html = fs.renderWACC(representativeStudy().financing, 500000);

        expect(html).toContain('wacc-disclosure');
        for (const re of DISCLOSURE_PATTERNS) {
            expect(html).toMatch(re);
        }
        // يذكر تحديداً أن معدل الخصم يُضبط بشكل منفصل
        expect(html).toMatch(/معدل الخصم/);
    });

    it('الإفصاح ظاهر فعلياً (ليس بعرض 0 أو مخفياً) عند التصيير الكامل داخل DOM', () => {
        const store = fakeStore(representativeStudy());
        const view = new FinancingStructure('c', store, () => {});
        view.render();

        const el = document.querySelector('.wacc-disclosure');
        expect(el).not.toBeNull();
        expect(el.textContent.trim().length).toBeGreaterThan(0);
        expect(getComputedStyle(el).display).not.toBe('none');
        expect(el.closest('[hidden]')).toBeNull();
    });
});

describe('ValuationAnalysis — إفصاح WACC لا يغذي discountRate (نفس الصياغة)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('render() يعرض جملة إفصاح واضحة بجانب معدل الخصم/WACC المعروض في بطاقة DCF', () => {
        const store = fakeStore(representativeStudy());
        const view = new ValuationAnalysis('c', store);
        view.render();

        const el = document.querySelector('.wacc-disclosure');
        expect(el).not.toBeNull();
        const html = document.getElementById('c').innerHTML;

        expect(html).toContain('wacc-disclosure');
        for (const re of DISCLOSURE_PATTERNS) {
            expect(html).toMatch(re);
        }
        expect(html).toMatch(/معدل الخصم/);
    });

    it('الإفصاح ظاهر فعلياً (ليس مخفياً) في الشجرة المصيَّرة', () => {
        const store = fakeStore(representativeStudy());
        const view = new ValuationAnalysis('c', store);
        view.render();

        const el = document.querySelector('.wacc-disclosure');
        expect(el).not.toBeNull();
        expect(el.textContent.trim().length).toBeGreaterThan(0);
        expect(getComputedStyle(el).display).not.toBe('none');
        expect(el.closest('[hidden]')).toBeNull();
    });
});

describe('اتساق الصياغة بين المكوّنين', () => {
    it('نص الإفصاح في FinancingStructure وValuationAnalysis متطابق حرفياً (لا صيغتان مختلفتان تربكان المستخدم)', () => {
        const study = representativeStudy();

        const fs = Object.create(FinancingStructure.prototype);
        fs.store = { getState: () => study };
        const financingHtml = fs.renderWACC(study.financing, 500000);
        // نقرأ textContent (لا HTML الخام) كي تُجرَّد أيقونة i-warning الـsprite تماماً كما
        // تُجرَّد من textContent في نسخة Valuation أدناه — المقارنة على النص المرئي لا الوسم
        // (تدقيق تنظيف الإيموجي 2026-07-11: كانت ⚠️ محرفاً نصّياً حاضراً في الطرفين).
        document.body.innerHTML = `<div id="cf"></div>`;
        document.getElementById('cf').innerHTML = financingHtml;
        const financingEl = document.querySelector('.wacc-disclosure');
        expect(financingEl).not.toBeNull();
        const financingText = financingEl.textContent.replace(/\s+/g, ' ').trim();

        document.body.innerHTML = `<div id="c2"></div>`;
        const store2 = fakeStore(representativeStudy());
        const valuation = new ValuationAnalysis('c2', store2);
        valuation.render();
        const valuationEl = document.querySelector('.wacc-disclosure');
        const valuationText = valuationEl.textContent.replace(/\s+/g, ' ').trim();

        expect(financingText).toBe(valuationText);
    });
});
