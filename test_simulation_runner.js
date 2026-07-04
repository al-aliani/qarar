
import { MonteCarloEngine } from './web/js/core/MonteCarloEngine.js';

// Mock Study State (Detailed to satisfy aggregators)
const mockState = {
    // CAPEX Inputs
    technical: {
        buildings: [{ name: 'Renovation', price: 50000, quantity: 1, depreciationRate: 0.1 }],
        equipment: [{ name: 'Kitchen Equipment', price: 150000, quantity: 1, depreciationRate: 0.2 }]
    },
    techResources: [
        { name: 'POS System', price: 10000, quantity: 1, depreciationRate: 0.33 }
    ],
    marketing: {
        campaigns: [
            { type: 'capital', name: 'Launch', amount: 20000 },
            { type: 'operating', name: 'Ads', monthly: 2000 }
        ]
    },

    // OPEX Inputs
    hr: {
        positions: [
            { position: 'Manager', salary: 6000, count: 1, months: 12 },
            { position: 'Chef', salary: 4000, count: 2, months: 12, isVariable: false }
        ]
    },
    logistics: [
        { name: 'Supplies', monthly: 3000, variablePercent: 0.8 }
    ],
    administrative: [
        { name: 'Utilities', monthly: 1500 }
    ],

    // Revenue Inputs
    financial: {
        revenue: {
            streams: [
                { name: 'Dine-in', customersPerMonth: 500, avgPrice: 60, growthRate: 0.05 },
                { name: 'Delivery', customersPerMonth: 300, avgPrice: 70, growthRate: 0.10 }
            ]
        }
    },

    // Assumptions
    assumptions: {
        discountRate: 0.12,
        taxRate: 0.15,
        workingCapitalMonths: 3
    }
};

console.log("🚀 Starting Monte Carlo Simulation Test...");
console.log("----------------------------------------");

try {
    const start = performance.now();
    const result = MonteCarloEngine.runSimulation(mockState, 1000, 0.20); // 1000 iterations, 20% volatility
    const end = performance.now();

    console.log(`✅ Simulation completed in ${(end - start).toFixed(2)}ms`);
    console.log(`📊 Iterations: ${result.iterations}`);
    console.log(`📈 Success Probability (NPV > 0): ${(result.stats.successProbability * 100).toFixed(1)}%`);
    console.log(`💰 Average NPV: ${new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(result.stats.avgNPV)}`);
    console.log(`📉 Min NPV: ${new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(result.stats.minNPV)}`);
    console.log(`📈 Max NPV: ${new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(result.stats.maxNPV)}`);
    
    console.log("\nSample Results (First 3):");
    console.table(result.results.slice(0, 3));

} catch (error) {
    console.error("❌ Simulation Failed:", error);
}
