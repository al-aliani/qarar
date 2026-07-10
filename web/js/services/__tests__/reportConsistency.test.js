import { describe, expect, it } from 'vitest';
import { createEmptyStudy } from '../../core/schema.js';
import { calculateStudy } from '../../core/engine.js';
import { ReportGenerator } from '../ReportGenerator.js';
import { formatCurrency } from '../../utils/formatters.js';

describe('report consistency', () => {
    it('uses the same engine NPV and IRR values in the HTML report', () => {
        const state = createEmptyStudy();
        state.projectInfo.name = 'اختبار تقرير';
        state.projectInfo.concept = 'خدمة';
        state.revenue.streams = [{ name: 'خدمة', customersPerMonth: 1000, avgPrice: 100, variableCostRate: 0.3, growthRate: 0 }];
        state.assumptions.discountRate = 0.1;
        state.assumptions.workingCapitalMonths = 3;
        const results = calculateStudy(state);
        const html = ReportGenerator.generateHTML({ getState: () => state });

        expect(html).toContain(formatCurrency(results.indicators.npv));
        expect(html).toContain(`${(Number(results.indicators.irr || 0) * 100).toFixed(1)}%`);
    });
});
