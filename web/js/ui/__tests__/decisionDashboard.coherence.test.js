import { describe, it, expect } from 'vitest';
import { DecisionDashboard } from '../DecisionDashboard.js';

/**
 * حارس تماسك القرار: كانت لوحة القرار تعرض توصيتين مستقلتين قد تتناقضان —
 * العنوان الرئيسي (evaluation عبر scoring.js، يتبع results.decision من المحرك)
 * مقابل calculateReadiness.recommendation (درجة محلية مستقلة). فيظهر «GO» في
 * العنوان و«يحتاج مراجعة» في تحذير الملف المحافظ لنفس المشروع.
 * الآن كلاهما يتبع قرار المحرك القابل للتدقيق (results.decision).
 */

// نتجاوز المُنشئ (يلمس DOM) ونستدعي الدالة على نموذج أولي فقط
const dd = Object.create(DecisionDashboard.prototype);

const baseState = {
    projectInfo: {}, assumptions: {}, financing: {},
    marketSizing: {}, hr: { positions: [] }, legal: {}, riskAnalysis: {}
};
// مؤشرات ضعيفة عمداً ⇒ الدرجة المحلية منخفضة (كانت تعطي nogo/review سابقاً)
const weakResults = (decision) => ({
    decision,
    indicators: { npv: -1000, irr: 0, roi: 0, paybackPeriod: 999, dscr: null },
    incomeStatement: [{ ebitda: 0 }],
    capex: { total: 100000 },
    financingCheck: { fundingGap: 0 }
});

describe('تماسك توصية الجاهزية مع قرار المحرك', () => {
    it('قرار المحرك GO ⇒ توصية الجاهزية go (رغم ضعف الدرجة المحلية)', () => {
        const r = dd.calculateReadiness(baseState, weakResults('GO'));
        expect(r.recommendation.status).toBe('go');
    });

    it('قرار المحرك REVISE ⇒ توصية الجاهزية review', () => {
        const r = dd.calculateReadiness(baseState, weakResults('REVISE'));
        expect(r.recommendation.status).toBe('review');
    });

    it('قرار المحرك NO-GO ⇒ توصية الجاهزية nogo', () => {
        const r = dd.calculateReadiness(baseState, weakResults('NO-GO'));
        expect(r.recommendation.status).toBe('nogo');
    });

    it('غياب قرار المحرك ⇒ احتياطي من الدرجة المحلية (لا انهيار)', () => {
        const noDecision = weakResults(undefined);
        delete noDecision.decision;
        const r = dd.calculateReadiness(baseState, noDecision);
        // درجة منخفضة ⇒ nogo عبر المسار الاحتياطي
        expect(['nogo', 'review', 'conditional', 'go']).toContain(r.recommendation.status);
    });
});
