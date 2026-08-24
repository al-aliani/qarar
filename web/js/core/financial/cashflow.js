/**
 * ═══ التدفقات النقدية والمؤشرات المالية ═══
 * حساب NPV و IRR و MIRR والقيمة النهائية (Terminal Value)
 */

export function calculateNPV(rate, cashflows) {
    return cashflows.reduce((acc, val, i) => acc + val / Math.pow(1 + rate, i), 0);
}

export function calculateIRR(cashflows, guess = 0.1) {
    // null = غير قابل للحساب (نفس اصطلاح calculatePaybackPeriod أدناه)، وليس 0% —
    // فرق جوهري: صفر تدفقات سالبة يعني "لا يوجد استثمار مسجَّل بعد"، لا "عائد صفري".
    if (!Array.isArray(cashflows) || cashflows.length < 2) return null;
    if (!cashflows.some(v => v > 0) || !cashflows.some(v => v < 0)) return null;

    const maxIter = 1000;
    const precision = 1e-7;
    let rate = guess;

    for (let i = 0; i < maxIter; i++) {
        const npv = calculateNPV(rate, cashflows);
        if (Math.abs(npv) < precision) break;

        const derivative = cashflows.reduce((acc, val, t) => {
            if (t === 0) return acc;
            return acc - t * val * Math.pow(1 + rate, -t - 1);
        }, 0);

        if (derivative === 0) break;
        const newRate = rate - npv / derivative;
        if (!Number.isFinite(newRate) || newRate <= -0.9999 || newRate > 1e4) break;
        if (Math.abs(newRate - rate) < precision) { rate = newRate; break; }
        rate = newRate;
    }
    if (!Number.isFinite(rate)) return null;

    const finalNpv = calculateNPV(rate, cashflows);
    const scale = 1 + Math.abs(cashflows[0]);
    if (Math.abs(finalNpv) > 1e-3 * scale) return null;
    if (rate > 5) return null;
    if (rate < -0.9999) return -0.9999;
    return rate;
}

// عدد مرات تغيّر الإشارة بين القيم غير الصفرية في متتالية تدفقات نقدية (قاعدة ديكارت
// للجذور — تعدد التغيّرات يعني احتمال تعدد جذور IRR رياضياً). الأصفار تُتجاهَل تماماً
// ولا تُعامَل كإشارة، فلا تُحتسَب كتغيّر مقابل القيمة السابقة/التالية غير الصفرية.
export function countSignChanges(cashflows) {
    if (!Array.isArray(cashflows)) return 0;
    let changes = 0;
    let lastSign = 0;
    for (const v of cashflows) {
        const sign = Math.sign(v);
        if (sign === 0) continue;
        if (lastSign !== 0 && sign !== lastSign) changes++;
        lastSign = sign;
    }
    return changes;
}

export function calculatePaybackPeriod(cashflows) {
    if (!Array.isArray(cashflows) || cashflows.length === 0 || cashflows[0] >= 0) return null;
    let cumulative = 0;
    for (let i = 0; i < cashflows.length; i++) {
        const previous = cumulative;
        cumulative += Number(cashflows[i]) || 0;
        if (cumulative >= 0) {
            if (i === 0) return 0;
            const current = Number(cashflows[i]) || 0;
            if (current <= 0) return null;
            return (i - 1) + (-previous / current);
        }
    }
    return Infinity;
}

export function calculateMIRR(cashflows, financeRate, reinvestRate) {
    if (!cashflows?.length) return 0;
    const n = cashflows.length;
    let pvNeg = 0;
    let fvPos = 0;
    for (let i = 0; i < n; i++) {
        const cf = cashflows[i];
        if (cf < 0) pvNeg += cf / Math.pow(1 + financeRate, i);
        else if (cf > 0) fvPos += cf * Math.pow(1 + reinvestRate, n - 1 - i);
    }
    if (pvNeg >= 0 || fvPos <= 0) return 0;
    return Math.pow(-fvPos / pvNeg, 1 / (n - 1)) - 1;
}

export function calculateTerminalValue({
    tvCfg,
    lastYearIncomeStatement,
    discountRate,
    years,
    loanScheduleData
}) {
    let terminalValueDiscounted = 0;
    let tvEquity = 0;

    if ((tvCfg.method || 'gordon') !== 'none') {
        const ebitLast = Number(lastYearIncomeStatement.ebit || 0);
        const ebtLast = Number(lastYearIncomeStatement.ebt || 0);
        const levyLast = Number(lastYearIncomeStatement.zakat || 0) + Number(lastYearIncomeStatement.tax || 0);
        const effLevyRate = ebtLast > 0 ? Math.min(1, levyLast / ebtLast) : 0;
        
        // NOPAT
        const normalizedFCF = ebitLast * (1 - effLevyRate);
        const g = Math.min(Number(tvCfg.growthRate ?? 0.02), Math.max(0, discountRate - 0.02));
        
        if (normalizedFCF > 0 && discountRate > g) {
            const tvEnterprise = (normalizedFCF * (1 + g)) / (discountRate - g);
            const remainingDebtAtHorizon = loanScheduleData?.annualSummary?.find(s => s.year === years)?.endingBalance ?? 0;
            tvEquity = Math.max(0, tvEnterprise - remainingDebtAtHorizon);
            terminalValueDiscounted = tvEquity / Math.pow(1 + discountRate, years);
        }
    }

    return { tvEquity, terminalValueDiscounted };
}
