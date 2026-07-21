import { describe, expect, it } from 'vitest';
import { buildDecisionQualityGate } from '../decisionQuality.js';
import { buildFinancingDiagnostics } from '../financingDiagnostics.js';
import { buildIndicatorInsights } from '../indicatorInsights.js';

describe('تجربة القرار — مصدر حقيقة موحد', () => {
    it('يحجب القرار عند وجود أخطاء حرجة ويُرجع خطوات إصلاح عملية', () => {
        const gate = buildDecisionQualityGate({
            hardErrors: [{ code: 'NO_REVENUE', path: 'revenue', message: 'لا توجد إيرادات' }],
            softWarnings: [{ code: 'REFERENCES_MISSING', path: 'appendices.references', message: 'لا توجد مصادر' }],
            validationErrors: [],
            validationWarnings: []
        });

        expect(gate.locked).toBe(true);
        expect(gate.status).toBe('blocked');
        expect(gate.score).toBeLessThan(80);
        expect(gate.actions[0]).toMatchObject({ message: 'لا توجد إيرادات', severity: 'hard' });
        expect(Number.isInteger(gate.actions[0].stepIndex)).toBe(true);
    });

    it('لا يصف فائض التمويل بأنه جاهز بنكياً', () => {
        const diagnostics = buildFinancingDiagnostics(
            { financing: { sources: { equity: { amount: 500000 }, bankLoan: { amount: 0 } } } },
            {
                financingCheck: { fundingGap: -435920, fundingGapMaterialityThreshold: 1000, totalInvestment: 64080 },
                indicators: { dscr: null, dscrReason: 'no_debt_service' },
                incomeStatement: [{ ebitda: 100000 }]
            }
        );

        expect(diagnostics.bankReady).toBe(false);
        expect(diagnostics.alerts.some((item) => item.type === 'funding-surplus')).toBe(true);
    });

    it('يشرح المؤشرات بلغة قرار ويحدد مصدر الرقم والخطوة التالية', () => {
        const insights = buildIndicatorInsights({
            indicators: { npv: 250000, irr: 0.21, paybackPeriod: 2.8, dscr: 1.1 },
            financingCheck: { totalInvestment: 500000 }
        }, { financing: { targetDSCR: 1.25 } });

        const npv = insights.find((item) => item.key === 'npv');
        const dscr = insights.find((item) => item.key === 'dscr');
        expect(npv.status).toBe('good');
        expect(npv.source).toContain('التدفقات النقدية');
        expect(dscr.status).toBe('warning');
        expect(dscr.action).toContain('القرض');
    });
});
