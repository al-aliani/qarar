/**
 * Saudi Zakat & VAT Calculator
 * Handles calculation of Zakat (2.5% of Zakat Base) and VAT (15% added/deducted)
 * 2024 Regulations
 */

export const TAX_CONFIG = {
    vatRate: 0.15,      // 15% VAT
    zakatRate: 0.025,   // 2.5% Zakat (Islamic lunar year basis approx)
    corporateTaxRate: 0.20 // 20% for non-Saudi (not implemented yet, assuming 100% Saudi for now)
};

/**
 * Calculate VAT for revenue stream
 * @param {number} amount Revenue amount (excluding VAT)
 * @returns {object} { net, vat, gross }
 */
export function calculateVAT(amount) {
    const vat = amount * TAX_CONFIG.vatRate;
    return {
        net: amount,
        vat: vat,
        gross: amount + vat
    };
}

/**
 * Calculate Zakat Base (Simplified Method)
 * Zakat Base = Equity + Long Term Liabilities + Net Income + Adjusted Provisions - Net Fixed Assets
 * Rule: Zakat Base cannot be less than Net Income (Adjusted)
 */
export function calculateZakat(netIncome, equity, longTermDebt, netFixedAssets) {
    // 1. Calculate Zakat Base (Source of Funds - Uses of Funds)
    // Sources: Equity + Long Term Debt + Net Income
    // Uses: Fixed Assets (Net Book Value)

    // Simplification: We assume Average Equity/Debt if available, allowing simple EOY calc for now
    const sources = equity + longTermDebt + netIncome;
    const uses = netFixedAssets;

    let zakatBase = sources - uses;

    // 2. Minimum Base Rule: Base cannot be less than Adjusted Net Income
    // For simplicity, we compare with Net Income directly
    if (zakatBase < netIncome) {
        zakatBase = netIncome;
    }

    // 3. Negative Base: No Zakat if base is negative (and income is negative)
    if (zakatBase < 0) zakatBase = 0;

    const zakatAmount = zakatBase * TAX_CONFIG.zakatRate;

    return {
        base: zakatBase,
        amount: Math.round(zakatAmount),
        isMinimumBase: zakatBase === netIncome
    };
}
