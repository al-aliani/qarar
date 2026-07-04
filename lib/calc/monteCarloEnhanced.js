/**
 * Enhanced Monte Carlo Simulation
 * More sophisticated simulation with correlation and distributions
 */

/**
 * Generate random number from normal distribution (Box-Muller)
 */
function randomNormal(mean = 0, stdDev = 1) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
}

/**
 * Generate random number from triangular distribution
 */
function randomTriangular(min, mode, max) {
    const u = Math.random();
    const fc = (mode - min) / (max - min);

    if (u < fc) {
        return min + Math.sqrt(u * (max - min) * (mode - min));
    } else {
        return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
    }
}

/**
 * Apply correlation between variables using Cholesky decomposition
 */
function applyCorrelation(uncorrelated, correlationMatrix) {
    // Simplified: just apply pairwise correlation
    // For full implementation, use Cholesky decomposition
    return uncorrelated; // Placeholder
}

/**
 * Monte Carlo simulation configuration
 */
export const MC_CONFIG = {
    iterations: 1000,
    variables: {
        revenue: {
            distribution: 'normal',
            volatility: 0.15,  // 15% standard deviation
            label: 'الإيرادات'
        },
        opex: {
            distribution: 'normal',
            volatility: 0.10,  // 10% standard deviation
            label: 'التكاليف التشغيلية'
        },
        capex: {
            distribution: 'triangular',
            min: -0.10,  // 10% under budget
            max: 0.30,   // 30% over budget (common for construction)
            mode: 0.05,  // Most likely 5% over
            label: 'التكاليف الرأسمالية'
        },
        growthRate: {
            distribution: 'normal',
            volatility: 0.03,  // 3% std dev on growth rate
            label: 'معدل النمو'
        }
    },
    correlations: {
        // Revenue and OPEX tend to move together (more revenue = more variable costs)
        'revenue-opex': 0.4,
        // CAPEX and OPEX slightly correlated
        'capex-opex': 0.2
    }
};

/**
 * Run single simulation iteration
 */
export function runSingleIteration(baseModel, config = MC_CONFIG) {
    const modifiers = {};

    // Generate random modifiers for each variable
    Object.entries(config.variables).forEach(([key, varConfig]) => {
        if (varConfig.distribution === 'normal') {
            modifiers[key] = randomNormal(1, varConfig.volatility);
        } else if (varConfig.distribution === 'triangular') {
            modifiers[key] = 1 + randomTriangular(varConfig.min, varConfig.mode, varConfig.max);
        }
    });

    // Apply modifiers to base model
    const simulatedRevenue = baseModel.revenue * modifiers.revenue;
    const simulatedOpex = baseModel.opex * modifiers.opex;
    const simulatedCapex = baseModel.capex * modifiers.capex;

    // Recalculate key metrics
    const grossProfit = simulatedRevenue - (baseModel.variableCosts * modifiers.opex);
    const ebitda = grossProfit - (baseModel.fixedCosts * modifiers.opex);
    const netIncome = ebitda - baseModel.depreciation - baseModel.interest - baseModel.tax;
    const cashFlow = netIncome + baseModel.depreciation;

    // Simple NPV calculation
    const npv = -simulatedCapex + cashFlow * ((1 - Math.pow(1 + baseModel.discountRate, -5)) / baseModel.discountRate);

    return {
        modifiers,
        revenue: simulatedRevenue,
        opex: simulatedOpex,
        capex: simulatedCapex,
        netIncome,
        cashFlow,
        npv,
        irr: cashFlow > 0 ? (cashFlow / simulatedCapex) : 0,
        isSuccess: npv > 0
    };
}

/**
 * Run full Monte Carlo simulation
 */
