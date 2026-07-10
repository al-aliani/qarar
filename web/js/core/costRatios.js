/** Return the canonical year-one cost ratios used by dashboards and advice. */
export function getCostRatios(results) {
    const year1 = results?.incomeStatement?.[0] || {};
    const revenue = Number(year1.revenue) || 0;
    if (revenue <= 0) return { cogs: 0, labor: 0, rent: 0, marketing: 0, profit: 0 };

    const opex = results?.opex || {};
    return {
        cogs: (Number(year1.variableCosts) || 0) / revenue,
        labor: (Number(opex.laborAnnual ?? opex.payrollAnnual) || 0) / revenue,
        rent: (Number(opex.rentAnnual) || 0) / revenue,
        marketing: (Number(opex.marketingAnnual) || 0) / revenue,
        profit: (Number(year1.netIncome) || 0) / revenue
    };
}
