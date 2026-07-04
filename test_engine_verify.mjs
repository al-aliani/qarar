
import { calculateStudy } from './web/js/core/engine.js';
import { createEmptyStudy } from './web/js/core/schema.js';

// Mock Data Setup (Using NEW Schema)
const study = createEmptyStudy();

// 1. CAPEX Inputs
study.technical = {
    buildings: [],
    equipment: [{ name: "Oven", count: 1, price: 50000, depreciationRate: 0.2 }], // 50k
    furniture: [{ name: "Tables", count: 10, price: 1000 }] // 10k
};
study.legal = {
    licenses: [{ name: "Muni", price: 5000 }] // 5k
};
study.marketing = {
    campaigns: [
        { name: "Launch", type: "capital", amount: 20000 }, // 20k CAPEX
        { name: "Ads", type: "operating", monthly: 1000 } // 12k/year OPEX
    ]
};

// Total CAPEX Expected: 50k + 10k + 5k + 20k = 85,000
// Working Capital (10%): 8,500
// Total Investment: 93,500

// 2. OPEX & HR
study.hr = {
    positions: [{ role: "Chef", count: 1, salary: 5000, months: 12 }],
    gosiRate: 0.10,
    healthInsurancePerHead: 1000
};
// Annual Labor: (5000 * 12) + (60000 * 0.10) + 1000 = 60k + 6k + 1k = 67,000

study.logistics = {
    logistics: [{ name: "Electricity", monthly: 1000 }, { name: "Water", monthly: 500 }]
};
// Annual Logistics: 1500 * 12 = 18,000

study.administrative = {
    administrative: []
};

// Marketing OPEX: 12,000 (from above)

// Total Fixed Opex (Year 1, excluding Dep): 67,000 + 18,000 + 12,000 = 97,000

// 3. Revenue & Variable Costs
study.services = {
    items: [
        {
            name: "Dine In",
            customersPerMonth: 600, // 20 daily * 30
            pricePerUnit: 50,
            variableCostPerUnit: 15 // 30% of 50
        }
    ]
};
// Annual Revenue: 600 * 12 * 50 = 360,000
// Annual Var Cost: 600 * 12 * 15 = 108,000

// 4. Financials
study.assumptions = {
    inflationRate: 0, // Simplify for verification
    taxRate: 0,       // Simplify
    discountRate: 0.10,
    projectionYears: 5
};

console.log("--- Starting Engine Verification (New Schema) ---");
const result = calculateStudy(study);

// Assertions
const expectedCapex = 85000;
console.log(`CAPEX Subtotal: Expected ${expectedCapex}, Got ${result.capex.subtotal} -> ${result.capex.subtotal === expectedCapex ? "PASS" : "FAIL"}`);

const expectedRev = 360000;
console.log(`Revenue Y1: Expected ${expectedRev}, Got ${result.incomeStatement[0].revenue} -> ${result.incomeStatement[0].revenue === expectedRev ? "PASS" : "FAIL"}`);

// Depreciation
// Equipment: 50k * 0.20 (custom rate) = 10,000
// Furniture: 10k * 0.20 (default in engine) = 2,000
// Total Dep = 12,000
const expectedDepreciation = 12000;
console.log(`Depreciation: Expected ${expectedDepreciation}, Got ${result.depreciation} -> ${result.depreciation === expectedDepreciation ? "PASS" : "FAIL"}`);

// Fixed Costs Y1: 97,000
console.log(`Fixed Costs Y1: Expected 97000, Got ${result.opex.fixedAnnual} -> ${result.opex.fixedAnnual === 97000 ? "PASS" : "FAIL"}`);

// Net Profit Y1
// Gross Profit: 360k - 108k = 252,000
// EBITDA: 252,000 - 97,000 = 155,000
// Depreciation: 12,000
// EBIT: 143,000
// Zakat (2.5% of EBIT): 3,575
// Net Income: 139,425
const expectedNet = 139425;
console.log(`Net Profit Y1: Expected ${expectedNet}, Got ${result.incomeStatement[0].netIncome} -> ${result.incomeStatement[0].netIncome === expectedNet ? "PASS" : "FAIL"}`);

console.log("--- Verification Complete ---");
