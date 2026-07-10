/**
 * اختبار إضافة سببين جديدين لـ explainDecisionBreakers (٢٠٢٦-٠٧-١٠):
 * ١) هامش أمان نقطة التعادل ضعيف (bepRatio = breakEvenPointValue / incomeStatement[0].revenue).
 * ٢) تدفق نقدي تراكمي سالب لسنتين فأكثر (results.cashFlow[].cumulative).
 * كلاهما لم يكن يظهر سابقاً رغم أنه إشارة حقيقية على هشاشة المشروع حتى مع NPV/IRR مقبولة.
 */
import { describe, it, expect } from 'vitest';
import { explainDecisionBreakers } from '../DecisionExplainer.js';

const baseIndicators = { npv: 500000, irr: 0.5, paybackPeriod: 1, roi: 0.8, dscr: 2 };

describe('explainDecisionBreakers — هامش أمان نقطة التعادل (#break-even-safety-margin)', () => {
    it('هامش أمان ضيق (<15%) وbepRatio <= 1: يُدرَج كسبب تحذيري', () => {
        const results = {
            indicators: { ...baseIndicators, breakEvenPointValue: 900000 },
            incomeStatement: [{ year: 1, revenue: 1000000 }] // bepRatio = 0.9 → هامش 10%
        };
        const { issues } = explainDecisionBreakers({}, results);
        const issue = issues.find(i => i.metric === 'breakEvenSafetyMargin');
        expect(issue).toBeTruthy();
        expect(issue.severity).toBe('warning');
        expect(issue.title).toBe('هامش أمان نقطة التعادل ضعيف');
        expect(issue.explanation).toContain('10.0%');
    });

    it('نقطة التعادل تتجاوز الإيراد المتوقع (bepRatio > 1): تُصعَّد إلى حرجة', () => {
        const results = {
            indicators: { ...baseIndicators, breakEvenPointValue: 1200000 },
            incomeStatement: [{ year: 1, revenue: 1000000 }] // bepRatio = 1.2
        };
        const { issues } = explainDecisionBreakers({}, results);
        const issue = issues.find(i => i.metric === 'breakEvenSafetyMargin');
        expect(issue).toBeTruthy();
        expect(issue.severity).toBe('critical');
    });

    it('هامش أمان مريح (>=15%): لا يُدرَج', () => {
        const results = {
            indicators: { ...baseIndicators, breakEvenPointValue: 700000 },
            incomeStatement: [{ year: 1, revenue: 1000000 }] // bepRatio = 0.7 → هامش 30%
        };
        const { issues } = explainDecisionBreakers({}, results);
        expect(issues.some(i => i.metric === 'breakEvenSafetyMargin')).toBe(false);
    });
});

describe('explainDecisionBreakers — تدفق نقدي تراكمي سالب لعدة سنوات (#negative-cumulative-cash-flow)', () => {
    it('سنتان فأكثر بتراكم سالب (بعد سنة الصفر): تُدرَج كسبب تحذيري ويذكر عدد السنوات', () => {
        const results = {
            indicators: baseIndicators,
            cashFlow: [
                { year: 0, cumulative: -500000 },
                { year: 1, cumulative: -300000 },
                { year: 2, cumulative: -100000 },
                { year: 3, cumulative: 150000 }
            ]
        };
        const { issues } = explainDecisionBreakers({}, results);
        const issue = issues.find(i => i.metric === 'negativeCumulativeCashFlow');
        expect(issue).toBeTruthy();
        expect(issue.severity).toBe('warning');
        expect(issue.title).toBe('تدفق نقدي تراكمي سالب لعدة سنوات');
        expect(issue.value).toBe(2);
        expect(issue.explanation).toContain('2 سنة');
    });

    it('سنة واحدة فقط بتراكم سالب: لا تُدرَج (تحت الحد الأدنى)', () => {
        const results = {
            indicators: baseIndicators,
            cashFlow: [
                { year: 0, cumulative: -500000 },
                { year: 1, cumulative: -100000 },
                { year: 2, cumulative: 150000 }
            ]
        };
        const { issues } = explainDecisionBreakers({}, results);
        expect(issues.some(i => i.metric === 'negativeCumulativeCashFlow')).toBe(false);
    });

    it('سنة الصفر لا تُحتسَب حتى لو سالبة (year > 0 فقط)', () => {
        const results = {
            indicators: baseIndicators,
            cashFlow: [
                { year: 0, cumulative: -500000 },
                { year: 1, cumulative: 100000 }
            ]
        };
        const { issues } = explainDecisionBreakers({}, results);
        expect(issues.some(i => i.metric === 'negativeCumulativeCashFlow')).toBe(false);
    });
});
