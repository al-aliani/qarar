/**
 * Zakat & Tax Calculator for Saudi Arabia
 * Separates Zakat (للشركات السعودية) from Corporate Tax (للشركات المختلطة/الأجنبية)
 * 
 * Rules:
 * - 100% Saudi owned: Zakat only (2.5% on Zakat base)
 * - 100% Foreign owned: Corporate Tax only (20%)
 * - Mixed ownership: Proportional split
 */

export const TAX_RATES = {
    zakat: 0.025,           // 2.5% على الوعاء الزكوي
    corporateTax: 0.20,     // 20% للشركات الأجنبية
    withholdingTax: 0.05    // 5% ضريبة استقطاع
};

/**
 * Calculate Zakat base (الوعاء الزكوي)
 * Simplified: Equity + Long-term Liabilities - Fixed Assets
 */
export function calculateZakatBase(balanceSheet) {
    if (!balanceSheet) return 0;

    const equity = balanceSheet.equity?.total || 0;
    const longTermDebt = balanceSheet.liabilities?.longTerm?.total || 0;
    const fixedAssetsNet = balanceSheet.assets?.fixed?.net || 0;

    // الوعاء الزكوي = حقوق الملكية + الالتزامات طويلة الأجل - الأصول الثابتة
    const zakatBase = equity + longTermDebt - fixedAssetsNet;

    return Math.max(0, zakatBase);
}

/**
 * Calculate Zakat and Tax based on ownership
 */
export function calculateZakatAndTax({
    netIncome = 0,
    balanceSheet = null,
    saudiOwnership = 1.0,  // 0-1 (100% Saudi = 1)
    fiscalYear = new Date().getFullYear()
}) {
    const foreignOwnership = 1 - saudiOwnership;

    // Zakat calculation (for Saudi portion)
    const zakatBase = calculateZakatBase(balanceSheet);
    const zakatableProfit = zakatBase * saudiOwnership;
    const zakatAmount = zakatableProfit * TAX_RATES.zakat;

    // Corporate Tax calculation (for foreign portion)
    const taxableProfit = Math.max(0, netIncome) * foreignOwnership;
    const taxAmount = taxableProfit * TAX_RATES.corporateTax;

    // Total obligation
    const totalObligation = zakatAmount + taxAmount;

    return {
        fiscalYear,
        ownership: {
            saudi: (saudiOwnership * 100).toFixed(0) + '%',
            foreign: (foreignOwnership * 100).toFixed(0) + '%'
        },
        zakat: {
            base: Math.round(zakatBase),
            applicable: Math.round(zakatableProfit),
            rate: (TAX_RATES.zakat * 100).toFixed(1) + '%',
            amount: Math.round(zakatAmount)
        },
        tax: {
            taxableIncome: Math.round(taxableProfit),
            rate: (TAX_RATES.corporateTax * 100).toFixed(0) + '%',
            amount: Math.round(taxAmount)
        },
        total: Math.round(totalObligation),
        effectiveRate: netIncome > 0
            ? ((totalObligation / netIncome) * 100).toFixed(1) + '%'
            : '0%'
    };
}

/**
 * Project Zakat/Tax for multiple years
 */
export function projectZakatAndTax(incomeStatements, balanceSheets, saudiOwnership = 1.0) {
    return incomeStatements.map((stmt, idx) => {
        return calculateZakatAndTax({
            netIncome: stmt.ebt || stmt.ebit,
            balanceSheet: balanceSheets?.[idx] || null,
            saudiOwnership,
            fiscalYear: new Date().getFullYear() + idx
        });
    });
}

/**
 * Get combined tax rate for simplified calculations
 */
export function getEffectiveTaxRate(saudiOwnership = 1.0) {
    // Weighted average (simplified)
    // Zakat ~2.5% vs Tax ~20%, but Zakat is on different base
    // For P&L purposes, use approximation
    const foreignOwnership = 1 - saudiOwnership;
    return (saudiOwnership * 0.025) + (foreignOwnership * TAX_RATES.corporateTax);
}
