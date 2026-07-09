/**
 * @vitest-environment jsdom
 *
 * دفعة 6 (تدقيق 2026-07-09): افتراضي سيناريو "متفائل/متشائم" (يُستخدم متى لم يُعدِّله
 * المستخدم بعد في state.scenarios) كان معرَّفاً بثلاث قيم متضاربة في ثلاثة ملفات
 * تقرأ نفس الحقل: schema.js (0.25/-0.10 — المصدر الفعلي عبر createEmptyStudy)،
 * بينما ScenarioSwitcher.js وFinancialDashboard.js كانا يحملان نسخة محلية مختلفة
 * (0.15/-0.05) بلا أي مصدر مشترك. النتيجة: نفس الدراسة غير المُعدَّلة تُنتج أرقام
 * NPV مختلفة فعلياً حسب الشاشة التي يفتحها المستخدم.
 *
 * هذا الاختبار يثبّت أن الثلاثة تستورد وتستخدم الآن نفس الثابت المُصدَّر
 * DEFAULT_SCENARIOS من core/schema.js عند غياب تخصيص المستخدم لـ scenarios.optimistic.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScenarioAnalysis } from '../ScenarioAnalysis.js';
import { ScenarioSwitcher } from '../ScenarioSwitcher.js';
import { FinancialDashboard } from '../FinancialDashboard.js';
import { calculateStudy } from '../../core/engine.js';
import { SECTIONS, DEFAULT_SCENARIOS } from '../../core/schema.js';

function fakeStore(state) {
    return {
        getState: () => state,
        get: () => state,
        update: () => {},
        notify: () => {}
    };
}

// دراسة بسيطة بلا مفتاح "scenarios" إطلاقاً — تحاكي بالضبط الحالة التي يصفها
// الخلل: مستخدم لم يخصّص أي سيناريو بعد، فتقع كل شاشة على افتراضها المحلي.
function buildStudyWithoutScenarios() {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 },
        [SECTIONS.TECHNICAL]: { equipment: [{ price: 250000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 17000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 400, avgPrice: 100, variableCostRate: 0.30, growthRate: 0 }] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
        // ملاحظة: بلا "scenarios" بتاتاً
    };
}

function fmtCurrency(n) {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0);
}

describe('دفعة 6 — الثابت DEFAULT_SCENARIOS موحّد عبر الشاشات الثلاث', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        // jsdom لا يطبّق canvas 2D فعلياً بلا حزمة "canvas" — نموّه لسياق وهمي محايد
        // كي لا تفشل شاشات الرسم البياني (Chart.js) أثناء render() دون علاقة بهذا الاختبار.
        HTMLCanvasElement.prototype.getContext = () => ({});
    });
    afterEach(() => {
        document.body.innerHTML = '';
        delete global.Chart;
    });

    it('التوثيق الصريح: DEFAULT_SCENARIOS.optimistic/pessimistic هي القيم المعتمدة الوحيدة الآن (لا 0.15/-0.05 القديمة)', () => {
        expect(DEFAULT_SCENARIOS.optimistic).toEqual({ revenueChange: 0.25, costChange: -0.10 });
        expect(DEFAULT_SCENARIOS.pessimistic).toEqual({ revenueChange: -0.20, costChange: 0.15 });
    });

    it('ScenarioAnalysis.js: حقول إدخال المتفائل تعرض بالضبط نسب DEFAULT_SCENARIOS.optimistic عند غياب scenarios.optimistic', () => {
        const study = buildStudyWithoutScenarios();
        const view = new ScenarioAnalysis('c', fakeStore(study));
        view.render(3);

        expect(document.getElementById('scenario-opt-revenue').value).toBe(
            String(Math.round(DEFAULT_SCENARIOS.optimistic.revenueChange * 100))
        );
        expect(document.getElementById('scenario-opt-cost').value).toBe(
            String(Math.round(DEFAULT_SCENARIOS.optimistic.costChange * 100))
        );
    });

    it('ScenarioSwitcher.js: حقل معاملات "الأفضل" وناتج NPV يطابقان بالضبط DEFAULT_SCENARIOS.optimistic (لا 0.15/-0.05 القديمة)', () => {
        const study = buildStudyWithoutScenarios();
        const view = new ScenarioSwitcher('c', fakeStore(study));
        view.render();

        const revInput = document.querySelector('.scenario-param[data-scenario="optimistic"][data-field="revenueChange"]');
        const costInput = document.querySelector('.scenario-param[data-scenario="optimistic"][data-field="costChange"]');
        expect(revInput.value).toBe(String(Math.round(DEFAULT_SCENARIOS.optimistic.revenueChange * 100)));
        expect(costInput.value).toBe(String(Math.round(DEFAULT_SCENARIOS.optimistic.costChange * 100)));

        // ناتج NPV المعروض في عمود "الأفضل" يطابق حساب المحرك الحقيقي بنفس معاملات الثابت المشترك بالضبط
        const expectedOpt = calculateStudy(study, DEFAULT_SCENARIOS.optimistic);
        const optNpvCell = document.querySelector('.comparison-table tbody tr:first-child td.positive');
        expect(optNpvCell.textContent).toBe(fmtCurrency(expectedOpt.indicators.npv));

        // إثبات تمايز: القيمة القديمة الخاطئة (0.15/-0.05) كانت لتُنتج NPV مختلفاً فعلياً
        const oldBuggyOpt = calculateStudy(study, { revenueChange: 0.15, costChange: -0.05 });
        expect(oldBuggyOpt.indicators.npv).not.toBeCloseTo(expectedOpt.indicators.npv, -1);
    });

    it('FinancialDashboard.js: مسار مقارنة السيناريوهات (renderForecastChart mode=scenarios) يحسب "متفائل" بنفس معاملات DEFAULT_SCENARIOS.optimistic بالضبط', async () => {
        class FakeChart {
            constructor(ctx, config) {
                this.ctx = ctx;
                this.config = config;
                FakeChart.instances.push(this);
            }
            destroy() {}
        }
        FakeChart.instances = [];
        global.Chart = FakeChart;

        const study = buildStudyWithoutScenarios();
        const dashboard = new FinancialDashboard('c', fakeStore(study));
        dashboard.render();

        dashboard._forecastMode = 'scenarios';
        await dashboard.renderForecastChart();

        const chart = FakeChart.instances[FakeChart.instances.length - 1];
        expect(chart).toBeTruthy();
        const optDataset = chart.config.data.datasets.find(d => d.label === 'متفائل');
        expect(optDataset).toBeTruthy();

        const expectedOpt = calculateStudy(study, DEFAULT_SCENARIOS.optimistic);
        const expectedNet = expectedOpt.incomeStatement.map(d => d.netIncome ?? 0);
        expect(optDataset.data).toEqual(expectedNet);

        // إثبات تمايز: لو استُخدمت القيمة القديمة الخاطئة (0.15/-0.05) لاختلفت سلسلة صافي الربح فعلياً
        const oldBuggyOpt = calculateStudy(study, { revenueChange: 0.15, costChange: -0.05 });
        const oldBuggyNet = oldBuggyOpt.incomeStatement.map(d => d.netIncome ?? 0);
        expect(oldBuggyNet).not.toEqual(expectedNet);
    });

    it('الشاشات الثلاث تتفق رقمياً: نفس revenueChange/costChange بالضبط لسيناريو "متفائل" غير المُعدَّل', () => {
        const study = buildStudyWithoutScenarios();

        // ScenarioAnalysis (القيمة المعروضة في حقل الإدخال، مُحوَّلة من % إلى كسر)
        const viewA = new ScenarioAnalysis('c', fakeStore(study));
        viewA.render(3);
        const aRev = parseFloat(document.getElementById('scenario-opt-revenue').value) / 100;
        const aCost = parseFloat(document.getElementById('scenario-opt-cost').value) / 100;

        // ScenarioSwitcher (نفس المنطق)
        document.body.innerHTML = `<div id="c"></div>`;
        const viewB = new ScenarioSwitcher('c', fakeStore(study));
        viewB.render();
        const bRev = parseFloat(document.querySelector('.scenario-param[data-scenario="optimistic"][data-field="revenueChange"]').value) / 100;
        const bCost = parseFloat(document.querySelector('.scenario-param[data-scenario="optimistic"][data-field="costChange"]').value) / 100;

        expect(aRev).toBe(DEFAULT_SCENARIOS.optimistic.revenueChange);
        expect(aCost).toBe(DEFAULT_SCENARIOS.optimistic.costChange);
        expect(bRev).toBe(DEFAULT_SCENARIOS.optimistic.revenueChange);
        expect(bCost).toBe(DEFAULT_SCENARIOS.optimistic.costChange);
        expect(aRev).toBe(bRev);
        expect(aCost).toBe(bCost);
    });
});
