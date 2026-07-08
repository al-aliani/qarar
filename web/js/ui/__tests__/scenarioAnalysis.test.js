/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (مهندس الجودة): ScenarioAnalysis.js كان بتغطية 0% تامة. هذا
 * يغطي: أن بطاقات المتشائم/الأساسي/المتفائل تستخدم فعلياً calculateStudy الحقيقي
 * (لا أرقاماً مفبركة كما وثّق تعليق الملف عن الدوال الثلاث المحذوفة)، أن السيناريو
 * الأساسي يقرأ دائماً من نتيجة الحساب الرئيسي (لا حساب منفصل يتجاهل حالة الدراسة
 * الفعلية)، حدود حكم الجدوى (verdict) عند الصفر بالضبط، وأن تحديث مدخلات السيناريو
 * يدمج الحقل المتغيّر فقط دون طمس بقية حقول نفس السيناريو.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScenarioAnalysis } from '../ScenarioAnalysis.js';
import { calculateStudy } from '../../core/engine.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return {
        getState: () => state,
        update: vi.fn((key, value) => { state = { ...state, [key]: value }; })
    };
}

// دراسة هامشية عمداً: الأساس موجب، لكن المتشائم (-20% إيراد و+15% تكاليف معاً)
// ينقلب سالباً فعلياً — يثبت مسار verdict-warning حقيقياً لا نظرياً فقط.
function marginalStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], businessModel: 'Independent' };
    data.assumptions = { ...data.assumptions, projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 300000, quantity: 1 }], buildings: [], furniture: [{ price: 50000, quantity: 1 }], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'شيف', count: 3, salary: 5000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 12000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 700, avgPrice: 100, variableCostRate: 0.30, growthRate: 0.03 }] };
    data[SECTIONS.SERVICES] = { items: [] };
    data[SECTIONS.FINANCING] = { sources: { equity: { amount: 250000 }, bankLoan: { amount: 150000, interestRate: 0.07, termYears: 5, gracePeriodMonths: 0, repaymentType: 'equal' } } };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

function fmtCurrency(n) {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
}

describe('ScenarioAnalysis — بطاقات السيناريوهات تطابق calculateStudy الحقيقي', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('يعرض 3 بطاقات (متشائم/أساسي/متفائل) بقيم NPV مطابقة تماماً لناتج المحرك بنفس المعاملات', () => {
        const study = marginalStudy();
        const view = new ScenarioAnalysis('c', fakeStore(study));
        view.render(3);

        const base = calculateStudy(study);
        const pess = calculateStudy(study, { revenueChange: -0.20, costChange: 0.15 });
        const opt = calculateStudy(study, { revenueChange: 0.25, costChange: -0.10 });

        expect(document.querySelector('.scenario-pessimistic .kpi .text-danger').textContent).toBe(fmtCurrency(pess.indicators.npv));
        expect(document.querySelector('.scenario-base .kpi .text-gold').textContent).toBe(fmtCurrency(base.indicators.npv));
        expect(document.querySelector('.scenario-optimistic .kpi .text-success').textContent).toBe(fmtCurrency(opt.indicators.npv));

        // تأكيد أن هذه ليست أرقاماً متطابقة بالصدفة (فعلاً 3 حسابات مختلفة)
        expect(pess.indicators.npv).not.toBeCloseTo(base.indicators.npv, -2);
        expect(opt.indicators.npv).not.toBeCloseTo(base.indicators.npv, -2);
    });

    it('السيناريو المتشائم لهذه الدراسة الهامشية سالب فعلاً — حكم الجدوى يظهر تحذيراً حقيقياً لا افتراضياً', () => {
        const study = marginalStudy();
        const pess = calculateStudy(study, { revenueChange: -0.20, costChange: 0.15 });
        expect(pess.indicators.npv).toBeLessThan(0); // تأكيد أن الفخ الهامشي فعّال

        const view = new ScenarioAnalysis('c', fakeStore(study));
        view.render(3);

        const verdict = document.querySelector('.verdict-box');
        expect(verdict.className).toContain('verdict-warning');
        expect(verdict.textContent).toContain('قد لا يكون مجدياً');
    });

    it('فترة الاسترداد غير المحققة (null/NaN) تُعرض "غير محقق" لا "NaN سنة"', () => {
        const study = marginalStudy();
        const pess = calculateStudy(study, { revenueChange: -0.20, costChange: 0.15 });
        expect(pess.indicators.paybackPeriod == null || !Number.isFinite(pess.indicators.paybackPeriod)).toBe(true);

        const view = new ScenarioAnalysis('c', fakeStore(study));
        view.render(3);

        const paybackCell = [...document.querySelectorAll('.scenario-pessimistic .kpi')].find(k => k.textContent.includes('فترة الاسترداد'));
        expect(paybackCell.textContent).toContain('غير محقق');
        expect(paybackCell.textContent).not.toContain('NaN');
    });

    it('حقول الإدخال المعروضة (تغير الإيرادات/التكاليف %) تطابق قيم scenarios الافتراضية أو المخزَّنة بالضبط', () => {
        const study = marginalStudy();
        study.scenarios = { pessimistic: { revenueChange: -0.35, costChange: 0.22 } };
        const view = new ScenarioAnalysis('c', fakeStore(study));
        view.render(3);

        expect(document.getElementById('scenario-pess-revenue').value).toBe('-35');
        expect(document.getElementById('scenario-pess-cost').value).toBe('22');
        // المتفائل بلا قيمة مخزَّنة ⇒ يعود للافتراضي +25%/-10%
        expect(document.getElementById('scenario-opt-revenue').value).toBe('25');
        expect(document.getElementById('scenario-opt-cost').value).toBe('-10');
    });
});

