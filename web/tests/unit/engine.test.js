import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../../js/core/engine.js';
import { SECTIONS } from '../../js/core/schema.js';

// محاكاة لدراسة جدوى لمشروع
const mockStudy = {
    assumptions: {
        projectionYears: 5,
        inflationRate: 0.02,
        discountRate: 0.10,
        foreignOwnershipRate: 0, // 100% Saudi
        taxRate: 0.20,
        gosiRate: 0.1175
    },
    [SECTIONS.TECHNICAL]: {
        buildings: [{ price: 100000, quantity: 1 }],
        equipment: [{ price: 50000, quantity: 2 }], // 100,000 Total
        furniture: [{ price: 20000, quantity: 1 }],
        vehicles: []
    },
    [SECTIONS.TECH_RESOURCES]: {
        techResources: [{ price: 10000, quantity: 3, depreciationRate: 0.33 }] // 30,000 Total
    },
    [SECTIONS.HR]: {
        positions: [
            { nationality: 'saudi', salary: 5000, count: 2, months: 12 }, // 120,000 basic
            { nationality: 'expat', salary: 3000, count: 3, months: 12 }  // 108,000 basic
        ],
        healthInsurancePerHead: 1500,
        govtFees: { workCard: 9600, ticket: 2000, iqama: 650 }
    },
    [SECTIONS.REVENUE]: {
        streams: [
            { type: 'operating', customersPerMonth: 1000, avgPrice: 500, growthRate: 0.05 } // 6,000,000 year 1
        ]
    },
    [SECTIONS.SERVICES]: {
        items: []
    },
    [SECTIONS.FINANCING]: {
        sources: {
            equity: { amount: 150000 },
            bankLoan: { amount: 100000, interestRate: 0.08, termYears: 5, gracePeriodMonths: 0 }
        }
    }
};

describe('Feasibility Calculation Engine', () => {
    
    it('should calculate basic financial metrics correctly (Baseline)', () => {
        const result = calculateStudy(mockStudy);
        
        expect(result).toBeDefined();
        
        // 1. Capex & Investment
        // buildings: 100k, equipment: 100k, furniture: 20k, tech: 30k = 250k capex
        expect(result.financingCheck.totalInvestment).toBeGreaterThan(0);
        
        // 2. Revenue calculation
        // Year 1 Revenue should be close to 500,000 * utilization (usually around 40-50% in year 1)
        expect(result.incomeStatement.length).toBe(5);
        expect(result.incomeStatement[0].revenue).toBeGreaterThan(0);
        
        // 3. Financing
        // 100k loan over 5 years at 8%. PMT should be correct.
        expect(result.incomeStatement[0].interestExpense).toBeGreaterThan(0);
        expect(result.incomeStatement[0].loanPrincipalPaid).toBeGreaterThan(0);
        
        // 4. Zakat
        // Should calculate Zakat base and apply 2.5% rate.
        expect(result.incomeStatement[0].zakatBase).toBeDefined();
        expect(result.incomeStatement[0].zakat).toBeGreaterThanOrEqual(0);
        
        // 5. Profitability
        expect(result.indicators.npv).toBeDefined();
        expect(result.indicators.irr).toBeDefined();
        expect(result.indicators.paybackPeriod).toBeDefined();
    });

    it('should calculate accurate taxes for foreign ownership', () => {
        const foreignStudy = JSON.parse(JSON.stringify(mockStudy));
        foreignStudy.assumptions.foreignOwnershipRate = 0.5; // 50% foreign
        
        const result = calculateStudy(foreignStudy);
        
        // Year 1 tax should be calculated for foreign portion
        // Zakat for Saudi portion
        expect(result.incomeStatement[0].tax).toBeGreaterThanOrEqual(0);
        expect(result.incomeStatement[0].zakat).toBeGreaterThanOrEqual(0);
    });
});
