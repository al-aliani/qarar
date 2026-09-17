/**
 * @vitest-environment jsdom
 *
 * تدقيق شامل 2026-09-16: renderFeasibilityScore/renderRecommendation كانتا تتحققان من
 * hasMinimumRevenueData فقط، وrenderInvestmentHighlights لا تتحقق من أي شيء إطلاقاً —
 * دراسة بمصدر إيراد واحد بلا أي معدات/موظفين/تمويل كانت تُنتج درجة/توصية/NPV واثقة
 * (مثال حي: NPV=1.6M ريال "إيجابي"، ROI=4795%) بينما DecisionDashboard/FinancialDashboard
 * تحجبان نفس الدراسة برسالة "أكمل البيانات أولاً". الإصلاح يعمّم نفس بوابة
 * hasMinimumFinancialData على الشاشات الثلاث في ExecutiveSummary.js.
 */
import { describe, it, expect } from 'vitest';
import { ExecutiveSummary } from '../ExecutiveSummary.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {} };
}

const revenueOnlyState = {
    projectInfo: { name: 'دراسة بإيراد بلا تكلفة' },
    revenue: { streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100 }] },
};

describe('ExecutiveSummary — بوابة اكتمال بيانات التكلفة (لا فقط الإيراد)', () => {
    it('renderFeasibilityScore: يعرض تنبيه "لا توجد بيانات تكلفة" لا درجة واثقة', () => {
        const view = new ExecutiveSummary(null, fakeStore(revenueOnlyState), null);
        const html = view.renderFeasibilityScore(60, {}, revenueOnlyState);
        expect(html).toContain('لا توجد بيانات تكلفة');
        expect(html).not.toContain('score-circle');
    });

    it('renderRecommendation: يعرض نفس التنبيه لا توصية واثقة', () => {
        const view = new ExecutiveSummary(null, fakeStore(revenueOnlyState), null);
        const html = view.renderRecommendation(60, { decision: 'REVISE' }, revenueOnlyState);
        expect(html).toContain('لا توجد بيانات تكلفة');
    });

    it('renderInvestmentHighlights: يعرض نفس التنبيه لا جدول NPV/IRR/ROI واثق', () => {
        const view = new ExecutiveSummary(null, fakeStore(revenueOnlyState), null);
        const results = { indicators: { npv: 1612007, irr: null, roi: 47.95, paybackPeriod: 0.1 }, capex: { total: 0 } };
        const html = view.renderInvestmentHighlights(revenueOnlyState, results);
        expect(html).toContain('لا توجد بيانات تكلفة');
        expect(html).not.toContain('highlights-grid');
    });

    it('لا انحدار: دراسة مكتملة البيانات (إيراد + معدات) ما زالت تعرض الدرجة والجدول', () => {
        const fullState = {
            ...revenueOnlyState,
            technical: { equipment: [{ name: 'معدات', price: 100000, quantity: 1 }] },
        };
        const view = new ExecutiveSummary(null, fakeStore(fullState), null);
        const scoreHtml = view.renderFeasibilityScore(60, { a: { label: 'x', score: 1, max: 2 } }, fullState);
        expect(scoreHtml).toContain('score-circle');
        const highlightsHtml = view.renderInvestmentHighlights(fullState, { indicators: {}, capex: { total: 100000 } });
        expect(highlightsHtml).toContain('highlights-grid');
    });
});
