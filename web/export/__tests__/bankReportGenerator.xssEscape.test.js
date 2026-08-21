import { describe, it, expect } from 'vitest';
import { BankReportGenerator } from '../BankReportGenerator.js';

function makeStore(state) {
    return { getState: () => state };
}

const BASE_STATE = {
    projectInfo: { name: 'مشروع اختبار', concept: 'اختبار' },
    financing: {
        sources: { bankLoan: { amount: 100000, bank: '' } },
    },
};

/**
 * تدقيق أمني 2026-08-21: الملخص التنفيذي وجدول المخاطر كانا يُحقنان بلا bankEsc —
 * XSS مخزَّن ينفَّذ بمتصفح المراجع عبر document.write عند معاينة دراسة (ReviewerDashboardView).
 */
describe('BankReportGenerator — تهريب HTML بالملخص التنفيذي وجدول المخاطر', () => {
    it('نص حر بالملخص التنفيذي يُهرَّب ولا يُنفَّذ كوسم HTML خام', () => {
        const state = {
            ...BASE_STATE,
            executiveSummary: { projectOverview: '<script>alert(1)</script>' },
        };
        const html = BankReportGenerator.generateHTML(makeStore(state));
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('aiGeneratedText كنص احتياطي يُهرَّب أيضاً', () => {
        const state = {
            ...BASE_STATE,
            executiveSummary: { aiGeneratedText: '<img src=x onerror=alert(1)>' },
        };
        const html = BankReportGenerator.generateHTML(makeStore(state));
        expect(html).not.toContain('<img src=x onerror=alert(1)>');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('حقول جدول المخاطر (الاسم/الاحتمالية/التأثير/خطة المواجهة) تُهرَّب جميعها', () => {
        const state = {
            ...BASE_STATE,
            riskAnalysis: {
                risks: [{
                    name: '<script>alert("name")</script>',
                    probability: '<script>alert("prob")</script>',
                    impact: '<script>alert("impact")</script>',
                    mitigation: '<img src=x onerror=alert("mitigation")>',
                }],
            },
        };
        const html = BankReportGenerator.generateHTML(makeStore(state));
        expect(html).not.toContain('<script>alert("name")</script>');
        expect(html).not.toContain('<script>alert("prob")</script>');
        expect(html).not.toContain('<script>alert("impact")</script>');
        expect(html).not.toContain('<img src=x onerror=alert("mitigation")>');
        expect(html).toContain('&lt;script&gt;alert(&quot;name&quot;)&lt;/script&gt;');
    });

    it('نص عادي بلا وسوم يبقى يظهر طبيعياً بالملخص التنفيذي (لا انحدار وظيفي)', () => {
        const state = {
            ...BASE_STATE,
            executiveSummary: { projectOverview: 'مشروع مطعم شاورما في الرياض' },
        };
        const html = BankReportGenerator.generateHTML(makeStore(state));
        expect(html).toContain('مشروع مطعم شاورما في الرياض');
    });
});
