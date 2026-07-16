/**
 * @vitest-environment jsdom
 *
 * FundingSimulator (محاكي أهلية بنك التنمية الاجتماعية) كان معزولاً تماماً عن أرقام
 * المحرك المالي الحقيقية. computeEligibilityScore (دالة نقية جديدة) يضيف مدخلين
 * اختياريين فوق القواعد الأصلية: DSCR محسوب فعلياً + قيمة الضمانات — يجب أن يحسّنا
 * النتيجة عند توفرهما، ولا يؤثرا إطلاقاً عند غيابهما (توافق خلفي كامل مع الاستدعاء القديم).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SECTIONS } from '../../core/schema.js';

const { computeEligibilityScore, FundingSimulator } = await import('../widgets/FundingSimulator.js');

function baseRules(overrides = {}) {
    return { age: 30, nationality: 'saudi', isEmployed: false, hasDefaults: false, sector: '', ...overrides };
}

describe('computeEligibilityScore — القواعد الأساسية (توافق خلفي بلا مدخلات إضافية)', () => {
    it('ملف مثالي بلا مدخلات DSCR/ضمانات: النتيجة 100 كالسابق تماماً', () => {
        const { score, status, reasons } = computeEligibilityScore(baseRules());
        expect(score).toBe(100);
        expect(status).toBe('high');
        expect(reasons.some(r => r.includes('تغطية خدمة الدين'))).toBe(false);
        expect(reasons.some(r => r.includes('ضمانات موثّقة'))).toBe(false);
    });

    it('الاستدعاء بلا أي وسيطات إضافية (computedDscr/targetDSCR/guaranteesValue) يطابق تماماً استدعاءً بها كـnull/0 صراحة', () => {
        const implicit = computeEligibilityScore(baseRules({ isEmployed: true }));
        const explicit = computeEligibilityScore(baseRules({ isEmployed: true, computedDscr: null, targetDSCR: null, guaranteesValue: 0 }));
        expect(implicit.score).toBe(explicit.score);
        expect(implicit.status).toBe(explicit.status);
        expect(implicit.reasons).toEqual(explicit.reasons);
    });

    it('موظف (isEmployed) يخصم 10 كالسابق تماماً بلا أي مدخل إضافي', () => {
        const { score } = computeEligibilityScore(baseRules({ isEmployed: true }));
        expect(score).toBe(90);
    });
});

describe('computeEligibilityScore — امتداد DSCR/الضمانات (إضافي، لا يكسر القديم)', () => {
    it('DSCR محسوب صحي (≥ المستهدف) يحسّن النتيجة', () => {
        const withoutDscr = computeEligibilityScore(baseRules({ isEmployed: true }));
        const withHealthyDscr = computeEligibilityScore(baseRules({ isEmployed: true, computedDscr: 1.6, targetDSCR: 1.25 }));
        expect(withHealthyDscr.score).toBeGreaterThan(withoutDscr.score);
        expect(withHealthyDscr.reasons.some(r => r.includes('تفوق المستهدف'))).toBe(true);
    });

    it('DSCR محسوب دون المستهدف يخفّض النتيجة (لا يحسّنها)', () => {
        const withoutDscr = computeEligibilityScore(baseRules({ isEmployed: true }));
        const withWeakDscr = computeEligibilityScore(baseRules({ isEmployed: true, computedDscr: 0.8, targetDSCR: 1.25 }));
        expect(withWeakDscr.score).toBeLessThan(withoutDscr.score);
        expect(withWeakDscr.reasons.some(r => r.includes('أقل من المستهدف'))).toBe(true);
    });

    it('وجود ضمانات موثّقة (قيمة > 0) يحسّن النتيجة', () => {
        const without = computeEligibilityScore(baseRules({ isEmployed: true }));
        const withGuarantees = computeEligibilityScore(baseRules({ isEmployed: true, guaranteesValue: 150000 }));
        expect(withGuarantees.score).toBeGreaterThan(without.score);
        expect(withGuarantees.reasons.some(r => r.includes('ضمانات موثّقة'))).toBe(true);
    });

    it('النتيجة لا تتجاوز 100 حتى مع تراكم كل التحسينات', () => {
        const { score } = computeEligibilityScore(baseRules({ computedDscr: 3, targetDSCR: 1.25, guaranteesValue: 500000 }));
        expect(score).toBe(100);
    });

    it('حالة الرفض (جنسية غير سعودية) تبقى صفراً ولا تتأثر بـDSCR/الضمانات إطلاقاً', () => {
        const { score, status, reasons } = computeEligibilityScore(
            baseRules({ nationality: 'resident', computedDscr: 5, targetDSCR: 0.1, guaranteesValue: 500000 })
        );
        expect(score).toBe(0);
        expect(status).toBe('rejected');
        expect(reasons.some(r => r.includes('تفوق المستهدف'))).toBe(false);
        expect(reasons.some(r => r.includes('ضمانات موثّقة'))).toBe(false);
    });
});

// دراسة تمثيلية (مطعم صغير) صالحة لتشغيل المحرك دون استثناء — نفس بنية الدراسات
// التمثيلية المستخدمة في اختبارات FinancingStructure/ValuationAnalysis الأخرى.
function representativeStudy({ loanAmount, guarantees, targetDSCR } = {}) {
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
                bankLoan: { amount: loanAmount || 0, interestRate: 0.08, termYears: 5 }
            },
            guarantees: guarantees || [],
            targetDSCR: targetDSCR ?? 1.25,
            totalInvestment: 500000,
            costOfEquity: 0.15
        },
        techResources: [],
        legal: { licenses: [] },
        projectInfo: { sector: 'مطاعم' }
    };
}

function fakeStore(state) {
    return { get: () => state, getState: () => state };
}

function readScorePercent(container) {
    const text = container.querySelector('#simResult').textContent;
    const match = text.match(/(\d+)%/);
    return match ? Number(match[1]) : null;
}

describe('FundingSimulator (تكامل الواجهة الكاملة) — يقرأ DSCR/الضمانات من المتجر فعلياً', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('دراسة بقرض بنكي وضمانات موثّقة (وDSCR مستهدف منخفض) تعطي نتيجة أعلى من دراسة مطابقة بلا قرض ولا ضمانات', () => {
        // isEmployed=true يخصم 10 نقاط من الأساس (100→90) — يفتح هامشاً كي يظهر أثر
        // تحسين DSCR/الضمانات فعلياً بدل أن يُبتلع بسقف 100% (الملف الافتراضي مثالي أصلاً).
        const withLoanStudy = representativeStudy({ loanAmount: 200000, guarantees: [{ type: 'mortgage', value: 250000 }], targetDSCR: 0.5 });
        const withoutLoanStudy = representativeStudy({ loanAmount: 0, guarantees: [], targetDSCR: 1.25 });

        const viewWithLoan = new FundingSimulator('c', fakeStore(withLoanStudy));
        viewWithLoan.render();
        document.getElementById('simGov').checked = true;
        viewWithLoan.calculateEligibility();
        const scoreWithLoan = readScorePercent(document.getElementById('c'));

        document.body.innerHTML = `<div id="c"></div>`;
        const viewWithoutLoan = new FundingSimulator('c', fakeStore(withoutLoanStudy));
        viewWithoutLoan.render();
        document.getElementById('simGov').checked = true;
        viewWithoutLoan.calculateEligibility();
        const scoreWithoutLoan = readScorePercent(document.getElementById('c'));

        expect(scoreWithLoan).toBeGreaterThan(scoreWithoutLoan);
    });

    it('دراسة بلا أي بيانات تمويل (لا قرض ولا ضمانات): النتيجة تبقى مطابقة للقواعد الأساسية فقط (100 للملف الافتراضي)', () => {
        const emptyStudy = { projectInfo: {} };
        const view = new FundingSimulator('c', fakeStore(emptyStudy));
        view.render();
        expect(() => view.calculateEligibility()).not.toThrow();
        const score = readScorePercent(document.getElementById('c'));
        expect(score).toBe(100);
    });
});
