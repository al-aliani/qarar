/**
 * Zakat and Tax Calculator
 */

export function calculateZakatAndTax(netProfit, zakatBase) {
    const zakatRate = 0.025; // 2.5%
    const taxRate = 0.15;    // 15% Corporate Tax
    
    // Zakat is usually on Zakat Base (Equity + Net Profit + Long Term Liabilities - Fixed Assets)
    // For simplicity here, we use a proxy if zakatBase is not fully calculated
    const base = zakatBase || netProfit; 
    
    const zakat = (base > 0) ? base * zakatRate : 0;
    
    // Tax is on Net Profit after Zakat
    const taxableIncome = netProfit - zakat;
    const tax = (taxableIncome > 0) ? taxableIncome * taxRate : 0;
    
    return { zakat, tax };
}

export function projectZakatAndTax(financials) {
    if (!financials || !financials.incomeStatement) return [];
    
    return financials.incomeStatement.map(year => {
        const { zakat, tax } = calculateZakatAndTax(year.netProfitBeforeZakat || year.ebt, year.zakatBase);
        return {
            year: year.year,
            zakat,
            tax
        };
    });
}
