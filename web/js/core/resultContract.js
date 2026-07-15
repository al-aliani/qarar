/**
 * Unified financial-results contract.
 *
 * Official study KPIs must be read from calculateStudy(...).indicators.
 * Legacy top-level fallbacks are allowed only when explicitly requested for
 * old saved/shared payloads.
 */

export function getOfficialIndicators(results = {}, options = {}) {
    const { allowLegacy = false } = options;
    const indicators = results?.indicators && typeof results.indicators === 'object'
        ? results.indicators
        : {};

    if (!allowLegacy) return indicators;

    return {
        ...indicators,
        npv: indicators.npv ?? results?.npv,
        irr: indicators.irr ?? results?.irr,
        paybackPeriod: indicators.paybackPeriod ?? results?.paybackPeriod ?? results?.payback,
        profitMargin: indicators.profitMargin ?? results?.profitMargin,
        roi: indicators.roi ?? results?.roi,
        breakEvenPointValue: indicators.breakEvenPointValue ?? results?.breakEvenPointValue,
        dscr: indicators.dscr ?? results?.dscr
    };
}

export function requireOfficialIndicators(results = {}) {
    const indicators = getOfficialIndicators(results);
    if (!indicators || Object.keys(indicators).length === 0) {
        throw new Error('Missing official financial indicators: expected calculateStudy(...).indicators');
    }
    return indicators;
}
