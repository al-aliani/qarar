/**
 * @vitest-environment jsdom
 *
 * دفعة 6: calculateReadiness.dimensions كانت تحتوي 6 أبعاد فقط
 * (market/financing/team/legal/risk/location) رغم أن «الاستراتيجي» و«الخدمات»
 * بعدان موزونان فعلياً في web/js/utils/studyCompleteness.js. فكانت دراسة بلا
 * أي SWOT وبلا أي كتالوج خدمات/إيرادات يمكن أن تُظهر جاهزية كاملة في كل الأبعاد
 * المرئية بلوحة القرار رغم غياب هذين القسمين بالكامل.
 *
 * الإصلاح: إضافة بُعدي strategic (يتبع state[SECTIONS.STRATEGIC]?.swot) و
 * services (يتبع state[SECTIONS.SERVICES]?.items أو state.revenue?.streams
 * بديلاً) إلى dimensions، ثم إضافة عنصري renderReadinessItem المقابلين في
 * قائمة الجاهزية المعروضة فعلياً.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DecisionDashboard } from '../DecisionDashboard.js';
import { SECTIONS } from '../../core/schema.js';

// نتجاوز المُنشئ (يلمس DOM) لاختبارات calculateReadiness المجردة —
// نفس نمط decisionDashboard.coherence.test.js.
const dd = Object.create(DecisionDashboard.prototype);

const emptyDimsState = {
    projectInfo: {}, assumptions: {}, financing: {},
    marketSizing: {}, hr: { positions: [] }, legal: {}, riskAnalysis: {},
    revenue: { streams: [] },
    [SECTIONS.STRATEGIC]: { swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] } },
    [SECTIONS.SERVICES]: { items: [] }
};

const weakResults = {
    decision: 'REVISE',
    indicators: { npv: 0, irr: 0, roi: 0, paybackPeriod: 999, dscr: null },
    incomeStatement: [{ ebitda: 0 }],
    capex: { total: 0 },
    financingCheck: { fundingGap: 0 }
};

describe('calculateReadiness — بُعدا الاستراتيجي والخدمات (دفعة 6)', () => {
    it('SWOT فارغ تماماً + بلا خدمات وبلا إيرادات ⇒ كلا البعدين "يحتاج عمل" (needs_work)', () => {
        const r = dd.calculateReadiness(emptyDimsState, weakResults);
        expect(r.dimensions.strategic).toBe('needs_work');
        expect(r.dimensions.services).toBe('needs_work');
    });

    it('SWOT معبّأ جزئياً (قوة واحدة فقط) ⇒ الاستراتيجي "جاهز" (ready)', () => {
        const state = {
            ...emptyDimsState,
            [SECTIONS.STRATEGIC]: { swot: { strengths: ['موقع مميز'], weaknesses: [], opportunities: [], threats: [] } }
        };
        const r = dd.calculateReadiness(state, weakResults);
        expect(r.dimensions.strategic).toBe('ready');
    });

    it('عنصر واحد في كتالوج الخدمات (services.items) ⇒ الخدمات "جاهز"', () => {
        const state = {
            ...emptyDimsState,
            [SECTIONS.SERVICES]: { items: [{ id: 'pool', name: 'المسبح' }] }
        };
        const r = dd.calculateReadiness(state, weakResults);
        expect(r.dimensions.services).toBe('ready');
    });

    it('بديلاً: مصدر إيراد واحد (revenue.streams) بلا services.items ⇒ الخدمات أيضاً "جاهز"', () => {
        const state = {
            ...emptyDimsState,
            revenue: { streams: [{ type: 'operating', customersPerMonth: 100, avgPrice: 50 }] },
            [SECTIONS.SERVICES]: { items: [] }
        };
        const r = dd.calculateReadiness(state, weakResults);
        expect(r.dimensions.services).toBe('ready');
    });

    it('لا يزال يحسب الأبعاد الستة الأصلية بشكل صحيح (لا كسر رجعي)', () => {
        const r = dd.calculateReadiness(emptyDimsState, weakResults);
        expect(Object.keys(r.dimensions).sort()).toEqual(
            ['financing', 'legal', 'location', 'market', 'risk', 'services', 'strategic', 'team'].sort()
        );
    });
});

// ─────────────────────────────────────────────────────────────
// اختبارات DOM: تتحقق أن البعدين الجديدين يُعرضان فعلياً في قائمة
// الجاهزية (لا يكفي حسابهما في calculateReadiness إن لم يُستدعَ
// renderReadinessItem لهما في موقع العرض).
// ─────────────────────────────────────────────────────────────

// دراسة مطعم واقعية تمرّ من بوابة "لا بيانات إيرادات" وتُنتج نتائج محرك حقيقية —
// نفس نمط createGoStudy في ui.test.js.
function createRenderableStudy({ swot, services } = {}) {
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
        [SECTIONS.SERVICES]: services || { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [{ name: 'رخصة', cost: 5000 }] },
        [SECTIONS.STRATEGIC]: { swot: swot || { strengths: [], weaknesses: [], opportunities: [], threats: [] } }
    };
}

function fakeStore(state) {
    return { getState: () => state };
}

describe('عرض DOM لبُعدي الاستراتيجي والخدمات في قائمة الجاهزية (دفعة 6)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="decisionDashboardContainer"></div>`;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('تعرض 8 عناصر جاهزية (لا 6) بعد إضافة البعدين الجديدين', async () => {
        const dashboard = new DecisionDashboard('decisionDashboardContainer', fakeStore(createRenderableStudy()));
        await dashboard.render();
        const items = document.querySelectorAll('.readiness-list .readiness-item');
        expect(items.length).toBe(8);
    });

    it('عنصر "الجاهزية الاستراتيجية" يظهر فعلياً بالـDOM وبحالة "يحتاج عمل" حين SWOT فارغ', async () => {
        const dashboard = new DecisionDashboard('decisionDashboardContainer', fakeStore(createRenderableStudy()));
        await dashboard.render();
        const items = Array.from(document.querySelectorAll('.readiness-list .readiness-item'));
        const strategicItem = items.find(el => el.textContent.includes('الجاهزية الاستراتيجية'));
        expect(strategicItem).toBeTruthy();
        expect(strategicItem.className).toContain('status-needs_work');
        expect(strategicItem.textContent).toContain('يحتاج عمل');
    });

    it('عنصر "جاهزية الخدمات/المنتجات" يظهر فعلياً بالـDOM كعنصر مستقل', async () => {
        const dashboard = new DecisionDashboard('decisionDashboardContainer', fakeStore(createRenderableStudy()));
        await dashboard.render();
        const items = Array.from(document.querySelectorAll('.readiness-list .readiness-item'));
        const servicesItem = items.find(el => el.textContent.includes('جاهزية الخدمات/المنتجات'));
        expect(servicesItem).toBeTruthy();
    });

    it('حين يُعبّأ SWOT فعلياً يتحول عنصر الجاهزية الاستراتيجية بالـDOM إلى status-ready', async () => {
        const state = createRenderableStudy({
            swot: { strengths: ['موقع مميز'], weaknesses: [], opportunities: [], threats: [] }
        });
        const dashboard = new DecisionDashboard('decisionDashboardContainer', fakeStore(state));
        await dashboard.render();
        const items = Array.from(document.querySelectorAll('.readiness-list .readiness-item'));
        const strategicItem = items.find(el => el.textContent.includes('الجاهزية الاستراتيجية'));
        expect(strategicItem.className).toContain('status-ready');
        expect(strategicItem.textContent).toContain('جاهز');
    });

    it('حين تُعبّأ services.items يتحول عنصر جاهزية الخدمات بالـDOM إلى status-ready', async () => {
        const state = createRenderableStudy({ services: { items: [{ id: 'pool', name: 'المسبح' }] } });
        const dashboard = new DecisionDashboard('decisionDashboardContainer', fakeStore(state));
        await dashboard.render();
        const items = Array.from(document.querySelectorAll('.readiness-list .readiness-item'));
        const servicesItem = items.find(el => el.textContent.includes('جاهزية الخدمات/المنتجات'));
        expect(servicesItem.className).toContain('status-ready');
    });
});
