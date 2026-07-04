/**
 * Monte Carlo Simulation Engine
 * Runs thousands of scenarios to assess risk
 */
import { calculateStudy as runFullModel } from './engine.js';

export class MonteCarloEngine {
    /**
     * Run simulation
     * @param {Object} baseState - The base study state
     * @param {number} iterations - Number of runs (default 1000)
     * @param {number} volatility - Standard deviation for variations (default 0.15 or 15%)
     */
    static runSimulation(baseState, iterations = 1000, volatility = 0.15) {
        const results = [];
        let successCount = 0; // NPV > 0

        // Helper: Random normal distribution (Box-Muller transform)
        const randNormal = (mean, stdDev) => {
            const u = 1 - Math.random();
            const v = Math.random();
            const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            return mean + z * stdDev;
        };

        for (let i = 0; i < iterations; i++) {
            // Generate random variations for key drivers
            // We assume Independent Log-Normal distributions for factors to avoid negative multipliers easily? 
            // Or simple Normal distribution around 0 for percentage change.
            // Using Normal distribution around 0 (no change) with volatility as StdDev.

            const revenueChange = randNormal(0, volatility);
            const costChange = randNormal(0, volatility * 0.8); // Costs usually less volatile than revenue?
            const capexChange = randNormal(0, volatility * 0.5); // CAPEX usually more fixed once planned

            try {
                // Run model with these overrides
                const output = runFullModel(baseState, {
                    revenueChange,
                    costChange,
                    capexChange
                });

                const kpis = output.indicators;
                results.push({
                    npv: kpis.npv,
                    irr: kpis.irr,
                    roi: kpis.roi,
                    revenueChange,
                    costChange
                });

                if (kpis.npv > 0) successCount++;
            } catch (err) {
                console.warn('Simulation run failed', err);
            }
        }

        // Aggregate statistics
        // Aggregate statistics
        const npvValues = results.map(r => r.npv).sort((a, b) => a - b);

        const calcPercentile = (arr, p) => {
            const index = Math.floor(p * arr.length);
            return arr[Math.min(index, arr.length - 1)];
        };

        const minNPV = npvValues[0];
        const maxNPV = npvValues[npvValues.length - 1];
        const avgNPV = npvValues.reduce((a, b) => a + b, 0) / npvValues.length;

        // Key Risk Indicators
        const p10 = calcPercentile(npvValues, 0.10); // Pessimistic (90% chance to be higher)
        const p50 = calcPercentile(npvValues, 0.50); // Median / Base
        const p90 = calcPercentile(npvValues, 0.90); // Optimistic (10% chance to be higher)

        const successProbability = successCount / iterations;

        // Generate Histogram Data (20 bins)
        const binCount = 20;
        const range = maxNPV - minNPV;
        const binSize = range / binCount;
        const histogram = new Array(binCount).fill(0).map((_, i) => ({
            binStart: minNPV + (i * binSize),
            binEnd: minNPV + ((i + 1) * binSize),
            count: 0
        }));

        npvValues.forEach(val => {
            let binIdx = Math.floor((val - minNPV) / binSize);
            if (binIdx >= binCount) binIdx = binCount - 1; // Handle max value
            histogram[binIdx].count++;
        });

        return {
            iterations,
            results, // Raw data (optional, can be heavy)
            stats: {
                minNPV,
                maxNPV,
                avgNPV,
                p10,
                p50,
                p90,
                successProbability
            },
            histogram // For UI Chart
        };
    }
}
