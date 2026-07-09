/**
 * تدقيق ٢٠٢٦-٠٧-٠٩ — كانت explainDecisionBreakers تُصعِّد أي فجوة تمويل > 1 ريال إلى
 * «حرجة»، رغم أن fundingGap يقارن مصادر تمويل أُدخلت في خطوة سابقة من المعالج بإجمالي
 * استثمار يُعاد حسابه حياً من كل بند لاحق — أي تعديل بسيط في خطوة تالية يُحرّك الفارق
 * قليلاً (لوحظ فعلياً 945 ريالاً من 390,957 = 0.24% في اختبار عميل حي) فيظهر تناقض
 * «100/100 نقطة لكن REVISE». الإصلاح: نفس حد المادية المُطبَّق في engine.js (1% من
 * الاستثمار الإجمالي، بحد أدنى 1000 ريال).
 */
import { describe, it, expect } from 'vitest';
import { explainDecisionBreakers } from '../DecisionExplainer.js';

describe('explainDecisionBreakers — عتبة مادية فجوة التمويل (#funding-gap-materiality)', () => {
    it('فجوة صغيرة (945 من 390,957) أقل من حد المادية الجاهز في financingCheck: لا تُدرَج كسبب حرج', () => {
        const results = {
            indicators: { npv: 500000, irr: 0.5, paybackPeriod: 1, roi: 0.8, dscr: 2 },
            financingCheck: {
                fundingGap: 945,
                totalInvestment: 390957,
                fundingGapMaterialityThreshold: Math.max(1000, 390957 * 0.01)
            }
        };
        const { issues } = explainDecisionBreakers({}, results);
        expect(issues.some(i => i.metric === 'fundingGap')).toBe(false);
    });

    it('بلا fundingGapMaterialityThreshold جاهز: تُشتق نفس الصيغة (1% بحد أدنى 1000) من totalInvestment فقط', () => {
        const results = {
            indicators: { npv: 500000, irr: 0.5, paybackPeriod: 1, roi: 0.8, dscr: 2 },
            financingCheck: { fundingGap: 945, totalInvestment: 390957 }
        };
        const { issues } = explainDecisionBreakers({}, results);
        expect(issues.some(i => i.metric === 'fundingGap')).toBe(false);
    });

    it('فجوة حقيقية كبيرة (تتجاوز حد المادية) لا تزال تُدرَج كسبب حرج', () => {
        const results = {
            indicators: { npv: 500000, irr: 0.5, paybackPeriod: 1, roi: 0.8, dscr: 2 },
            financingCheck: {
                fundingGap: 50000,
                totalInvestment: 390957,
                fundingGapMaterialityThreshold: Math.max(1000, 390957 * 0.01)
            }
        };
        const { issues } = explainDecisionBreakers({}, results);
        const issue = issues.find(i => i.metric === 'fundingGap');
        expect(issue).toBeTruthy();
        expect(issue.severity).toBe('critical');
    });
});
