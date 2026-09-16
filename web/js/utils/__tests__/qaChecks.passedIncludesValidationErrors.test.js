/**
 * تدقيق 2026-09-16: qaResults.passed كانت تتجاهل validationErrors (أخطاء المدخلات
 * من validateInputs.js، مثل NEGATIVE_VALUE) بعكس buildDecisionQualityGate
 * (decisionQuality.js) التي تعتبرها حرجة تماماً كـhardErrors — فتظهر شارة "القرار
 * محجوب" (من البوابة المرجعية) بجانب نصوص تفترض passed=true (من هذا الحقل) في
 * نفس شاشة لوحة القرار. الآن المعنيان متطابقان دائماً بحكم البناء.
 */
import { describe, it, expect } from 'vitest';
import { runQAChecks } from '../qaChecks.js';

describe('runQAChecks — passed يشمل validationErrors', () => {
    it('مُدخل سالب حقيقي (validationErrors) بلا أي hardErrors: passed=false', async () => {
        const state = {
            assumptions: { discountRate: 0.10, workingCapitalMonths: 3 },
            revenue: { streams: [{ customersPerMonth: -5 }] } // مُدخل سالب حقيقي ⇒ validationErrors
        };
        const results = {
            incomeStatement: [{ revenue: 1000, netIncome: 1000 }],
            opex: { totalAnnual: 500 },
            indicators: { npv: 100, irr: 0.1 }
        };
        const qa = await runQAChecks(state, results);

        expect(qa.validationErrors.length).toBeGreaterThan(0);
        expect(qa.hardErrors.length).toBe(0);
        expect(qa.passed).toBe(false);
    });

    it('بلا أي أخطاء حرجة أو مُدخلات سالبة: passed=true', async () => {
        const state = { assumptions: { discountRate: 0.10, workingCapitalMonths: 3 }, revenue: { streams: [{ customersPerMonth: 100 }] } };
        const results = {
            incomeStatement: [{ revenue: 1000, netIncome: 1000 }],
            opex: { totalAnnual: 500 },
            indicators: { npv: 100, irr: 0.1 }
        };
        const qa = await runQAChecks(state, results);

        expect(qa.validationErrors.length).toBe(0);
        expect(qa.hardErrors.length).toBe(0);
        expect(qa.passed).toBe(true);
    });
});