describe('ScenarioAnalysis — السيناريو الأساسي يقرأ من نتيجة الحساب الرئيسي دائماً', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('تعيين state.scenarios.base إلى قيم غريبة لا يغيّر بطاقة الأساس (تُقرأ من baseResults الرئيسي فقط لا من scenarios.base)', () => {
        const study = marginalStudy();
        // scenarios.base ليس له أي مدخل UI أصلاً — نتأكد أنه حتى لو خُزِّن بقيمة، تُتجاهل تماماً
        study.scenarios = { base: { revenueChange: 0.99, costChange: -0.99 } };
        const view = new ScenarioAnalysis('c', fakeStore(study));
        view.render(3);

        const realBase = calculateStudy(study); // بلا أي overrides — هذا ما يجب أن يظهر فعلياً
        expect(document.querySelector('.scenario-base .kpi .text-gold').textContent).toBe(fmtCurrency(realBase.indicators.npv));
    });
});

describe('ScenarioAnalysis — تحديث مدخلات السيناريو (updateScenario)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('تعديل حقل واحد (تغير إيرادات المتفائل) يحدّث المخزن بدمج الحقل الجديد دون طمس costChange القديم لنفس السيناريو', () => {
        const study = marginalStudy();
        study.scenarios = { optimistic: { revenueChange: 0.25, costChange: -0.10 } };
        const store = fakeStore(study);
        const view = new ScenarioAnalysis('c', store);
        view.render(3);

        const input = document.getElementById('scenario-opt-revenue');
        input.value = '40';
        input.dispatchEvent(new Event('change', { bubbles: true }));

        expect(store.update).toHaveBeenCalledWith('scenarios', expect.objectContaining({
            optimistic: { revenueChange: 0.40, costChange: -0.10 }
        }));
        // بعد إعادة الرسم: القيمة الجديدة معروضة فعلياً
        expect(document.getElementById('scenario-opt-revenue').value).toBe('40');
    });

    it('تعديل سيناريو المتشائم لا يمسّ بيانات سيناريو المتفائل المخزَّنة', () => {
        const study = marginalStudy();
        study.scenarios = {
            pessimistic: { revenueChange: -0.20, costChange: 0.15 },
            optimistic: { revenueChange: 0.25, costChange: -0.10 }
        };
        const store = fakeStore(study);
        const view = new ScenarioAnalysis('c', store);
        view.render(3);

        const input = document.getElementById('scenario-pess-cost');
        input.value = '30';
        input.dispatchEvent(new Event('change', { bubbles: true }));

        const savedScenarios = store.update.mock.calls[0][1];
        expect(savedScenarios.pessimistic).toEqual({ revenueChange: -0.20, costChange: 0.30 });
        expect(savedScenarios.optimistic).toEqual({ revenueChange: 0.25, costChange: -0.10 });
    });
});

describe('ScenarioAnalysis — التنقل بين الخطوات', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('يستدعي onNavigate بالفهرس الصحيح (stepIndex±1) عند الضغط على السابق/التالي', () => {
        const onNavigate = vi.fn();
        const view = new ScenarioAnalysis('c', fakeStore(marginalStudy()), onNavigate);
        view.render(5);

        document.querySelector('.btn-next-step').click();
        expect(onNavigate).toHaveBeenCalledWith(6);

        document.querySelector('.btn-prev-step').click();
        expect(onNavigate).toHaveBeenCalledWith(4);
    });
});

describe('ScenarioAnalysis — سلوك state فارغ تماماً (توثيق هشاشة حالية، لا إصلاح)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('دراسة فارغة تماماً (state=null): يرمي خطأً فوراً عند قراءة state.scenarios (لا try/catch حول القراءة الأولى في render)', () => {
        // هذا يوثّق سلوكاً هشاً حالياً: خلافاً لتعذّر runFullModel(state) الذي يُبتلع
        // (سطور render أدناه)، `state.scenarios` نفسه غير محروس — state=null يرمي
        // TypeError فوراً قبل الوصول لأي try/catch. ليس هذا إصلاحاً، بل توثيقاً صريحاً
        // للفرق بين "فشل حساب" (مُعالَج) و"state فارغ تماماً" (غير مُعالَج).
        const view = new ScenarioAnalysis('c', fakeStore(null));
        expect(() => view.render(0)).toThrow();
    });
});

