/**
 * @vitest-environment jsdom
 *
 * ملاحظة (تدقيق 2026-07-08): كان هذا الملف يفشل بصمت لأن jsdom لم تكن مثبّتة —
 * Vitest يبتلع الملف كـ"Unhandled Error" عام بدل فشل اختبار واضح (npm test كان
 * "ينجح" ظاهرياً رغم أن هذا الملف لا يُنفَّذ إطلاقاً). بعد تثبيت jsdom ظهر أن
 * الاختبار نفسه كان قديماً: DecisionDashboard.render() الفعلي async وبلا معاملات
 * (يقرأ this.store.getState() ويحسب النتائج داخلياً عبر calculateStudy)، وليس
 * render(state, results) كما افترض الاختبار القديم — وكان يتحقق من نص
 * "ادخل المشروع بقوة" غير الموجود أصلاً في scoring.js (النصوص الحقيقية:
 * "مشروع مجدي (GO)" / "غير مجدي (NO-GO)" / "مراجعة مطلوبة (REVISE)").
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DecisionDashboard } from '../DecisionDashboard.js';
import { SECTIONS } from '../../core/schema.js';

// دراسة مطعم واقعية تُنتج GO فعلياً عبر calculateStudy الحقيقي (لا نتائج مصطنعة) —
// مضبوطة لتفادي بوابتي «مؤشرات مرتفعة بشكل غير معتاد» و«يخسر تحت السيناريو المتشائم».
function createGoStudy() {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ price: 250000, quantity: 1 }],
            buildings: [], furniture: [{ price: 50000, quantity: 1 }],
            establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: {
            positions: [
                { position: 'مدير', count: 1, salary: 9000, months: 12, nationality: 'saudi' },
                { position: 'موظف', count: 3, salary: 4000, months: 12, nationality: 'saudi' }
            ]
        },
        [SECTIONS.LOGISTICS]: { logistics: [{ name: 'نقل', monthly: 2000 }] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 15000 }] },
        [SECTIONS.MARKETING]: { campaigns: [{ name: 'إعلانات', monthly: 3000 }] },
        [SECTIONS.REVENUE]: {
            streams: [{ type: 'operating', customersPerMonth: 1200, avgPrice: 100, variableCostRate: 0.30, growthRate: 0.03 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [{ name: 'رخصة', cost: 5000 }] }
    };
}

function fakeStore(state) {
    return { getState: () => state };
}

describe('DecisionDashboard UI Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="decisionDashboardContainer"></div>`;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('يجب أن يُهيئ واجهة القرار دون أخطاء', () => {
        const dashboard = new DecisionDashboard('decisionDashboardContainer', fakeStore(createGoStudy()));
        expect(dashboard).toBeDefined();
    });

    it('يعرض حالة "لا بيانات" حين لا توجد مصادر إيرادات (بدل حكم سلبي مضلل)', async () => {
        const state = createGoStudy();
        state[SECTIONS.REVENUE] = { streams: [] };
        const dashboard = new DecisionDashboard('decisionDashboardContainer', fakeStore(state));
        await dashboard.render();
        expect(document.body.textContent).toContain('لا توجد بيانات إيرادات');
        expect(document.querySelector('.dd-verdict__title')).toBeNull();
    });

    it('يعرض حالة "لا بيانات" حين يوجد إيراد واحد فقط بلا أي تكلفة رأسمالية أو تشغيلية أو تمويل (لا درجة/توصية مزيّفة)', async () => {
        const state = createGoStudy();
        state[SECTIONS.TECHNICAL] = { equipment: [], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
        state[SECTIONS.HR] = { positions: [] };
        state[SECTIONS.TECH_RESOURCES] = { techResources: [] };
        state[SECTIONS.FINANCING] = { sources: {} };
        const dashboard = new DecisionDashboard('decisionDashboardContainer', fakeStore(state));
        await dashboard.render();
        expect(document.body.textContent).toContain('لا توجد بيانات تكلفة');
        expect(document.querySelector('.dd-verdict__title')).toBeNull();
    });

    it('يعرض توصية "مشروع مجدي (GO)" لدراسة مطعم مربحة فعلياً عبر المحرك الحقيقي', async () => {
        const dashboard = new DecisionDashboard('decisionDashboardContainer', fakeStore(createGoStudy()));
        // render() يستدعي calculateStudy/calculateProjectScore الحقيقيين داخلياً — لا نتائج مصطنعة هنا.
        await dashboard.render();

        const titleEl = document.querySelector('.dd-verdict__title');
        expect(titleEl).not.toBeNull();
        expect(titleEl.textContent).toContain('مشروع مجدي (GO)');
    });
});
