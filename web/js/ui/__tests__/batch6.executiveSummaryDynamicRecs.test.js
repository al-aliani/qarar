/**
 * @vitest-environment jsdom
 *
 * دفعة 6: renderRecommendation في ExecutiveSummary.js كانت تُسند أفعال التوصية النهائية
 * من مصفوفة ثابتة بالكامل حسب فئة القرار فقط (GO/CONDITIONAL/NOGO) — فكل مشروع GO يحصل
 * على نفس 3 أفعال حرفياً بصرف النظر عن ملفه المالي الفعلي (DSCR، فترة الاسترداد...). هذا
 * الاختبار يثبّت أن مشروعين بفئة GO لكن بـ DSCR مختلف جوهرياً (أحدهما مريح، والآخر ملاصق
 * بالكاد للحد الأدنى المستهدف) ينتجان قائمتي أفعال مختلفتين فعلياً، وأن الحالة الضعيفة تذكر
 * لغة متعلقة بالتمويل/DSCR تحديداً.
 */
import { describe, it, expect } from 'vitest';
import { ExecutiveSummary } from '../ExecutiveSummary.js';
import { createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {} };
}

function buildGoResults(dscr) {
    return {
        decision: 'GO',
        decisionReasons: [],
        indicators: {
            npv: 500000,
            irr: 0.25,
            paybackPeriod: 3,
            payback: 3,
            roi: 0.3,
            dscr
        },
        incomeStatement: [{ revenue: 1000000, netIncome: 100000 }]
    };
}

function buildState() {
    const state = createEmptyStudy();
    state.financing = {
        ...state.financing,
        sources: { ...(state.financing?.sources || {}), bankLoan: { amount: 500000 } }
    };
    // renderRecommendation يفحص الآن hasMinimumRevenueData(state) قبل عرض التوصية (حارس
    // بيانات جديد) — هذا الاختبار يفحص محتوى التوصية نفسها (أفعال DSCR الديناميكية) لمشروع
    // مكتمل البيانات فعلياً (نتائج buildGoResults تفترض إيرادات 1,000,000)، فيجب أن يعكس
    // state.revenue.streams نفس الافتراض بدل البقاء فارغاً كما في createEmptyStudy().
    state.revenue = { streams: [{ service: 'خدمة تجريبية', customersPerMonth: 100, avgPrice: 833, growthRate: 0.05, type: 'operating' }] };
    return state;
}

describe('ExecutiveSummary.renderRecommendation — أفعال ديناميكية من نقاط الضعف الفعلية (دفعة 6)', () => {
    it('مشروعان بفئة GO لكن بـ DSCR مختلف جوهرياً ينتجان قائمتي أفعال مختلفتين (ليستا متطابقتين حرفياً)', () => {
        const state = buildState();
        const view = new ExecutiveSummary(null, fakeStore(state), null);

        const healthyResults = buildGoResults(3.0);   // DSCR مريح، بعيد عن الحد الأدنى
        const weakResults = buildGoResults(1.30);      // DSCR ملاصق بالكاد للحد الأدنى (1.25 افتراضياً)

        const healthyHtml = view.renderRecommendation(0, healthyResults, state);
        const weakHtml = view.renderRecommendation(0, weakResults, state);

        expect(healthyHtml).not.toBe(weakHtml);
    });

    it('الحالة الضعيفة (DSCR ملاصق للحد الأدنى) تذكر لغة متعلقة بالتمويل/تغطية خدمة الدين تحديداً', () => {
        const state = buildState();
        const view = new ExecutiveSummary(null, fakeStore(state), null);

        const weakResults = buildGoResults(1.30);
        const html = view.renderRecommendation(0, weakResults, state);

        expect(html).toMatch(/DSCR|تغطية خدمة الدين|التمويل/);
    });

    it('الحالة المريحة (DSCR مرتفع بوضوح عن الحد الأدنى) لا تذكر فعل إعادة هيكلة التمويل الخاص بـ DSCR', () => {
        const state = buildState();
        const view = new ExecutiveSummary(null, fakeStore(state), null);

        const healthyResults = buildGoResults(3.0);
        const html = view.renderRecommendation(0, healthyResults, state);

        expect(html).not.toContain('تغطية خدمة الدين');
    });

    it('كلا المشروعين لا يزالان يصنَّفان GO (نفس فئة القرار) رغم اختلاف الأفعال', () => {
        const state = buildState();
        const view = new ExecutiveSummary(null, fakeStore(state), null);

        const healthyHtml = view.renderRecommendation(0, buildGoResults(3.0), state);
        const weakHtml = view.renderRecommendation(0, buildGoResults(1.30), state);

        expect(healthyHtml).toContain('GO');
        expect(weakHtml).toContain('GO');
    });
});