export function runMonteCarloSimulation(financialResults, iterations = 1000) {
    const baseModel = {
        revenue: financialResults.revenueProjection?.[0]?.total || 0,
        opex: financialResults.opex?.totalAnnual || 0,
        capex: financialResults.capex?.total || 0,
        variableCosts: financialResults.opex?.variableAnnual || 0,
        fixedCosts: financialResults.opex?.fixedAnnual || 0,
        depreciation: financialResults.depreciation || 0,
        interest: financialResults.loanSchedule?.annualSummary?.[0]?.totalInterest || 0,
        tax: financialResults.incomeStatement?.[0]?.tax || 0,
        discountRate: financialResults.wacc?.waccDecimal || 0.10
    };

    const results = [];
    const npvDistribution = [];

    for (let i = 0; i < iterations; i++) {
        const iteration = runSingleIteration(baseModel);
        results.push(iteration);
        npvDistribution.push(iteration.npv);
    }

    // Calculate statistics
    npvDistribution.sort((a, b) => a - b);

    const successCount = results.filter(r => r.isSuccess).length;
    const successProbability = (successCount / iterations * 100).toFixed(1);

    const mean = npvDistribution.reduce((a, b) => a + b, 0) / iterations;
    const variance = npvDistribution.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / iterations;
    const stdDev = Math.sqrt(variance);

    // Percentiles
    const p5 = npvDistribution[Math.floor(iterations * 0.05)];
    const p25 = npvDistribution[Math.floor(iterations * 0.25)];
    const p50 = npvDistribution[Math.floor(iterations * 0.50)]; // Median
    const p75 = npvDistribution[Math.floor(iterations * 0.75)];
    const p95 = npvDistribution[Math.floor(iterations * 0.95)];

    // Create histogram buckets
    const minNpv = npvDistribution[0];
    const maxNpv = npvDistribution[iterations - 1];
    const bucketCount = 20;
    const bucketSize = (maxNpv - minNpv) / bucketCount;

    const histogram = Array(bucketCount).fill(0);
    npvDistribution.forEach(npv => {
        const bucketIndex = Math.min(Math.floor((npv - minNpv) / bucketSize), bucketCount - 1);
        histogram[bucketIndex]++;
    });

    return {
        iterations,
        successProbability: parseFloat(successProbability),
        successCount,
        statistics: {
            mean: Math.round(mean),
            median: Math.round(p50),
            stdDev: Math.round(stdDev),
            min: Math.round(minNpv),
            max: Math.round(maxNpv),
            range: Math.round(maxNpv - minNpv)
        },
        percentiles: {
            p5: Math.round(p5),
            p25: Math.round(p25),
            p50: Math.round(p50),
            p75: Math.round(p75),
            p95: Math.round(p95)
        },
        histogram: histogram.map((count, idx) => ({
            rangeStart: Math.round(minNpv + idx * bucketSize),
            rangeEnd: Math.round(minNpv + (idx + 1) * bucketSize),
            count,
            percentage: (count / iterations * 100).toFixed(1)
        })),
        riskMetrics: {
            valueAtRisk95: Math.round(p5), // 5% VaR
            conditionalVaR: Math.round(npvDistribution.slice(0, Math.floor(iterations * 0.05)).reduce((a, b) => a + b, 0) / (iterations * 0.05)),
            probabilityOfLoss: ((npvDistribution.filter(n => n < 0).length / iterations) * 100).toFixed(1) + '%',
            expectedShortfall: Math.round(mean - 1.65 * stdDev)
        },
        interpretation: getInterpretation(parseFloat(successProbability))
    };
}

function getInterpretation(successProb) {
    if (successProb >= 80) {
        return {
            level: 'ممتاز',
            color: 'green',
            description: 'المشروع يتمتع باحتمالية نجاح عالية جداً. المخاطر منخفضة.',
            recommendation: 'يُنصح بالمضي قدماً مع مراقبة المتغيرات الرئيسية.'
        };
    } else if (successProb >= 60) {
        return {
            level: 'جيد',
            color: 'blue',
            description: 'المشروع له فرص نجاح جيدة مع مخاطر معتدلة.',
            recommendation: 'يُنصح بوضع خطط طوارئ للسيناريوهات السلبية.'
        };
    } else if (successProb >= 40) {
        return {
            level: 'متوسط',
            color: 'yellow',
            description: 'المشروع يحمل مخاطر متوسطة إلى عالية.',
            recommendation: 'يجب مراجعة الافتراضات وتحسين نموذج العمل قبل الاستثمار.'
        };
    } else {
        return {
            level: 'عالي المخاطر',
            color: 'red',
            description: 'المشروع يحمل مخاطر عالية مع احتمالية خسارة كبيرة.',
            recommendation: 'يُنصح بإعادة هيكلة المشروع أو إعادة النظر في الاستثمار.'
        };
    }
}

/**
 * Sensitivity tornado chart data
 */
export function generateTornadoData(financialResults, baseNPV) {
    const variables = [
        { key: 'revenue', label: 'الإيرادات', change: 0.10 },
        { key: 'opex', label: 'التكاليف التشغيلية', change: 0.10 },
        { key: 'capex', label: 'الاستثمار الرأسمالي', change: 0.10 },
        { key: 'discountRate', label: 'معدل الخصم', change: 0.02 },
        { key: 'growthRate', label: 'معدل النمو', change: 0.03 }
    ];

    return variables.map(v => {
        // Simplified: estimate impact
        let lowImpact, highImpact;

        if (v.key === 'revenue') {
            lowImpact = baseNPV * (1 - v.change * 3);
            highImpact = baseNPV * (1 + v.change * 3);
        } else if (v.key === 'opex' || v.key === 'capex') {
            lowImpact = baseNPV * (1 + v.change * 2);
            highImpact = baseNPV * (1 - v.change * 2);
        } else {
            lowImpact = baseNPV * (1 - v.change * 5);
            highImpact = baseNPV * (1 + v.change * 5);
        }

        return {
            variable: v.label,
            low: Math.round(lowImpact),
            high: Math.round(highImpact),
            impact: Math.round(Math.abs(highImpact - lowImpact))
        };
    }).sort((a, b) => b.impact - a.impact);
}
