import { describe, expect, it } from 'vitest';
import { getCostRatios } from '../costRatios.js';

describe('getCostRatios', () => {
    it('uses year-one labor and rent drivers instead of the combined rent/admin total', () => {
        const results = {
            incomeStatement: [{ revenue: 100000, variableCosts: 30000, netIncome: 12000 }],
            opex: { payrollAnnual: 20000, rentAnnual: 8000, rentAdminAnnual: 50000, marketingAnnual: 4000 }
        };

        expect(getCostRatios(results)).toEqual({
            cogs: 0.3,
            labor: 0.2,
            rent: 0.08,
            marketing: 0.04,
            profit: 0.12
        });
    });
});
