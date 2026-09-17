import { describe, expect, it } from 'vitest';
import { runQAChecks } from '../qaChecks.js';

const results = {
    incomeStatement: [{ revenue: 120000, netIncome: 40000 }],
    opex: { totalAnnual: 0 },
    capex: { total: 0 },
    indicators: { npv: 50000, irr: 0.18 }
};

function findIssue(qa, code) {
    return [...qa.hardErrors, ...qa.softWarnings].find((issue) => issue.code === code);
}

describe('توصيات الجودة حسب نوع النشاط', () => {
    it('لا يقترح حياً أو إيجاراً أو رخصة بلدية لمنصة رقمية', async () => {
        const state = {
            projectInfo: {
                name: 'منصة إدارة رقمية',
                sector: 'تقنية المعلومات',
                concept: 'منصة SaaS سحابية'
            },
            assumptions: { discountRate: 0.1, workingCapitalMonths: 3 },
            legal: { licenses: [] },
            marketing: { competitors: [], marketAnalysis: {} }
        };

        const qa = await runQAChecks(state, results);
        const location = findIssue(qa, 'TARGET_LOCATION_MISSING');
        const operatingCosts = findIssue(qa, 'REVENUE_WITHOUT_COSTS');
        const capex = findIssue(qa, 'NO_CAPEX');
        const licenses = findIssue(qa, 'LICENSES_MISSING');
        const combined = [location, operatingCosts, capex, licenses]
            .flatMap((issue) => [issue?.message, issue?.suggestion, JSON.stringify(issue?.suggestionAction)])
            .join(' ');

        expect(location.message).toContain('السوق الجغرافي');
        expect(location.suggestionAction.value).toBe('المملكة العربية السعودية');
        expect(operatingCosts.suggestionAction.value.items[0].name).toContain('استضافة');
        expect(capex.suggestionAction.value.items[0].name).toContain('تطوير المنتج');
        expect(licenses.suggestionAction.value.map((item) => item.name)).toContain('مراجعة الخصوصية وحماية البيانات');
        expect(combined).not.toMatch(/مقهى|حي العليا|إيجار|رخصة البلدية/);
    });

    it('يبقي تحذير SFDA محصوراً في نشاط الأغذية', async () => {
        const state = {
            projectInfo: { name: 'مقهى', sector: 'أغذية ومشروبات', concept: 'مقهى مختص' },
            assumptions: { discountRate: 0.1, workingCapitalMonths: 3 },
            legal: { licenses: [{ name: 'سجل تجاري', cost: 1200 }] },
            marketing: { competitors: [], marketAnalysis: {} }
        };

        const qa = await runQAChecks(state, results);
        expect(findIssue(qa, 'SFDA_LICENSE_MISSING')).toBeTruthy();
    });
});
