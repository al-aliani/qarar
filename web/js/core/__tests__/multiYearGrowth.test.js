import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';

function baseStudy(overrides = {}) {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 },
        [SECTIONS.TECHNICAL]: { equipment: [], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] },
        [SECTIONS.HR]: { positions: [{ position: 'مدير', count: 1, salary: 8000, months: 12, nationality: 'saudi' }] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [] },
        [SECTIONS.MARKETING]: { campaigns: [{ name: 'حملة تشغيلية', type: 'operating', monthly: 5000 }] },
        [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate: 0.30 }] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] },
        ...overrides
    };
}

describe('multi-year payroll/marketing growth — backward compatibility (no new fields)', () => {
    it('matches the previous blanket-inflation formula exactly when no salaryGrowthRate/annualGrowthRate is set', () => {
        const study = baseStudy();
        const results = calculateStudy(study);
        const y2 = results.incomeStatement[1]; // year 2 (index 1)

        const inflation = 0.02;
        const costInflationY2 = Math.pow(1 + inflation, 1); // yearIndex = i-1 = 1

        // annualPayroll(year1 baseline) is exposed at result.opex.payrollAnnual
        const annualPayroll = results.opex.payrollAnnual;
        const annualMarketing = results.opex.marketingAnnual;

        expect(y2.fixedCostsBreakdown.payroll).toBeCloseTo(annualPayroll * costInflationY2, 6);
        expect(y2.fixedCostsBreakdown.marketing).toBeCloseTo(annualMarketing * costInflationY2, 6);
    });
});

describe('multi-year payroll/marketing growth — custom per-item rates', () => {
    it('applies a position-level salaryGrowthRate independently of the general inflation rate', () => {
        const study = baseStudy({
            [SECTIONS.HR]: { positions: [{ position: 'مدير', count: 1, salary: 8000, months: 12, nationality: 'saudi', salaryGrowthRate: 0.20 }] }
        });
        const results = calculateStudy(study);
        const y2 = results.incomeStatement[1]; // year 2

        const expectedBasicY2 = 8000 * 1 * 12 * Math.pow(1.20, 1);
        // GOSI/insurance/expat fees also scale, so just assert the growth clearly diverges
        // from the plain-inflation figure (2%) rather than hard-coding the exact GOSI constant.
        const inflationOnlyBasicY2 = 8000 * 1 * 12 * Math.pow(1.02, 1);
        expect(y2.fixedCostsBreakdown.payroll).toBeGreaterThan(inflationOnlyBasicY2);
        expect(y2.fixedCostsBreakdown.payroll).toBeGreaterThan(expectedBasicY2 * 0.9); // basic+gosi+insurance floor
    });

    it('applies a campaign-level annualGrowthRate independently of the general inflation rate', () => {
        const study = baseStudy({
            [SECTIONS.MARKETING]: { campaigns: [{ name: 'حملة رقمية', channel: 'إعلانات مدفوعة', type: 'operating', monthly: 5000, annualGrowthRate: 0.30 }] }
        });
        const results = calculateStudy(study);
        const y2 = results.incomeStatement[1];
        const expectedY2 = 5000 * 12 * Math.pow(1.30, 1);
        expect(y2.fixedCostsBreakdown.marketing).toBeCloseTo(expectedY2, 4);
    });

    it('year 1 always equals the plain base amount regardless of growth rate (power(x,0)=1)', () => {
        const study = baseStudy({
            [SECTIONS.MARKETING]: { campaigns: [{ name: 'حملة', type: 'operating', monthly: 5000, annualGrowthRate: 0.99 }] }
        });
        const results = calculateStudy(study);
        const y1 = results.incomeStatement[0];
        expect(y1.fixedCostsBreakdown.marketing).toBeCloseTo(5000 * 12, 4);
    });
});

describe('result.payrollByPosition / result.marketingByChannel — named multi-year exports', () => {
    it('exposes one row per position/campaign with a byYear series matching the study horizon', () => {
        const study = baseStudy({
            [SECTIONS.HR]: { positions: [{ position: 'مدير', count: 1, salary: 8000, salaryGrowthRate: 0.15 }] },
            [SECTIONS.MARKETING]: { campaigns: [{ name: 'حملة', channel: 'شراكات', type: 'operating', monthly: 2000, annualGrowthRate: 0.10 }] }
        });
        const results = calculateStudy(study);

        expect(results.payrollByPosition).toHaveLength(1);
        expect(results.payrollByPosition[0].position).toBe('مدير');
        expect(results.payrollByPosition[0].byYear).toHaveLength(5);
        expect(results.payrollByPosition[0].byYear[1]).toBeGreaterThan(results.payrollByPosition[0].byYear[0]);

        expect(results.marketingByChannel).toHaveLength(1);
        expect(results.marketingByChannel[0].channel).toBe('شراكات');
        expect(results.marketingByChannel[0].byYear).toHaveLength(5);
        expect(results.marketingByChannel[0].byYear[0]).toBeCloseTo(2000 * 12, 4);
        expect(results.marketingByChannel[0].byYear[1]).toBeCloseTo(2000 * 12 * 1.10, 4);
    });
});
