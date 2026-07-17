import { describe, it, expect } from 'vitest';
import { buildFinancialRatios } from '../ratios.js';
import { calculateStudy } from '../../engine.js';
import { SECTIONS } from '../../schema.js';

function bs(overrides = {}) {
    return {
        year: 1,
        assets: {
            current: { cash: 100, accountsReceivable: 0, inventory: 50, total: 150 },
            fixed: { gross: 200, accumulatedDepreciation: 0, net: 200 },
            total: 350
        },
        liabilities: {
            current: { accountsPayable: 0, currentPortionOfDebt: 0, total: 100 },
            longTerm: { bankLoan: 0, total: 0 },
            total: 100
        },
        equity: { paidInCapital: 250, retainedEarnings: 0, total: 250 },
        ...overrides
    };
}

describe('buildFinancialRatios', () => {
    it('computes liquidity/debt/turnover/profitability ratios from known figures', () => {
        const income = [{ year: 1, revenue: 1000, netIncome: 100 }];
        const balance = [bs()];
        const [row] = buildFinancialRatios(income, balance);

        expect(row.currentRatio).toBeCloseTo(150 / 100, 5);
        expect(row.quickRatio).toBeCloseTo((150 - 50) / 100, 5);
        expect(row.cashRatio).toBeCloseTo(100 / 100, 5);
        expect(row.debtRatio).toBeCloseTo(100 / 350, 5);
        expect(row.debtToEquity).toBeCloseTo(100 / 250, 5);
        expect(row.assetTurnover).toBeCloseTo(1000 / 350, 5);
        expect(row.fixedAssetTurnover).toBeCloseTo(1000 / 200, 5);
        expect(row.roa).toBeCloseTo(100 / 350, 5);
        expect(row.roe).toBeCloseTo(100 / 250, 5);
    });

    it('returns null fixedAssetTurnover instead of an exploding ratio once assets are fully depreciated', () => {
        const income = [{ year: 5, revenue: 1000, netIncome: 100 }];
        const balance = [bs({ year: 5, assets: { current: { cash: 100, inventory: 0, total: 100 }, fixed: { gross: 200, accumulatedDepreciation: 200, net: 0 }, total: 100 } })];
        const [row] = buildFinancialRatios(income, balance);
        expect(row.fixedAssetTurnover).toBeNull();
    });

    it('does not crash and returns null ratios when there is no balance sheet for a year', () => {
        const income = [{ year: 1, revenue: 1000, netIncome: 100 }];
        const [row] = buildFinancialRatios(income, []);
        expect(row.currentRatio).toBeNull();
        expect(row.roe).toBeNull();
    });

    it('handles empty inputs without throwing', () => {
        expect(buildFinancialRatios(null, null)).toEqual([]);
        expect(buildFinancialRatios([], [])).toEqual([]);
    });
});

describe('engine wiring — result.ratios / result.assetSchedule', () => {
    function createMinimalStudy(overrides = {}) {
        const base = {
            [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
            assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 },
            [SECTIONS.TECHNICAL]: {
                equipment: [{ name: 'ماكينة تعبئة', price: 50000, quantity: 1 }],
                buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
            },
            [SECTIONS.HR]: { positions: [] },
            [SECTIONS.LOGISTICS]: { logistics: [] },
            [SECTIONS.ADMINISTRATIVE]: { administrative: [] },
            [SECTIONS.MARKETING]: { campaigns: [] },
            [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate: 0.30 }] },
            [SECTIONS.SERVICES]: { items: [] },
            [SECTIONS.FINANCING]: { sources: {} },
            [SECTIONS.TECH_RESOURCES]: { techResources: [] },
            [SECTIONS.LEGAL]: { licenses: [] }
        };
        return { ...base, ...overrides };
    }

    it('exposes a ratios row per income-statement year', () => {
        const result = calculateStudy(createMinimalStudy());
        expect(Array.isArray(result.ratios)).toBe(true);
        expect(result.ratios.length).toBe(result.incomeStatement.length);
        expect(result.ratios[0]).toHaveProperty('currentRatio');
    });

    it('exposes a named per-asset depreciation schedule', () => {
        const result = calculateStudy(createMinimalStudy());
        expect(Array.isArray(result.assetSchedule)).toBe(true);
        const equipmentRow = result.assetSchedule.find(a => a.category === 'Equipment');
        expect(equipmentRow).toBeTruthy();
        expect(equipmentRow.name).toBe('ماكينة تعبئة');
        expect(Array.isArray(equipmentRow.byYear)).toBe(true);
        expect(equipmentRow.byYear.length).toBe(5);
    });
});
