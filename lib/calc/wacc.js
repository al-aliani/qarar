/**
 * WACC Calculator (Weighted Average Cost of Capital)
 * Used as discount rate for NPV calculations
 */

export function computeWACC(financing, taxRate = 0.15, options = {}) {
    const {
        riskFreeRate = 0.03,      // Saudi government bonds ~3%
        marketPremium = 0.06,     // Market risk premium ~6%
        beta = 1.2                // Industry beta (adjustable)
    } = options;

    const totalInvestment = financing.totalInvestment || 0;
    if (totalInvestment <= 0) {
        return { wacc: 0.10, waccDecimal: 0.10 }; // Default 10%
    }

    const equityAmount = financing.sources?.equity?.amount || 0;
    const debtAmount = financing.sources?.bankLoan?.amount || 0;
    const interestRate = financing.sources?.bankLoan?.interestRate || 0.08;

    // Weights
    const equityWeight = equityAmount / totalInvestment;
    const debtWeight = debtAmount / totalInvestment;

    // Cost of Equity (CAPM: Ke = Rf + β(Rm - Rf))
    const costOfEquity = riskFreeRate + (beta * marketPremium);

    // Cost of Debt (after tax shield)
    const costOfDebt = interestRate * (1 - taxRate);

    // WACC = (E/V × Ke) + (D/V × Kd × (1-T))
    const wacc = (equityWeight * costOfEquity) + (debtWeight * costOfDebt);

    return {
        totalInvestment,
        equityAmount,
        debtAmount,
        equityWeight: (equityWeight * 100).toFixed(1),
        debtWeight: (debtWeight * 100).toFixed(1),
        costOfEquity: (costOfEquity * 100).toFixed(1),
        costOfDebtPreTax: (interestRate * 100).toFixed(1),
        costOfDebtPostTax: (costOfDebt * 100).toFixed(1),
        wacc: (wacc * 100).toFixed(2),
        waccDecimal: wacc || 0.10 // Fallback to 10%
    };
}

/**
 * Get appropriate discount rate
 * Uses WACC if financing data available, otherwise uses assumption
 */
export function getDiscountRate(studyData) {
    const financing = studyData.financing;
    const assumptions = studyData.assumptions || {};

    // If significant debt financing exists, use WACC
    if (financing?.sources?.bankLoan?.amount > 0) {
        const waccResult = computeWACC(financing, assumptions.taxRate);
        return waccResult.waccDecimal;
    }

    // Otherwise use assumption discount rate
    return assumptions.discountRate || 0.10;
}
