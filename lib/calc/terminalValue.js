/**
 * Terminal Value & Enhanced DCF Valuation
 * Calculates company value using Discounted Cash Flow with Terminal Value
 */

/**
 * Calculate Terminal Value using Gordon Growth Model
 * TV = FCF * (1 + g) / (WACC - g)
 */
export function calculateTerminalValue(lastYearFCF, wacc, terminalGrowthRate = 0.02) {
    if (wacc <= terminalGrowthRate) {
        console.warn('WACC must be greater than terminal growth rate');
        return 0;
    }

    // Gordon Growth Model
    const tv = (lastYearFCF * (1 + terminalGrowthRate)) / (wacc - terminalGrowthRate);

    return {
        lastYearFCF,
        terminalGrowthRate,
        wacc,
        terminalValue: tv,
        formula: `TV = ${lastYearFCF.toLocaleString()} × (1 + ${(terminalGrowthRate * 100).toFixed(1)}%) / (${(wacc * 100).toFixed(1)}% - ${(terminalGrowthRate * 100).toFixed(1)}%)`
    };
}

/**
 * Calculate Enterprise Value using DCF method
 */
export function calculateEnterpriseValue({
    cashFlows,
    wacc,
    terminalGrowthRate = 0.02,
    includeYear0 = false
}) {
    if (!cashFlows || cashFlows.length === 0) {
        return { enterpriseValue: 0, pvCashFlows: [], pvTerminalValue: 0 };
    }

    // Filter out year 0 (initial investment) if needed
    const operatingCashFlows = includeYear0
        ? cashFlows
        : cashFlows.filter(cf => cf.year > 0);

    // Calculate PV of each year's cash flow
    const pvCashFlows = operatingCashFlows.map(cf => {
        const pv = cf.cashFlow / Math.pow(1 + wacc, cf.year);
        return {
            year: cf.year,
            cashFlow: cf.cashFlow,
            discountFactor: 1 / Math.pow(1 + wacc, cf.year),
            presentValue: pv
        };
    });

    const totalPVCashFlows = pvCashFlows.reduce((sum, pv) => sum + pv.presentValue, 0);

    // Calculate Terminal Value
    const lastYear = operatingCashFlows[operatingCashFlows.length - 1];
    const tvResult = calculateTerminalValue(lastYear?.cashFlow || 0, wacc, terminalGrowthRate);

    // Discount Terminal Value to present
    const lastYearNum = lastYear?.year || 5;
    const pvTerminalValue = tvResult.terminalValue / Math.pow(1 + wacc, lastYearNum);

    // Enterprise Value = PV of Cash Flows + PV of Terminal Value
    const enterpriseValue = totalPVCashFlows + pvTerminalValue;

    return {
        pvCashFlows,
        totalPVCashFlows,
        terminalValue: tvResult.terminalValue,
        pvTerminalValue,
        enterpriseValue,
        breakdown: {
            cashFlowsContribution: (totalPVCashFlows / enterpriseValue * 100).toFixed(1) + '%',
            terminalValueContribution: (pvTerminalValue / enterpriseValue * 100).toFixed(1) + '%'
        },
        assumptions: {
            wacc: (wacc * 100).toFixed(2) + '%',
            terminalGrowthRate: (terminalGrowthRate * 100).toFixed(1) + '%',
            projectionYears: lastYearNum
        }
    };
}

/**
 * Calculate Equity Value
 * Equity Value = Enterprise Value - Net Debt + Cash
 */
export function calculateEquityValue({ enterpriseValue, debt = 0, cash = 0 }) {
    const netDebt = debt - cash;
    const equityValue = enterpriseValue - netDebt;

    return {
        enterpriseValue,
        debt,
        cash,
        netDebt,
        equityValue,
        formula: `Equity = ${enterpriseValue.toLocaleString()} - (${debt.toLocaleString()} - ${cash.toLocaleString()})`
    };
}

/**
 * Calculate valuation multiples
 */
export function calculateMultiples({
    enterpriseValue,
    equityValue,
    revenue,
    ebitda,
    netIncome,
    sharesOutstanding = 1
}) {
    return {
        evToRevenue: revenue > 0 ? (enterpriseValue / revenue).toFixed(2) + 'x' : 'N/A',
        evToEbitda: ebitda > 0 ? (enterpriseValue / ebitda).toFixed(2) + 'x' : 'N/A',
        priceToEarnings: netIncome > 0 ? (equityValue / netIncome).toFixed(2) + 'x' : 'N/A',
        pricePerShare: (equityValue / sharesOutstanding),
        marketCap: equityValue
    };
}

/**
 * Full DCF Valuation
 */
export function runDCFValuation(financialResults, options = {}) {
    const {
        terminalGrowthRate = 0.02,
        sharesOutstanding = 1
    } = options;

    const wacc = financialResults.wacc?.waccDecimal || 0.10;
    const cashFlows = financialResults.cashFlow || [];
    const lastBalance = financialResults.balanceSheets?.[financialResults.balanceSheets.length - 1];
    const lastIncome = financialResults.incomeStatement?.[0];
    const year1Revenue = financialResults.revenueProjection?.[0]?.total || 0;

    // Enterprise Value
    const evResult = calculateEnterpriseValue({
        cashFlows,
        wacc,
        terminalGrowthRate
    });

    // Equity Value
    const debt = lastBalance?.liabilities?.total || financialResults.loanSchedule?.loanAmount || 0;
    const cash = lastBalance?.assets?.current?.cash || financialResults.capex?.workingCapital || 0;

    const equityResult = calculateEquityValue({
        enterpriseValue: evResult.enterpriseValue,
        debt,
        cash
    });

    // Multiples
    const multiples = calculateMultiples({
        enterpriseValue: evResult.enterpriseValue,
        equityValue: equityResult.equityValue,
        revenue: year1Revenue,
        ebitda: lastIncome?.ebitda || 0,
        netIncome: lastIncome?.netIncome || 0,
        sharesOutstanding
    });

    return {
        dcf: evResult,
        equity: equityResult,
        multiples,
        summary: {
            enterpriseValue: Math.round(evResult.enterpriseValue),
            equityValue: Math.round(equityResult.equityValue),
            evFormatted: formatCurrency(evResult.enterpriseValue),
            equityFormatted: formatCurrency(equityResult.equityValue)
        }
    };
}

function formatCurrency(value) {
    if (value >= 1000000) {
        return (value / 1000000).toFixed(2) + ' مليون ريال';
    } else if (value >= 1000) {
        return (value / 1000).toFixed(0) + ' ألف ريال';
    }
    return Math.round(value).toLocaleString() + ' ريال';
}
